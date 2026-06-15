import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (process.env[key] === undefined) process.env[key] = value
  }
}

const prisma = new PrismaClient()
const baseUrl = process.env.CONTENT_GEN_BASE_URL || 'http://127.0.0.1:3010'
const secret = process.env.JWT_SECRET || 'dev-admin-jwt-secret-change-in-production'
const token = jwt.sign({ sub: 1, email: 'batch-content-gen@local', role: 'SUPERADMIN' }, secret, { expiresIn: '12h' })
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const nowStamp = new Date().toISOString().replace(/[:.]/g, '-')

const guideCategoryRequests = [
  ['ai-writing-assistants'],
  ['ai-summarizer'],
  ['ai-paraphraser'],
  ['ai-grammar-checker'],
  ['ai-email-generator', 'ai-email-writer', 'ai-email-assistant'],
  ['ai-image-generator'],
  ['ai-video-generator'],
  ['ai-chatbot'],
  ['ai-code-assistant'],
  ['ai-seo', 'ai-seo-tools', 'ai-seo-assistant'],
  ['ai-marketing', 'ai-marketing-tools', 'ai-marketing-assistant'],
  ['ai-presentation-generator', 'ai-presentation', 'ai-ppt-maker'],
  ['ai-transcription'],
  ['ai-pdf'],
  ['ai-meeting-assistant'],
  ['ai-note-taker'],
  ['ai-productivity-tools', 'ai-productivity'],
  ['ai-research-tool', 'ai-research'],
  ['ai-design-generator', 'ai-design'],
  ['ai-social-media-post-generator', 'ai-social-media'],
]

const compareRequests = [
  { title: 'ChatGPT vs Claude', primary: ['chatgpt-4', 'chatgpt'], secondary: ['claude', 'claude-ai'] },
  { title: 'ChatGPT vs Gemini', primary: ['chatgpt-4', 'chatgpt'], secondary: ['gemini', 'google-gemini'] },
  { title: 'ChatGPT vs Perplexity', primary: ['chatgpt-4', 'chatgpt'], secondary: ['perplexity-ai', 'perplexity'] },
  { title: 'Claude vs Gemini', primary: ['claude', 'claude-ai'], secondary: ['gemini', 'google-gemini'] },
  { title: 'Jasper AI vs Copy.ai', primary: ['jasper-ai', 'jasper'], secondary: ['copy-ai', 'copyai'] },
  { title: 'Jasper AI vs Writesonic', primary: ['jasper-ai', 'jasper'], secondary: ['writesonic'] },
  { title: 'Grammarly vs QuillBot', primary: ['grammarly'], secondary: ['quillbot-paraphraser', 'quillbot'] },
  { title: 'Notion AI vs Airtable AI', primary: ['notion-ai'], secondary: ['airtable-ai-assistant', 'airtable'] },
  { title: 'Midjourney vs Leonardo AI', primary: ['midjourney'], secondary: ['leonardo-ai'] },
  { title: 'Runway vs Pika', primary: ['runway'], secondary: ['pika'] },
  { title: 'Synthesia vs HeyGen', primary: ['synthesia'], secondary: ['heygen'] },
  { title: 'Otter.ai vs Fireflies.ai', primary: ['otter-ai', 'otter'], secondary: ['fireflies-ai', 'fireflies'] },
  { title: 'Surfer SEO vs Frase', primary: ['surfer-seo', 'surfer'], secondary: ['frase'] },
  { title: 'Surfer SEO vs AISEO', primary: ['surferseo-com', 'surfer-seo', 'surfer'], secondary: ['aiseo', 'ai-seo'] },
  { title: 'MiriCanvas vs Adobe', primary: ['miricanvas', 'canva-ai', 'canva'], secondary: ['adobe', 'adobe-express'] },
  { title: 'Descript vs Riverside', primary: ['descript'], secondary: ['riverside'] },
  { title: 'Zapier AI vs n8n', primary: ['zapier-com', 'zapier', 'zapier-ai'], secondary: ['n8n', 'make', 'make-com'] },
  { title: 'Gamma vs Beautiful.ai', primary: ['gamma'], secondary: ['beautiful-ai'] },
  { title: 'ElevenLabs vs Murf AI', primary: ['elevenlabs'], secondary: ['murf-ai', 'murf'] },
  { title: 'Replit AI vs Cursor', primary: ['replit-ai', 'replit'], secondary: ['cursor'] },
]

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } })
  const text = await response.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!response.ok) {
    const error = new Error(typeof body === 'string' ? body : (body?.statusMessage || body?.message || response.statusText))
    error.status = response.status
    error.body = body
    throw error
  }
  return body
}

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      await fetch(`${baseUrl}/`)
      return
    } catch {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  throw new Error(`Server not ready: ${baseUrl}`)
}

