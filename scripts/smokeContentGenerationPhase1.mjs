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

const TYPES = ['BUYER_GUIDE', 'CATEGORY_GUIDE', 'TUTORIAL', 'COMPARISON', 'ALTERNATIVE']
const [{ default: prisma }, { buildContentSourceData }, { buildContentPrompt, applyPromptTemplate }, { validateSourceData }] = await Promise.all([
  import('../server/utils/prisma.js'),
  import('../server/services/contentGeneration/sourceBuilder.js'),
  import('../server/services/contentGeneration/prompts.js'),
  import('../server/services/contentGeneration/validators.js'),
])

function hasBrief(promptJson) {
  const brief = promptJson?.brief || promptJson?.input
  return Boolean(brief && typeof brief === 'object' && Object.keys(brief).length)
}

function taskForBuilder(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug || '',
    contentType: row.contentType,
    targetType: row.targetType || '',
    categoryId: row.categoryId,
    toolId: row.toolId,
    limit: row.limitCount,
    promptJson: row.promptJson,
  }
}

function selectedTools(input, contentType) {
  if (contentType === 'BUYER_GUIDE') return input.selectedTools || []
  if (contentType === 'CATEGORY_GUIDE') return input.representativeTools || []
  if (contentType === 'TUTORIAL') return [input.primaryTool, ...(input.relatedTools || [])].filter(Boolean)
  if (contentType === 'COMPARISON') return [input.primaryTool, input.secondaryTool].filter(Boolean)
  return [input.primaryTool, ...(input.alternativeTools || [])].filter(Boolean)
}

function unavailableSummary(contentType, reason) {
  return {
    taskId: null,
    contentType,
    inputContractType: contentType,
    fields: [],
    selectedTools: [],
    sourceMapCount: 0,
    selectedToolStrategy: null,
    missingRequiredFields: [reason],
    forbiddenFieldsRemoved: [],
    inputWarnings: ['No input facts were fabricated by the dry-run.'],
    contractPassed: false,
  }
}

async function summarize(row) {
  const sourceData = await buildContentSourceData(taskForBuilder(row))
  const validation = validateSourceData(sourceData)
  const input = sourceData.aiInput || {}
  const contract = validation.inputContract || sourceData.inputValidation || {}
  const sourcePrompt = buildContentPrompt(sourceData)
  const templateProbe = applyPromptTemplate('{{SOURCE_PROMPT}}\n{{SOURCE_DATA_JSON}}', sourcePrompt, {
    ...sourceData,
    secretFullSourceDataProbe: 'FULL_SOURCE_DATA_MUST_NOT_APPEAR',
  })
  const claims = (sourceData.tools || []).flatMap(tool => tool.claims || [])
  const categoryFields = ['whatIsSummary', 'feature', 'whoIsUse', 'howDoWork', 'advantages', 'faq']

  return {
    taskId: row.id,
    contentType: row.contentType,
    inputContractType: contract.inputContractType || row.contentType,
    fields: Object.keys(input),
    selectedTools: selectedTools(input, row.contentType).map(tool => ({ id: tool.id, handle: tool.handle, name: tool.name })),
    sourceMapCount: input.sourceMap?.length || 0,
    selectedToolStrategy: sourceData.selectedToolStrategy || null,
    missingRequiredFields: contract.missingRequiredFields || [],
    forbiddenFieldsRemoved: contract.forbiddenFieldsRemoved || [],
    inputWarnings: contract.inputWarnings || [],
    contractPassed: Boolean(validation.ok && contract.passed),
    checks: {
      briefSource: 'content_generation_tasks.prompt_json.brief',
      categoryContext: row.contentType === 'CATEGORY_GUIDE'
        ? Object.fromEntries(categoryFields.map(field => [field, Object.prototype.hasOwnProperty.call(input.categoryContext || {}, field)]))
        : null,
      promptVersionUsesCompactContract: !templateProbe.includes('FULL_SOURCE_DATA_MUST_NOT_APPEAR'),
      socialLinksSourcesRemoved: !(input.sourceMap || []).some(source => /social|contact/i.test(`${source.factType || ''} ${source.context || ''}`)),
      claimsFilteredByExpiresAtConfidenceStatus: claims.every(claim => (
        claim.status === 'ACTIVE'
        && Number(claim.confidence || 0) >= 0.7
        && (!claim.expiresAt || new Date(claim.expiresAt).getTime() > Date.now())
      )),
      comparisonHasPrimaryAndSecondary: row.contentType === 'COMPARISON' ? Boolean(input.primaryTool && input.secondaryTool) : null,
      alternativeHasPrimaryAndAlternatives: row.contentType === 'ALTERNATIVE' ? Boolean(input.primaryTool && input.alternativeTools?.length >= 2) : null,
      tutorialHasGoalPrimaryWorkflow: row.contentType === 'TUTORIAL' ? Boolean(input.tutorialGoal && input.primaryTool && input.workflowContext?.length) : null,
    },
  }
}

async function main() {
  const summaries = []
  for (const contentType of TYPES) {
    const rows = await prisma.contentGenerationTask.findMany({
      where: { contentType },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })
    const row = rows.find(task => hasBrief(task.promptJson))
    if (!row) {
      summaries.push(unavailableSummary(contentType, 'missingExistingTaskWithPromptJsonBrief'))
      continue
    }
    try {
      summaries.push(await summarize(row))
    }
    catch (error) {
      summaries.push({
        ...unavailableSummary(contentType, error instanceof Error ? error.message : String(error)),
        taskId: row.id,
        inputWarnings: ['The existing task brief was used; contract construction failed without adding fallback facts.'],
      })
    }
  }
  console.log(JSON.stringify({ dryRun: true, taskInputSource: 'existing database tasks', databaseWrites: 0, deepSeekCalls: 0, tasks: summaries }, null, 2))
}

try {
  await main()
}
catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.log(JSON.stringify({
    dryRun: true,
    taskInputSource: 'existing database tasks',
    databaseWrites: 0,
    deepSeekCalls: 0,
    databaseError: message,
    tasks: TYPES.map(type => unavailableSummary(type, `databaseUnavailable: ${message}`)),
  }, null, 2))
  process.exitCode = 2
}
finally {
  await prisma.$disconnect()
}
