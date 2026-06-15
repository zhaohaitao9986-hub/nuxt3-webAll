import { createError } from 'h3'
import prisma from '../../utils/prisma.js'
import { prepareDeterministicBrief } from './briefBuilder.js'
import { createContentGenerationTask } from './taskStore.js'
import { slugify, uniqueContentGenerationSlug } from './slugUtils.js'

const MAX_BATCH_CREATE = 50
const ACTIVE_TASK_STATUSES = ['DRAFT', 'PENDING', 'GENERATING', 'REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED']

function linesFromInput(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, MAX_BATCH_CREATE)
}

function resultItem(input, status, extra = {}) {
  return { input, status, taskId: null, title: '', slug: '', reason: '', ...extra }
}

function parseToolPair(input) {
  const parts = String(input || '')
    .split(/\s+vs\s+|,|\|/i)
    .map(part => part.trim())
    .filter(Boolean)
  return parts.length === 2 ? parts : null
}

async function findToolByNameOrHandle(value) {
  const raw = String(value || '').trim()
  const lower = raw.toLowerCase()
  const slug = slugify(raw)
  if (!raw) return null

  const exact = await prisma.aiTool.findFirst({
    where: {
      toolStatus: { in: ['ONLINE', 'ACTIVE'] },
      OR: [
        { name: { equals: raw, mode: 'insensitive' } },
        { handle: { equals: lower, mode: 'insensitive' } },
        { handle: { equals: slug, mode: 'insensitive' } },
      ],
    },
    orderBy: [{ rank: 'asc' }, { id: 'asc' }],
    include: { toolCategories: { select: { categoryId: true } } },
  })
  if (exact) return exact

  return prisma.aiTool.findFirst({
    where: {
      toolStatus: { in: ['ONLINE', 'ACTIVE'] },
      OR: [
        { name: { startsWith: raw, mode: 'insensitive' } },
        { name: { contains: raw, mode: 'insensitive' } },
      ],
    },
    orderBy: [{ rank: 'asc' }, { id: 'asc' }],
    include: { toolCategories: { select: { categoryId: true } } },
  })
}

function commonCategoryId(primary, secondary) {
  const secondaryIds = new Set((secondary.toolCategories || []).map(row => Number(row.categoryId)))
  const common = (primary.toolCategories || []).find(row => secondaryIds.has(Number(row.categoryId)))
  return common?.categoryId || null
}

async function guideAlreadyExists(categoryId) {
  return prisma.contentGenerationTask.findFirst({
    where: {
      contentType: 'BUYER_GUIDE',
      categoryId: Number(categoryId),
      status: { in: ACTIVE_TASK_STATUSES },
    },
    select: { id: true, title: true, slug: true },
  })
}

function unorderedPairKey(a, b) {
  return [Number(a), Number(b)].sort((x, y) => x - y).join(':')
}

async function comparisonAlreadyExists(primaryId, secondaryId) {
  const target = unorderedPairKey(primaryId, secondaryId)
  const rows = await prisma.contentGenerationTask.findMany({
    where: {
      contentType: 'COMPARISON',
      status: { in: ACTIVE_TASK_STATUSES },
    },
    select: { id: true, title: true, slug: true, toolId: true, promptJson: true },
  })
  return rows.find((row) => {
    const brief = row.promptJson?.brief && typeof row.promptJson.brief === 'object' ? row.promptJson.brief : {}
    const primary = Number(brief.primaryToolId || row.toolId) || null
    const secondary = Number(brief.secondaryToolId) || null
    return primary && secondary && unorderedPairKey(primary, secondary) === target
  }) || null
}

async function createPreparedTask({ contentType, categoryId, toolId, limitCount, generationMode, brief, auth }) {
  const slug = await uniqueContentGenerationSlug(brief.slug || brief.targetKeyword || brief.title, { contentType })
  return createContentGenerationTask({
    title: brief.title,
    slug,
    contentType,
    categoryId,
    toolId,
    limit: limitCount,
    status: 'draft',
    promptJson: {
      generationMode,
      brief: { ...brief, slug },
      briefPreparedAt: new Date().toISOString(),
      briefPreparedBy: 'batch-create',
    },
    sourceDataJson: null,
    validationJson: null,
    errorMessage: '',
    generatedContent: null,
    finalContent: null,
  }, auth)
}

