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

const [{ default: prisma }, { createContentGenerationTask, updateContentGenerationTask }] = await Promise.all([
  import('../server/utils/prisma.js'),
  import('../server/services/contentGeneration/taskStore.js'),
])

const PREFIX = '[Phase 1 input test]'

async function selectFixtureContext() {
  const categories = await prisma.categoryLevel2.findMany({
    where: { isActive: true },
    orderBy: [{ toolCount: 'desc' }, { id: 'asc' }],
    take: 100,
    include: {
      toolCategories: {
        where: { aiTool: { toolStatus: { in: ['ONLINE', 'ACTIVE'] }, handle: { not: '' }, name: { not: '' } } },
        orderBy: [{ aiTool: { rank: 'asc' } }],
        take: 10,
        select: { aiTool: { select: { id: true, name: true, handle: true } } },
      },
    },
  })
  const category = categories.find(row => row.toolCategories.length >= 5)
  if (!category) throw new Error('No active category with at least five active tools is available for Phase 1 test tasks.')
  return { category, tools: category.toolCategories.map(row => row.aiTool) }
}

async function saveTask(contentType, categoryId, toolId, brief) {
  const title = `${PREFIX} ${contentType}`
  const existing = await prisma.contentGenerationTask.findFirst({ where: { title }, orderBy: { id: 'desc' } })
  const payload = {
    title,
    contentType,
    categoryId,
    toolId: toolId || null,
    limit: 10,
    status: 'review',
    promptJson: { brief },
  }
  return existing
    ? updateContentGenerationTask(existing.id, payload, null)
    : createContentGenerationTask(payload, null)
}

async function main() {
  const { category, tools } = await selectFixtureContext()
  const [primary, secondary, ...alternatives] = tools
  const keyword = category.name.toLowerCase()
  const criteria = ['Workflow fit', 'Output quality', 'Ease of use', 'Pricing', 'Integrations', 'Team adoption']
  const tasks = []

  tasks.push(await saveTask('BUYER_GUIDE', category.id, null, {
    selectedToolIds: tools.slice(0, 5).map(tool => tool.id),
    targetKeyword: `best ${keyword} tools`,
    pageGoal: `Help teams shortlist ${category.name} tools for a real buying decision.`,
    searchIntent: 'Compare suitable tools and choose a shortlist.',
    audience: 'Small teams evaluating AI software',
    decisionCriteria: criteria,
  }))

  tasks.push(await saveTask('CATEGORY_GUIDE', category.id, null, {
    targetKeyword: `${keyword} explained`,
    pageGoal: `Explain what ${category.name} tools are, who should use them, and how to choose one.`,
    searchIntent: 'Understand the category before evaluating products.',
    audience: 'First-time buyers researching the category',
  }))

  tasks.push(await saveTask('TUTORIAL', category.id, primary.id, {
    targetKeyword: `how to use ${primary.name}`,
    pageGoal: `Teach a repeatable beginner workflow in ${primary.name}.`,
    searchIntent: 'Complete a specific workflow step by step.',
    audience: `New ${primary.name} users`,
    primaryToolId: primary.id,
    tutorialGoal: `Create and verify a first production-ready result with ${primary.name}.`,
    workflowContext: [
      'Prepare the required input and success criteria.',
      `Configure the core workflow in ${primary.name}.`,
      'Run, inspect, refine, and export the result.',
    ],
    prerequisiteKnowledge: ['Access to the tool', 'A sample input', 'Basic familiarity with the target workflow'],
    commonMistakes: ['Starting without success criteria', 'Skipping output verification'],
    outputChecklist: ['The result meets the stated goal', 'The output was reviewed', 'The final artifact was exported'],
    relatedToolIds: tools.slice(1, 3).map(tool => tool.id),
  }))

  tasks.push(await saveTask('COMPARISON', category.id, primary.id, {
    primaryToolId: primary.id,
    secondaryToolId: secondary.id,
    comparisonIntent: `Choose between ${primary.name} and ${secondary.name} for the same workflow.`,
    targetAudience: 'Teams making a two-product shortlist decision',
    decisionCriteria: criteria,
    sharedUseCases: [`Core ${category.name} workflow`, 'Team adoption', 'Repeatable production use'],
  }))

  tasks.push(await saveTask('ALTERNATIVE', category.id, primary.id, {
    primaryToolId: primary.id,
    alternativeToolIds: [secondary, ...alternatives].slice(0, 4).map(tool => tool.id),
    reasonToSwitch: `Find alternatives to ${primary.name} with a different workflow, feature fit, or pricing model.`,
    selectionCriteria: criteria,
  }))

  console.log(JSON.stringify({
    createdOrUpdated: tasks.map(task => ({ id: task.id, contentType: task.contentType, status: task.status })),
    category: { id: category.id, name: category.name, handle: category.handle },
    tools: tools.slice(0, 6),
    generatedContentWrites: 0,
    finalContentWrites: 0,
    deepSeekCalls: 0,
  }, null, 2))
}

try {
  await main()
}
finally {
  await prisma.$disconnect()
}
