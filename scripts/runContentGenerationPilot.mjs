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

globalThis.useRuntimeConfig = () => ({
  aiApiKey: process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || '',
  aiBaseUrl: process.env.AI_BASE_URL || 'https://api.deepseek.com/v1',
  aiModel: process.env.AI_MODEL || 'deepseek-chat',
  aiTimeoutMs: process.env.AI_TIMEOUT_MS || '300000',
})

const [{ generateContentForTask }, { getContentGenerationTask }, { default: prisma }] = await Promise.all([
  import('../server/services/contentGeneration/generator.js'),
  import('../server/services/contentGeneration/taskStore.js'),
  import('../server/utils/prisma.js'),
])

const TASKS = [
  { id: 22, expectedType: 'buyer_guide' },
  { id: 25, expectedType: 'comparison' },
]

function compact(value, max = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max)}...` : text
}

function blockSummary(content) {
  return (content?.bodyJson?.blocks || []).map((block, index) => ({
    index,
    type: block?.type || null,
    heading: compact(block?.heading || block?.title || block?.question || '', 100),
    toolHandle: block?.toolHandle || null,
    itemCount: Array.isArray(block?.items) ? block.items.length : undefined,
  }))
}

function schemaSummary(content) {
  const schema = content?.schemaJson
  if (!schema) return null
  if (Array.isArray(schema)) return { type: 'array', count: schema.length, schemaTypes: schema.map(row => row?.['@type']).filter(Boolean) }
  return { type: typeof schema, keys: Object.keys(schema), schemaType: schema?.['@type'] || null, graphCount: schema?.['@graph']?.length || 0 }
}

function briefSummary(brief) {
  return Object.fromEntries(Object.entries(brief || {}).map(([key, value]) => {
    if (Array.isArray(value)) return [key, { count: value.length, sample: value.slice(0, 3) }]
    if (typeof value === 'object' && value) return [key, { keys: Object.keys(value) }]
    return [key, compact(value)]
  }))
}

function report(task) {
  const content = task.generatedContent || task.finalContent || task.contentJson || {}
  const validation = task.validationJson || {}
  const source = task.sourceDataJson || {}
  const brief = task.promptJson?.brief || {}
  const common = {
    taskId: task.id,
    title: task.title,
    slug: content.contentPage?.slug || task.slug,
    contentType: task.contentType,
    taskStatus: task.status,
    robots: content.contentPage?.robots || null,
    brief: briefSummary(brief),
    inputSummary: {
      inputContractType: validation.inputContractType || validation.inputContract?.inputContractType,
      selectedToolStrategy: validation.selectedToolStrategy,
      missingRequiredFields: validation.inputContract?.missingRequiredFields || [],
      sourceMapCount: source.aiInput?.sourceMap?.length || validation.sourceCount || 0,
      inputWarnings: validation.inputContract?.inputWarnings || [],
    },
    sourceMapCount: source.aiInput?.sourceMap?.length || 0,
    generatedWordCount: validation.wordCount || validation.metrics?.wordCount || 0,
    blockCount: validation.blockCount || validation.metrics?.blockCount || 0,
    faqCount: validation.faqCount || validation.metrics?.faqCount || 0,
    sourceCount: validation.sourceCount || content.sources?.length || 0,
    validationScore: validation.score || 0,
    passed: Boolean(validation.passed),
    failedChecks: validation.failedChecks || [],
    warnings: validation.warnings || [],
    contentPage: content.contentPage || null,
    bodyJsonBlocks: blockSummary(content),
    schemaJson: schemaSummary(content),
  }
  if (String(task.contentType).toUpperCase() === 'COMPARISON') {
    return {
      ...common,
      primaryTool: source.aiInput?.primaryTool || null,
      secondaryTool: source.aiInput?.secondaryTool || null,
      matrixRowCount: validation.matrixRowCount || validation.metrics?.matrixRowCount || 0,
      criteriaCount: validation.criteriaCount || validation.metrics?.criteriaCount || 0,
      comparisonPage: content.comparisonPage || null,
      comparisonTools: content.comparisonTools || [],
    }
  }
  const selectedTools = source.aiInput?.selectedTools || []
  const sourceToolIds = [...new Set((content.sources || []).map(row => row.toolId).filter(Boolean))]
  return {
    ...common,
    selectedTools,
    toolCalloutCount: validation.metrics?.toolCalloutCount || 0,
    selectedToolSourceConsistency: {
      selectedToolIds: selectedTools.map(tool => tool.id),
      sourceToolIds,
      allSourceToolsSelected: sourceToolIds.every(id => selectedTools.some(tool => Number(tool.id) === Number(id))),
    },
  }
}

async function main() {
  const results = []
  for (const spec of TASKS) {
    const before = await getContentGenerationTask(spec.id)
    if (!before) throw new Error(`Task ${spec.id} not found`)
    if (before.contentType !== spec.expectedType) throw new Error(`Task ${spec.id} type mismatch: ${before.contentType}`)
    try {
      await generateContentForTask(spec.id, {}, null)
    }
    catch (error) {
      results.push({ taskId: spec.id, generationError: error?.statusMessage || error?.message || String(error) })
    }
    const after = await getContentGenerationTask(spec.id)
    results.push(report(after))
  }
  console.log(JSON.stringify({
    realDeepSeekGeneration: true,
    publishedTasks: results.filter(row => row.taskStatus === 'published').length,
    reviewTasks: results.filter(row => row.taskStatus === 'review').length,
    reports: results,
  }, null, 2))
}

try {
  await main()
}
finally {
  await prisma.$disconnect()
}
