import { createError } from 'h3'
import prisma from '../../utils/prisma.js'

export const CONTENT_GENERATION_STATUSES = [
  'draft',
  'pending',
  'generating',
  'failed',
  'review',
  'approved',
  'rejected',
  'published',
]

const STATUS_TO_DB = {
  draft: 'DRAFT',
  pending: 'PENDING',
  generating: 'GENERATING',
  failed: 'FAILED',
  review: 'REVIEW',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  published: 'PUBLISHED',
}

const DB_TO_STATUS = Object.fromEntries(
  Object.entries(STATUS_TO_DB).map(([key, value]) => [value, key]),
)

const CONTENT_TYPE_TO_DB = {
  tutorial: 'TUTORIAL',
  comparison: 'COMPARISON',
  alternative: 'ALTERNATIVE',
  category_guide: 'CATEGORY_GUIDE',
  buyer_guide: 'BUYER_GUIDE',
}

const DB_TO_CONTENT_TYPE = Object.fromEntries(
  Object.entries(CONTENT_TYPE_TO_DB).map(([key, value]) => [value, key]),
)

export function isValidContentGenerationStatus(status) {
  return CONTENT_GENERATION_STATUSES.includes(status)
}

function normalizeStatus(status, fallback = 'draft') {
  const raw = String(status || fallback).trim().toLowerCase()
  if (!isValidContentGenerationStatus(raw)) {
    return null
  }
  return raw
}

function toDbStatus(status) {
  const normalized = normalizeStatus(status)
  return normalized ? STATUS_TO_DB[normalized] : null
}

function toDbContentType(value) {
  const raw = String(value || '').trim()
  if (!raw) {
    return 'BUYER_GUIDE'
  }
  const lower = raw.toLowerCase()
  const contentType = CONTENT_TYPE_TO_DB[lower]
  if (!contentType) {
    throw createError({ statusCode: 400, statusMessage: `unsupportedContentType: ${raw}` })
  }
  return contentType
}

function fromDbContentType(value) {
  return DB_TO_CONTENT_TYPE[value] || String(value || '').toLowerCase()
}

function targetTypeForContentType(contentType) {
  return ['COMPARISON', 'ALTERNATIVE'].includes(String(contentType || '').toUpperCase()) ? 'compare' : 'guides'
}

function normalizeJson(value) {
  if (value === undefined || value === '') {
    return null
  }
  return value
}

function metricFromValidation(validationJson, field) {
  if (!validationJson || typeof validationJson !== 'object') return null
  const direct = validationJson[field]
  if (direct !== undefined && direct !== null && direct !== '') return direct
  const metric = validationJson.metrics?.[field]
  return metric !== undefined && metric !== null && metric !== '' ? metric : null
}

function taskToolPair(row) {
  const brief = row.promptJson?.brief && typeof row.promptJson.brief === 'object' ? row.promptJson.brief : {}
  const primaryName = brief.primaryToolName || row.tool?.name || ''
  const secondaryName = brief.secondaryToolName || brief.secondaryTool?.name || ''
  if (primaryName && secondaryName) return `${primaryName} vs ${secondaryName}`
  return brief.comparisonTitle || ''
}

const TASK_RELATIONS = {
  category: { select: { id: true, name: true, handle: true } },
  tool: { select: { id: true, name: true, handle: true } },
}

const BRIEF_FIELDS = [
  'selectedToolIds', 'selectedTools', 'targetKeyword', 'pageGoal', 'searchIntent', 'audience',
  'primaryAudience', 'secondaryAudience', 'decisionCriteria', 'contentContext',
  'primaryToolId', 'tutorialGoal', 'workflowContext', 'prerequisiteKnowledge', 'outputChecklist', 'commonMistakes',
  'secondaryToolId', 'comparisonIntent', 'targetAudience', 'alternativeToolIds', 'reasonToSwitch',
  'selectionCriteria', 'representativeToolIds', 'relatedToolIds', 'sharedUseCases',
  'comparisonDimensions', 'featureComparisonFacts', 'pricingComparisonFacts', 'pricingSummary', 'categoryContext',
  'internalLinks', 'autoSelectSecondaryTool',
]

