import { createError } from 'h3'
import prisma from '~/server/utils/prisma'

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

function normalizeJson(value) {
  if (value === undefined || value === '') {
    return null
  }
  return value
}

function normalizeOptionalNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeLimit(value) {
  return Math.min(30, Math.max(1, Number(value) || 10))
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
    toolId: row.toolId,
    tool_id: row.toolId,
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
  })
  return rows.map(serializeTask)
}

export async function createContentGenerationTask(input, auth) {
  const title = String(input.title || '').trim()
  if (!title) {
    throw createError({ statusCode: 400, statusMessage: '任务标题必填' })
  }

  const status = normalizeStatus(input.status || 'draft')
  if (!status) {
    throw createError({ statusCode: 400, statusMessage: '任务状态无效' })
  }

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.contentGenerationTask.create({
      data: {
        title,
        slug: String(input.slug || '').trim() || null,
        contentType: toDbContentType(input.contentType || input.content_type),
        targetType: String(input.targetType || input.target_type || '').trim() || null,
        categoryId: normalizeOptionalNumber(input.categoryId ?? input.category_id),
        toolId: normalizeOptionalNumber(input.toolId ?? input.tool_id),
        limitCount: normalizeLimit(input.limit ?? input.limitCount ?? input.limit_count),
        status: STATUS_TO_DB[status],
        sourceDataJson: normalizeJson(input.sourceDataJson ?? input.source_data_json),
        promptVersionId: normalizeOptionalNumber(input.promptVersionId ?? input.prompt_version_id),
        promptJson: normalizeJson(input.promptJson ?? input.prompt_json),
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
    data.targetType = String((input.targetType ?? input.target_type) || '').trim() || null
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
  if (input.promptJson !== undefined || input.prompt_json !== undefined) {
    data.promptJson = normalizeJson(input.promptJson ?? input.prompt_json)
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
  if (input.errorMessage !== undefined || input.error_message !== undefined) {
    data.errorMessage = String((input.errorMessage ?? input.error_message) || '')
  }
  if (!Object.keys(data).length) {
    return serializeTask(current)
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