async function createGuide(input, options, auth) {
  const category = await prisma.categoryLevel2.findFirst({
    where: { handle: input },
    select: { id: true, name: true, handle: true },
  })
  if (!category) return resultItem(input, 'failed', { reason: 'category_not_found' })

  const duplicate = await guideAlreadyExists(category.id)
  if (duplicate) {
    return resultItem(input, 'skipped', {
      taskId: duplicate.id,
      title: duplicate.title,
      slug: duplicate.slug || '',
      reason: 'duplicate_category_buyer_guide',
    })
  }

  const brief = await prepareDeterministicBrief({
    contentType: 'BUYER_GUIDE',
    categoryId: category.id,
    limit: options.limitCount,
    promptJson: { generationMode: options.generationMode, brief: {} },
  })
  const task = await createPreparedTask({
    contentType: 'BUYER_GUIDE',
    categoryId: category.id,
    toolId: null,
    limitCount: options.limitCount,
    generationMode: options.generationMode,
    brief,
    auth,
  })
  return resultItem(input, 'created', {
    taskId: task.id,
    title: task.title,
    slug: task.slug,
    reason: 'created_and_brief_prepared',
  })
}

async function createComparison(input, options, auth) {
  const parsed = parseToolPair(input)
  if (!parsed) return resultItem(input, 'failed', { reason: 'invalid_pair_format' })

  const [primaryName, secondaryName] = parsed
  const [primary, secondary] = await Promise.all([
    findToolByNameOrHandle(primaryName),
    findToolByNameOrHandle(secondaryName),
  ])
  if (!primary) return resultItem(input, 'failed', { reason: `primary_tool_not_found: ${primaryName}` })
  if (!secondary) return resultItem(input, 'failed', { reason: `secondary_tool_not_found: ${secondaryName}` })
  if (Number(primary.id) === Number(secondary.id)) return resultItem(input, 'failed', { reason: 'duplicate_tool_pair' })

  const duplicate = await comparisonAlreadyExists(primary.id, secondary.id)
  if (duplicate) {
    return resultItem(input, 'skipped', {
      taskId: duplicate.id,
      title: duplicate.title,
      slug: duplicate.slug || '',
      reason: 'duplicate_comparison_pair',
    })
  }

  const categoryId = commonCategoryId(primary, secondary)
  if (!categoryId) return resultItem(input, 'failed', { reason: 'no_shared_category' })

  const brief = await prepareDeterministicBrief({
    contentType: 'COMPARISON',
    categoryId,
    toolId: primary.id,
    limit: options.limitCount,
    promptJson: {
      generationMode: options.generationMode,
      brief: { secondaryToolId: secondary.id },
    },
  })
  const enrichedBrief = {
    ...brief,
    primaryToolName: primary.name,
    secondaryToolName: secondary.name,
  }
  const task = await createPreparedTask({
    contentType: 'COMPARISON',
    categoryId,
    toolId: primary.id,
    limitCount: options.limitCount,
    generationMode: options.generationMode,
    brief: enrichedBrief,
    auth,
  })
  return resultItem(input, 'created', {
    taskId: task.id,
    title: task.title,
    slug: task.slug,
    reason: 'created_and_brief_prepared',
  })
}

export async function batchCreateTasksWithBrief(input, auth) {
  const taskType = String(input?.taskType || input?.type || '').trim().toLowerCase()
  if (!['guide', 'compare'].includes(taskType)) {
    throw createError({ statusCode: 400, statusMessage: 'taskType must be Guide or Compare' })
  }

  const rows = linesFromInput(input?.items || input?.text || input?.input)
  if (!rows.length) {
    throw createError({ statusCode: 400, statusMessage: 'batch input is empty' })
  }

  const options = {
    limitCount: Math.min(30, Math.max(1, Number(input?.limitCount || input?.limit || 5))),
    generationMode: String(input?.generationMode || 'production-seo-draft').trim() || 'production-seo-draft',
  }

  const createdItems = []
  const skippedItems = []
  const failedItems = []

  for (const row of rows) {
    try {
      const result = taskType === 'guide'
        ? await createGuide(row, options, auth)
        : await createComparison(row, options, auth)
      if (result.status === 'created') createdItems.push(result)
      else if (result.status === 'skipped') skippedItems.push(result)
      else failedItems.push(result)
    }
    catch (error) {
      failedItems.push(resultItem(row, 'failed', {
        reason: error?.statusMessage || error?.message || String(error),
      }))
    }
  }

  return {
    createdItems,
    skippedItems,
    failedItems,
    summary: {
      total: rows.length,
      created: createdItems.length,
      skipped: skippedItems.length,
      failed: failedItems.length,
    },
  }
}