export function promptJsonWithBrief(input, currentPromptJson = null) {
  const supplied = input.promptJson ?? input.prompt_json
  const current = currentPromptJson && typeof currentPromptJson === 'object' ? currentPromptJson : {}
  const incoming = supplied && typeof supplied === 'object' ? supplied : {}
  const base = { ...current, ...incoming }
  const existingBrief = base.brief && typeof base.brief === 'object'
    ? base.brief
    : base.input && typeof base.input === 'object' ? base.input : {}
  const topLevelBrief = Object.fromEntries(BRIEF_FIELDS
    .filter(field => input[field] !== undefined)
    .map(field => [field, input[field]]))
  const suppliedBrief = supplied?.brief && typeof supplied.brief === 'object'
    ? supplied.brief
    : supplied?.input && typeof supplied.input === 'object' ? supplied.input : {}
  const hasBriefInput = Object.keys(topLevelBrief).length || Object.keys(suppliedBrief).length
  if (!hasBriefInput && supplied === undefined) return currentPromptJson
  const { input: _legacyInput, ...promptMetadata } = base
  return { ...promptMetadata, brief: { ...existingBrief, ...suppliedBrief, ...topLevelBrief } }
}

function validateTaskBrief(contentType, promptJson, categoryId) {
  const type = String(contentType || '').trim().toUpperCase()
  const brief = promptJson?.brief && typeof promptJson.brief === 'object' ? promptJson.brief : {}
  const missing = []
  const requireValue = (field) => {
    const value = brief[field]
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) missing.push(field)
  }
  const requireCount = (field, count) => {
    if (!Array.isArray(brief[field]) || brief[field].length < count) missing.push(`${field}(min:${count})`)
  }

  if (['BUYER_GUIDE', 'CATEGORY_GUIDE', 'TUTORIAL'].includes(type)) {
    for (const field of ['targetKeyword', 'pageGoal', 'searchIntent', 'audience']) requireValue(field)
  }
  if (type === 'BUYER_GUIDE') {
    requireCount('selectedToolIds', 5)
    requireCount('decisionCriteria', 5)
  }
  if (type === 'CATEGORY_GUIDE' && !Number(categoryId)) missing.push('categoryId')
  if (type === 'TUTORIAL') {
    for (const field of ['primaryToolId', 'tutorialGoal', 'workflowContext', 'outputChecklist']) requireValue(field)
  }
  if (type === 'COMPARISON') {
    for (const field of ['primaryToolId', 'secondaryToolId', 'comparisonIntent', 'targetAudience']) requireValue(field)
    requireCount('decisionCriteria', 6)
    if (brief.primaryToolId && Number(brief.primaryToolId) === Number(brief.secondaryToolId)) missing.push('secondaryToolId(distinct)')
  }
  if (type === 'ALTERNATIVE') {
    for (const field of ['primaryToolId', 'reasonToSwitch']) requireValue(field)
    requireCount('alternativeToolIds', 2)
    requireCount('selectionCriteria', 5)
    if ((brief.alternativeToolIds || []).some(id => Number(id) === Number(brief.primaryToolId))) missing.push('alternativeToolIds(excludePrimary)')
  }
  if (missing.length) {
    throw createError({ statusCode: 400, statusMessage: `invalidPromptBrief: ${[...new Set(missing)].join(', ')}` })
  }
}

async function validateCompareToolCategories(contentType, categoryId, toolId, promptJson) {
  const type = String(contentType || '').toUpperCase()
  if (!['COMPARISON', 'ALTERNATIVE'].includes(type)) return
  const normalizedCategoryId = Number(categoryId) || null
  if (!normalizedCategoryId) {
    throw createError({ statusCode: 400, statusMessage: 'Compare 内容必须选择二级分类' })
  }

  const brief = promptJson?.brief && typeof promptJson.brief === 'object' ? promptJson.brief : {}
  const toolIds = [...new Set([
    Number(brief.primaryToolId || toolId) || null,
    type === 'COMPARISON' ? Number(brief.secondaryToolId) || null : null,
    ...(type === 'ALTERNATIVE' ? (brief.alternativeToolIds || []).map(Number) : []),
  ].filter(Boolean))]
  if (!toolIds.length) return

  const assignments = await prisma.aiToolCategory.findMany({
    where: { categoryId: normalizedCategoryId, aiToolId: { in: toolIds } },
    select: { aiToolId: true },
  })
  const assignedIds = new Set(assignments.map(row => row.aiToolId))
  const invalidIds = toolIds.filter(id => !assignedIds.has(id))
  if (invalidIds.length) {
    throw createError({ statusCode: 400, statusMessage: `工具不属于所选二级分类：${invalidIds.join(', ')}` })
  }
}

function normalizeOptionalNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeLimit(value) {
  return Math.min(30, Math.max(1, Number(value) || 5))
}

function actorId(auth) {
  const id = Number(auth?.id ?? auth?.sub)
  return Number.isFinite(id) ? id : null
}

function actorEmail(auth) {
  return typeof auth?.email === 'string' ? auth.email : null
}

function serializeTask(row) {
  if (!row) return null
  const status = DB_TO_STATUS[row.status] || String(row.status || '').toLowerCase()
  const contentType = fromDbContentType(row.contentType)
  return {
    id: row.id,
    title: row.title,
    slug: row.slug || '',
    contentType,
    content_type: contentType,
    targetType: row.targetType || '',
    target_type: row.targetType || '',
    categoryId: row.categoryId,
    category_id: row.categoryId,
    categorySlug: row.category?.handle || '',
    category_slug: row.category?.handle || '',
    toolId: row.toolId,
    tool_id: row.toolId,
    toolPair: taskToolPair(row),
    tool_pair: taskToolPair(row),
    limit: row.limitCount,
    limitCount: row.limitCount,
    limit_count: row.limitCount,
    status,
    contentJson: row.finalContentJson || row.generatedContentJson,
    content_json: row.finalContentJson || row.generatedContentJson,
    generatedContent: row.generatedContentJson,
    generated_content: row.generatedContentJson,
    finalContent: row.finalContentJson,
    final_content: row.finalContentJson,
    sourceDataJson: row.sourceDataJson,
    source_data_json: row.sourceDataJson,
    promptVersionId: row.promptVersionId,
    prompt_version_id: row.promptVersionId,
    promptJson: row.promptJson,
    prompt_json: row.promptJson,
    rawOutput: row.rawOutput || '',
    raw_output: row.rawOutput || '',
    validationJson: row.validationJson,
    validation_json: row.validationJson,
    score: metricFromValidation(row.validationJson, 'score'),
    wordCount: metricFromValidation(row.validationJson, 'wordCount'),
    word_count: metricFromValidation(row.validationJson, 'wordCount'),
    errorMessage: row.errorMessage || '',
    error_message: row.errorMessage || '',
    rejectReason: row.rejectReason || '',
    reject_reason: row.rejectReason || '',
    contentPageId: row.contentPageId,
    content_page_id: row.contentPageId,
    createdByUserId: row.createdByAdminId,
    createdByAdminId: row.createdByAdminId,
    created_by_admin_id: row.createdByAdminId,
    approvedByAdminId: row.approvedByAdminId,
    rejectedByAdminId: row.rejectedByAdminId,
    publishedByAdminId: row.publishedByAdminId,
    generatedAt: row.generatedAt,
    generated_at: row.generatedAt,
    approvedAt: row.approvedAt,
    approved_at: row.approvedAt,
    rejectedAt: row.rejectedAt,
    rejected_at: row.rejectedAt,
    publishedAt: row.publishedAt,
    published_at: row.publishedAt,
    createdAt: row.createdAt,
    created_at: row.createdAt,
    updatedAt: row.updatedAt,
    updated_at: row.updatedAt,
  }
}

async function createTaskEvent(tx, taskId, {
  auth,
  eventType,
  fromStatus,
  toStatus,
  message = '',
  payload,
} = {}) {
  await tx.contentGenerationTaskEvent.create({
    data: {
      taskId: Number(taskId),
      actorAdminId: actorId(auth),
      actorEmail: actorEmail(auth),
      eventType,
      fromStatus: fromStatus ? toDbStatus(fromStatus) : null,
      toStatus: toStatus ? toDbStatus(toStatus) : null,
      message,
      payload: normalizeJson(payload),
    },
  })
}

