import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = path.join(root, '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

const [
  { default: prisma },
  { createContentGenerationTask, updateContentGenerationTask },
  { prepareDeterministicBrief },
  { buildContentSourceData },
  { validateSourceData },
] = await Promise.all([
  import('../server/utils/prisma.js'),
  import('../server/services/contentGeneration/taskStore.js'),
  import('../server/services/contentGeneration/briefBuilder.js'),
  import('../server/services/contentGeneration/sourceBuilder.js'),
  import('../server/services/contentGeneration/validators.js'),
])

const TYPES = ['BUYER_GUIDE', 'CATEGORY_GUIDE', 'TUTORIAL', 'COMPARISON', 'ALTERNATIVE']

async function fixture() {
  const categories = await prisma.categoryLevel2.findMany({
    where: { isActive: true },
    orderBy: [{ toolCount: 'desc' }, { id: 'asc' }],
    take: 100,
    include: {
      toolCategories: {
        where: { aiTool: { toolStatus: { in: ['ONLINE', 'ACTIVE'] }, website: { not: null }, OR: [{ description: { not: null } }, { whatIsSummary: { not: null } }] } },
        take: 10,
        select: { aiTool: { select: { id: true, name: true, handle: true } } },
      },
    },
  })
  const category = categories.find(row => row.toolCategories.length >= 5)
  if (!category) throw new Error('No suitable category fixture found.')
  return { category, primaryTool: category.toolCategories[0].aiTool }
}

async function main() {
  const { category, primaryTool } = await fixture()
  const stamp = new Date().toISOString()
  const output = []

  for (const contentType of TYPES) {
    const categoryDriven = ['BUYER_GUIDE', 'CATEGORY_GUIDE'].includes(contentType)
    const task = await createContentGenerationTask({
      title: `[Prepare Brief smoke] ${contentType} ${stamp}`,
      contentType,
      categoryId: categoryDriven ? category.id : null,
      toolId: categoryDriven ? null : primaryTool.id,
      status: 'draft',
      limit: 5,
    }, null)
    const brief = await prepareDeterministicBrief({ ...task, contentType: contentType })
    const updated = await updateContentGenerationTask(task.id, {
      promptJson: { brief, briefPreparedBy: 'deterministic-rules' },
      toolId: brief.primaryToolId || task.toolId || null,
    }, null)
    const sourceData = await buildContentSourceData({ ...updated, contentType })
    const validation = validateSourceData(sourceData)
    output.push({
      taskId: updated.id,
      contentType,
      stage1Input: categoryDriven ? { categoryId: category.id } : { primaryToolId: primaryTool.id },
      briefFields: Object.keys(brief),
      selectedToolIds: brief.selectedToolIds || brief.representativeToolIds || brief.alternativeToolIds || [],
      primaryToolId: brief.primaryToolId || null,
      secondaryToolId: brief.secondaryToolId || null,
      decisionCriteriaCount: (brief.decisionCriteria || brief.selectionCriteria || []).length,
      workflowStepCount: brief.workflowContext?.length || 0,
      sourceMapCount: validation.inputContract?.sourceMapCount || 0,
      selectedToolStrategy: sourceData.selectedToolStrategy,
      missingRequiredFields: validation.inputContract?.missingRequiredFields || [],
      contractPassed: Boolean(validation.ok && validation.inputContract?.passed),
      briefSource: 'content_generation_tasks.prompt_json.brief',
    })
  }

  console.log(JSON.stringify({ dryRun: true, deepSeekCalls: 0, generatedContentWrites: 0, finalContentWrites: 0, tasks: output }, null, 2))
}

try {
  await main()
}
finally {
  await prisma.$disconnect()
}