async function resolveCategory(handles) {
  for (const handle of handles) {
    const row = await prisma.categoryLevel2.findFirst({
      where: { handle, isActive: true },
      select: { id: true, name: true, handle: true, level1: { select: { handle: true } } },
    })
    if (row) return row
  }
  const terms = handles.flatMap(handle => handle.split('-')).filter(term => term.length >= 4)
  const row = await prisma.categoryLevel2.findFirst({
    where: {
      isActive: true,
      OR: terms.map(term => ({ handle: { contains: term, mode: 'insensitive' } })),
    },
    orderBy: [{ toolCount: 'desc' }, { id: 'asc' }],
    select: { id: true, name: true, handle: true, level1: { select: { handle: true } } },
  })
  if (!row) throw new Error(`Category not found for ${handles.join(', ')}`)
  return row
}

async function resolveTool(handlesOrNames) {
  for (const handle of handlesOrNames) {
    const row = await prisma.aiTool.findFirst({
      where: { handle, toolStatus: { in: ['ONLINE', 'ACTIVE'] } },
      select: { id: true, name: true, handle: true },
    })
    if (row) return row
  }
  for (const value of handlesOrNames) {
    const q = value.replace(/-/g, ' ')
    const row = await prisma.aiTool.findFirst({
      where: {
        toolStatus: { in: ['ONLINE', 'ACTIVE'] },
        OR: [
          { name: { equals: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { handle: { contains: value, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ rank: 'asc' }, { monthVisitedCount: 'desc' }],
      select: { id: true, name: true, handle: true },
    })
    if (row) return row
  }
  throw new Error(`Tool not found for ${handlesOrNames.join(', ')}`)
}

function sourceDiagnostics(sourceData, validation) {
  const diagnostics = sourceData?.toolSelectionDiagnostics || {}
  const selectedTools = sourceData?.selectedTools || sourceData?.tools || []
  const fallbackTools = sourceData?.fallbackTools || []
  return {
    categorySlug: sourceData?.category ? `${sourceData.category.level1?.handle}/${sourceData.category.level2?.handle}` : '',
    candidateToolCount: diagnostics.candidateCount || 0,
    STRONG: diagnostics.relevanceCounts?.STRONG || 0,
    MEDIUM: diagnostics.relevanceCounts?.MEDIUM || 0,
    WEAK: diagnostics.relevanceCounts?.WEAK || 0,
    INVALID: diagnostics.relevanceCounts?.INVALID || 0,
    selectedTools: selectedTools.map(tool => ({
      id: tool.id,
      handle: tool.handle,
      name: tool.name,
      score: tool.categoryRelevanceScore,
      label: tool.relevanceLabel,
      reason: tool.selectionReason,
    })),
    fallbackTools: fallbackTools.map(tool => ({
      id: tool.id,
      handle: tool.handle,
      name: tool.name,
      score: tool.categoryRelevanceScore,
      label: tool.relevanceLabel,
      reason: tool.selectionReason,
    })),
    toolSelectionDiagnostics: diagnostics,
    validator: validation,
  }
}

function metricsFromTask(task) {
  const validation = task.validationJson || task.validation_json || {}
  const metrics = validation.metrics || {}
  const selectedTools = task.sourceDataJson?.selectedTools || task.source_data_json?.selectedTools || task.sourceDataJson?.tools || []
  const mediumCount = selectedTools.filter(tool => tool.relevanceLabel === 'MEDIUM').length
  const forbiddenClaims = (validation.errors || []).filter(error => /forbidden/i.test(error))
  return {
    score: validation.score || 0,
    wordCount: metrics.wordCount || validation.wordCount || 0,
    selectedToolsCount: selectedTools.length || validation.toolCount || 0,
    mediumRatio: selectedTools.length ? Number((mediumCount / selectedTools.length).toFixed(2)) : 0,
    forbiddenClaims,
    validatorPassed: Boolean(validation.ok || validation.passed),
    status: task.status,
    riskNotes: [
      ...(validation.warnings || []),
      ...((validation.errors || []).slice(0, 3)),
    ].join(' | '),
  }
}

async function createTask(input) {
  return fetchJson(`${baseUrl}/api/admin/content-generation/tasks`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

async function generateTask(taskId) {
  return fetchJson(`${baseUrl}/api/admin/content-generation/tasks/${taskId}/generate`, { method: 'POST' })
}

async function getTask(taskId) {
  return fetchJson(`${baseUrl}/api/admin/content-generation/tasks/${taskId}`)
}

async function runGuide(category) {
  const slug = `${category.handle}-buyer-guide-${nowStamp}`
  const task = await createTask({
    title: `${category.name} Buyer Guide batch validation`,
    slug,
    contentType: 'BUYER_GUIDE',
    targetType: 'guide',
    categoryId: category.id,
    limit: 8,
    status: 'draft',
  })
  const generated = await generateTask(task.id).catch(async (error) => {
    const failed = await getTask(task.id).catch(() => task)
    failed.errorMessage = error.message
    return failed
  })
  return generated
}

async function runCompare(pair) {
  const slug = `${slugify(pair.title)}-${nowStamp}`
  const task = await createTask({
    title: `${pair.title} batch validation`,
    slug,
    contentType: 'COMPARISON',
    targetType: 'compare',
    primaryToolId: pair.primaryTool.id,
    secondaryToolId: pair.secondaryTool.id,
    toolId: pair.primaryTool.id,
    limit: 5,
    status: 'draft',
    promptJson: {
      primaryToolId: pair.primaryTool.id,
      secondaryToolId: pair.secondaryTool.id,
    },
  })
  const generated = await generateTask(task.id).catch(async (error) => {
    const failed = await getTask(task.id).catch(() => task)
    failed.errorMessage = error.message
    return failed
  })
  return generated
}

async function main() {
  await waitForServer()
  const categories = []
  for (const handles of guideCategoryRequests) categories.push(await resolveCategory(handles))
  const pairs = []
  for (const request of compareRequests) {
    pairs.push({
      title: request.title,
      primaryTool: await resolveTool(request.primary),
      secondaryTool: await resolveTool(request.secondary),
    })
  }

  const guides = []
  const compares = []
  const sourceReports = []
  const summary = []

  for (const category of categories) {
    console.log(`GUIDE_START ${category.level1.handle}/${category.handle}`)
    const task = await runGuide(category)
    const validation = task.validationJson || {}
    sourceReports.push(sourceDiagnostics(task.sourceDataJson, validation))
    const metrics = metricsFromTask(task)
    const fallbackCount = task.sourceDataJson?.fallbackTools?.length || 0
    const needsReview = metrics.mediumRatio > 0.4 || fallbackCount > 3 || !metrics.validatorPassed
    guides.push({ category, task, metrics, needsReview })
    summary.push({
      contentType: 'Guide',
      slug: task.slug,
      ...metrics,
      riskNotes: [metrics.riskNotes, fallbackCount > 3 ? 'fallbackTools > 3' : '', metrics.mediumRatio > 0.4 ? 'MEDIUM ratio > 40%' : ''].filter(Boolean).join(' | '),
    })
    console.log(`GUIDE_DONE ${task.slug} status=${task.status} score=${metrics.score} passed=${metrics.validatorPassed}`)
  }

  for (const pair of pairs) {
    console.log(`COMPARE_START ${pair.title}`)
    const task = await runCompare(pair)
    const metrics = metricsFromTask(task)
    compares.push({ pair, task, metrics, needsReview: !metrics.validatorPassed || metrics.score < 85 || metrics.wordCount < 1800 || metrics.wordCount > 3000 || metrics.forbiddenClaims.length > 0 })
    summary.push({
      contentType: 'Compare',
      slug: task.slug,
      ...metrics,
    })
    console.log(`COMPARE_DONE ${task.slug} status=${task.status} score=${metrics.score} passed=${metrics.validatorPassed}`)
  }

  const report = {
    generatedAt: new Date().toISOString(),
    sourceReports,
    guides: guides.map(row => ({
      slug: row.task.slug,
      categorySlug: `${row.category.level1.handle}/${row.category.handle}`,
      score: row.metrics.score,
      wordCount: row.metrics.wordCount,
      status: row.task.status,
      validatorPassed: row.metrics.validatorPassed,
      needsReview: row.needsReview,
      errorMessage: row.task.errorMessage || '',
    })),
    compares: compares.map(row => ({
      slug: row.task.slug,
      title: row.pair.title,
      primaryTool: row.pair.primaryTool.handle,
      secondaryTool: row.pair.secondaryTool.handle,
      score: row.metrics.score,
      wordCount: row.metrics.wordCount,
      status: row.task.status,
      validatorPassed: row.metrics.validatorPassed,
      needsReview: row.needsReview,
      errorMessage: row.task.errorMessage || '',
    })),
    summary,
    failedCount: summary.filter(row => row.status === 'failed' || row.status === 'FAILED' || !row.validatorPassed).length,
    needsReviewCount: [...guides, ...compares].filter(row => row.needsReview).length,
  }

  const outPath = resolve(process.cwd(), 'server', 'storage', `small-batch-content-generation-${nowStamp}.json`)
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')
  console.log(`REPORT ${outPath}`)
  console.log(JSON.stringify({ failedCount: report.failedCount, needsReviewCount: report.needsReviewCount }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