export async function listContentGenerationTasks({ page = 1, pageSize = 20, status = '', keyword = '' } = {}) {
  const safePage = Math.max(1, Number(page) || 1)
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 20))
  const normalizedStatus = status ? normalizeStatus(status) : ''
  const q = String(keyword || '').trim()

  const where = {
    ...(normalizedStatus ? { status: STATUS_TO_DB[normalizedStatus] } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
            { targetType: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.contentGenerationTask.count({ where }),
    prisma.contentGenerationTask.findMany({
      where,
      include: TASK_RELATIONS,
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
      orderBy: { updatedAt: 'desc' },
    }),
  ])

  return {
    data: rows.map(serializeTask),
    total,
    page: safePage,
    pageSize: safePageSize,
  }
}

export async function getContentGenerationTask(id) {
  const row = await prisma.contentGenerationTask.findUnique({
    where: { id: Number(id) },
    include: TASK_RELATIONS,
  })
  return serializeTask(row)
}

export async function listContentGenerationTasksByIds(ids = []) {
  const normalizedIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)))]
  if (!normalizedIds.length) {
    return []
  }

  const rows = await prisma.contentGenerationTask.findMany({
    where: { id: { in: normalizedIds } },
    include: TASK_RELATIONS,
  })
  return rows.map(serializeTask)
}

export async function createContentGenerationTask(input, auth) {
  const status = normalizeStatus(input.status || 'draft')
  if (!status) {
    throw createError({ statusCode: 400, statusMessage: '任务状态无效' })
  }
  const contentType = toDbContentType(input.contentType || input.content_type)
  const title = String(input.title || '').trim() || `${contentType} draft`
  const categoryId = normalizeOptionalNumber(input.categoryId ?? input.category_id)
  const promptJson = promptJsonWithBrief(input)
  if (status !== 'draft' && promptJson?.brief && Object.keys(promptJson.brief).length) {
    validateTaskBrief(contentType, promptJson, categoryId)
  }
  const toolId = normalizeOptionalNumber(input.toolId ?? input.tool_id)
  await validateCompareToolCategories(contentType, categoryId, toolId, promptJson)

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.contentGenerationTask.create({
      data: {
        title,
        slug: String(input.slug || '').trim() || null,
        contentType,
        targetType: targetTypeForContentType(contentType),
        categoryId,
        toolId,
        limitCount: normalizeLimit(input.limit ?? input.limitCount ?? input.limit_count),
        status: STATUS_TO_DB[status],
        sourceDataJson: normalizeJson(input.sourceDataJson ?? input.source_data_json),
        promptVersionId: normalizeOptionalNumber(input.promptVersionId ?? input.prompt_version_id),
        promptJson: normalizeJson(promptJson),
        rawOutput: typeof input.rawOutput === 'string' ? input.rawOutput : '',
        generatedContentJson: normalizeJson(input.generatedContent ?? input.generated_content),
        finalContentJson: normalizeJson(input.finalContent ?? input.final_content ?? input.contentJson ?? input.content_json),
        validationJson: normalizeJson(input.validationJson ?? input.validation_json),
        errorMessage: typeof input.errorMessage === 'string' ? input.errorMessage : '',
        createdByAdminId: actorId(auth),
      },
    })
    await createTaskEvent(tx, row.id, {
      auth,
      eventType: 'created',
      toStatus: status,
      message: 'Task created',
      payload: { title: row.title },
    })
    return row
  })

  return serializeTask(created)
}

export async function updateContentGenerationTask(id, input, auth) {
  const current = await prisma.contentGenerationTask.findUnique({ where: { id: Number(id) } })
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: '任务不存在' })
  }

  const data = {}
  if (input.title !== undefined) data.title = String(input.title || '').trim()
  if (input.slug !== undefined) data.slug = String(input.slug || '').trim() || null
  if (input.contentType !== undefined || input.content_type !== undefined) {
    data.contentType = toDbContentType(input.contentType ?? input.content_type)
  }
  if (input.targetType !== undefined || input.target_type !== undefined) {
    data.targetType = targetTypeForContentType(data.contentType || current.contentType)
  }
  else if (data.contentType !== undefined) {
    data.targetType = targetTypeForContentType(data.contentType)
  }
  if (input.categoryId !== undefined || input.category_id !== undefined) {
    data.categoryId = normalizeOptionalNumber(input.categoryId ?? input.category_id)
  }
  if (input.toolId !== undefined || input.tool_id !== undefined) {
    data.toolId = normalizeOptionalNumber(input.toolId ?? input.tool_id)
  }
  if (input.limit !== undefined || input.limitCount !== undefined || input.limit_count !== undefined) {
    data.limitCount = normalizeLimit(input.limit ?? input.limitCount ?? input.limit_count)
  }
  if (input.contentJson !== undefined || input.content_json !== undefined) {
    data.finalContentJson = normalizeJson(input.contentJson ?? input.content_json)
  }
  if (input.generatedContent !== undefined || input.generated_content !== undefined) {
    data.generatedContentJson = normalizeJson(input.generatedContent ?? input.generated_content)
  }
  if (input.finalContent !== undefined || input.final_content !== undefined) {
    data.finalContentJson = normalizeJson(input.finalContent ?? input.final_content)
  }
  if (input.sourceDataJson !== undefined || input.source_data_json !== undefined) {
    data.sourceDataJson = normalizeJson(input.sourceDataJson ?? input.source_data_json)
  }
  if (input.promptJson !== undefined || input.prompt_json !== undefined || BRIEF_FIELDS.some(field => input[field] !== undefined)) {
    data.promptJson = normalizeJson(promptJsonWithBrief(input, current.promptJson))
  }
  if (input.promptVersionId !== undefined || input.prompt_version_id !== undefined) {
    data.promptVersionId = normalizeOptionalNumber(input.promptVersionId ?? input.prompt_version_id)
  }
  if (input.rawOutput !== undefined || input.raw_output !== undefined) {
    data.rawOutput = String((input.rawOutput ?? input.raw_output) || '')
  }
  if (input.validationJson !== undefined || input.validation_json !== undefined) {
    data.validationJson = normalizeJson(input.validationJson ?? input.validation_json)
  }
  if (input.rejectReason !== undefined || input.reject_reason !== undefined) {
    data.rejectReason = String((input.rejectReason ?? input.reject_reason) || '')
  }
  if (input.errorMessage !== undefined || input.error_message !== undefined) {
    data.errorMessage = String((input.errorMessage ?? input.error_message) || '')
  }
  if (!Object.keys(data).length) {
    return serializeTask(current)
  }
  if ((data.promptJson?.brief && Object.keys(data.promptJson.brief).length) || (data.contentType !== undefined && current.promptJson?.brief)) {
    validateTaskBrief(data.contentType || current.contentType, data.promptJson ?? current.promptJson, data.categoryId ?? current.categoryId)
  }
  const compareSelectionChanged = ['contentType', 'categoryId', 'toolId', 'promptJson'].some(field => data[field] !== undefined)
  if (compareSelectionChanged) {
    await validateCompareToolCategories(
      data.contentType || current.contentType,
      data.categoryId !== undefined ? data.categoryId : current.categoryId,
      data.toolId !== undefined ? data.toolId : current.toolId,
      data.promptJson !== undefined ? data.promptJson : current.promptJson,
    )
  }
  if (data.title !== undefined && !data.title) {
    throw createError({ statusCode: 400, statusMessage: '任务标题必填' })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.contentGenerationTask.update({
      where: { id: Number(id) },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })
    await createTaskEvent(tx, row.id, {
      auth,
      eventType: 'updated',
      fromStatus: DB_TO_STATUS[current.status],
      toStatus: DB_TO_STATUS[row.status],
      message: 'Task updated',
      payload: { fields: Object.keys(data) },
    })
    return row
  }, { maxWait: 10000, timeout: 30000 })

  return serializeTask(updated)
}

export async function updateContentGenerationTaskStatus(id, status, auth) {
  const normalizedStatus = normalizeStatus(status)
  if (!normalizedStatus) {
    throw createError({ statusCode: 400, statusMessage: '任务状态无效' })
  }

  const current = await prisma.contentGenerationTask.findUnique({ where: { id: Number(id) } })
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: '任务不存在' })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.contentGenerationTask.update({
      where: { id: Number(id) },
      data: {
        status: STATUS_TO_DB[normalizedStatus],
        updatedAt: new Date(),
      },
    })
    await createTaskEvent(tx, row.id, {
      auth,
      eventType: 'status_changed',
      fromStatus: DB_TO_STATUS[current.status],
      toStatus: normalizedStatus,
      message: 'Task status changed',
    })
    return row
  })

  return serializeTask(updated)
}

export async function saveContentGenerationTaskGenerationResult(id, input, auth) {
  const normalizedStatus = normalizeStatus(input.status)
  if (!normalizedStatus) {
    throw createError({ statusCode: 400, statusMessage: '任务状态无效' })
  }

  const current = await prisma.contentGenerationTask.findUnique({ where: { id: Number(id) } })
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: '任务不存在' })
  }

  const errorMessage = typeof input.errorMessage === 'string' ? input.errorMessage : ''
  const now = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.contentGenerationTask.update({
      where: { id: Number(id) },
      data: {
        status: STATUS_TO_DB[normalizedStatus],
        generatedContentJson: input.contentJson !== undefined ? normalizeJson(input.contentJson) : current.generatedContentJson,
        finalContentJson: input.contentJson !== undefined ? normalizeJson(input.contentJson) : current.finalContentJson,
        sourceDataJson: input.sourceDataJson !== undefined ? normalizeJson(input.sourceDataJson) : current.sourceDataJson,
        promptVersionId: input.promptVersionId !== undefined
          ? normalizeOptionalNumber(input.promptVersionId)
          : current.promptVersionId,
        promptJson: input.promptJson !== undefined ? normalizeJson(input.promptJson) : current.promptJson,
        rawOutput: input.rawOutput !== undefined ? String(input.rawOutput || '') : current.rawOutput,
        validationJson: input.validationJson !== undefined ? normalizeJson(input.validationJson) : current.validationJson,
        errorMessage,
        generatedAt: normalizedStatus === 'review' || normalizedStatus === 'failed' ? now : current.generatedAt,
        updatedAt: now,
      },
    })
    await createTaskEvent(tx, row.id, {
      auth,
      eventType: normalizedStatus === 'failed' ? 'generation_failed' : 'generated',
      fromStatus: DB_TO_STATUS[current.status],
      toStatus: normalizedStatus,
      message: errorMessage || 'Generation completed',
      payload: {
        hasRawOutput: Boolean(row.rawOutput),
        validation: row.validationJson,
      },
    })
    return row
  }, { maxWait: 10000, timeout: 30000 })

  return serializeTask(updated)
}

export async function approveContentGenerationTask(id, auth) {
  const current = await prisma.contentGenerationTask.findUnique({ where: { id: Number(id) } })
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: '任务不存在' })
  }
  if (current.status !== 'REVIEW') {
    throw createError({ statusCode: 400, statusMessage: '只有待审核内容可以审核通过' })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.contentGenerationTask.update({
      where: { id: Number(id) },
      data: {
        status: 'APPROVED',
        approvedByAdminId: actorId(auth),
        approvedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    await createTaskEvent(tx, row.id, {
      auth,
      eventType: 'approved',
      fromStatus: 'review',
      toStatus: 'approved',
      message: 'Task approved',
    })
    return row
  })

  return serializeTask(updated)
}

export async function rejectContentGenerationTask(id, reason, auth) {
  const current = await prisma.contentGenerationTask.findUnique({ where: { id: Number(id) } })
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: '任务不存在' })
  }
  const rejectReason = String(reason || '').trim()
  if (!rejectReason) {
    throw createError({ statusCode: 400, statusMessage: '请填写驳回原因' })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.contentGenerationTask.update({
      where: { id: Number(id) },
      data: {
        status: 'REJECTED',
        rejectReason,
        rejectedByAdminId: actorId(auth),
        rejectedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    await createTaskEvent(tx, row.id, {
      auth,
      eventType: 'rejected',
      fromStatus: DB_TO_STATUS[current.status],
      toStatus: 'rejected',
      message: rejectReason,
    })
    return row
  })

  return serializeTask(updated)
}

export async function markContentGenerationTaskPublished(id, publishedContent, auth, contentPageId = null, typedWriteStatus = null) {
  const current = await prisma.contentGenerationTask.findUnique({ where: { id: Number(id) } })
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: '任务不存在' })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.contentGenerationTask.update({
      where: { id: Number(id) },
      data: {
        status: 'PUBLISHED',
        finalContentJson: normalizeJson(publishedContent),
        validationJson: normalizeJson({
          ...(current.validationJson && typeof current.validationJson === 'object' ? current.validationJson : {}),
          typedWriteStatus,
        }),
        contentPageId: contentPageId || current.contentPageId,
        publishedByAdminId: actorId(auth),
        publishedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    await createTaskEvent(tx, row.id, {
      auth,
      eventType: 'published',
      fromStatus: DB_TO_STATUS[current.status],
      toStatus: 'published',
      message: 'Task published',
      payload: { contentPageId: row.contentPageId, typedWriteStatus },
    })
    return row
  }, { maxWait: 10000, timeout: 30000 })

  return serializeTask(updated)
}

const MAX_BATCH_DELETE = 50

function normalizeTaskIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id)))]
}

function assertTasksDeletable(rows) {
  const generating = rows.filter((row) => {
    const status = DB_TO_STATUS[row.status] || String(row.status || '').toLowerCase()
    return status === 'generating'
  })
  if (generating.length) {
    throw createError({
      statusCode: 400,
      statusMessage: `生成中的任务不能删除：${generating.map(row => row.id).join(', ')}`,
    })
  }
}

async function deleteLinkedContentPages(tx, contentPageIds = []) {
  const uniqueIds = [...new Set(contentPageIds.map(Number).filter(Boolean))]
  if (!uniqueIds.length) return []

  await tx.contentGenerationTask.updateMany({
    where: { contentPageId: { in: uniqueIds } },
    data: { contentPageId: null },
  })
  await tx.contentPage.deleteMany({ where: { id: { in: uniqueIds } } })
  return uniqueIds
}

export async function deleteContentGenerationTask(id, auth) {
  const taskId = Number(id)
  if (!Number.isFinite(taskId)) {
    throw createError({ statusCode: 400, statusMessage: '任务 ID 无效' })
  }

  const task = await prisma.contentGenerationTask.findUnique({ where: { id: taskId } })
  if (!task) {
    throw createError({ statusCode: 404, statusMessage: '任务不存在' })
  }
  assertTasksDeletable([task])

  const deletedContentPageIds = await prisma.$transaction(async (tx) => {
    const pageIds = await deleteLinkedContentPages(tx, task.contentPageId ? [task.contentPageId] : [])
    await tx.contentGenerationTask.delete({ where: { id: taskId } })
    return pageIds
  }, { maxWait: 10000, timeout: 30000 })

  return {
    ok: true,
    id: taskId,
    deletedContentPageIds,
    deletedByAdminId: actorId(auth),
  }
}

export async function batchDeleteContentGenerationTasks(input, auth) {
  const ids = normalizeTaskIds(input?.ids)
  if (!ids.length) {
    throw createError({ statusCode: 400, statusMessage: '请选择需要删除的任务' })
  }
  if (ids.length > MAX_BATCH_DELETE) {
    throw createError({ statusCode: 400, statusMessage: `单次最多删除 ${MAX_BATCH_DELETE} 个任务` })
  }

  const rows = await prisma.contentGenerationTask.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true, contentPageId: true, title: true },
  })
  const foundIds = new Set(rows.map(row => row.id))
  const missingIds = ids.filter(id => !foundIds.has(id))
  if (missingIds.length) {
    throw createError({ statusCode: 404, statusMessage: `任务不存在：${missingIds.join(', ')}` })
  }

  assertTasksDeletable(rows)

  const contentPageIds = rows.map(row => row.contentPageId).filter(Boolean)
  const deletedContentPageIds = await prisma.$transaction(async (tx) => {
    const pageIds = await deleteLinkedContentPages(tx, contentPageIds)
    await tx.contentGenerationTask.deleteMany({ where: { id: { in: ids } } })
    return pageIds
  }, { maxWait: 10000, timeout: 30000 })

  return {
    ok: true,
    total: ids.length,
    deleted: ids.length,
    deletedContentPageIds,
    deletedByAdminId: actorId(auth),
    results: ids.map((id) => {
      const row = rows.find(item => item.id === id)
      return {
        id,
        ok: true,
        title: row?.title || '',
        hadPublishedPage: Boolean(row?.contentPageId),
      }
    }),
  }
}
