import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createError } from 'h3'

const STORE_FILE = join(process.cwd(), 'server', 'storage', 'content-generation-tasks.json')

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

export function isValidContentGenerationStatus(status) {
  return CONTENT_GENERATION_STATUSES.includes(status)
}

async function readRows() {
  try {
    const raw = await readFile(STORE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  }
  catch (error) {
    if (error?.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

async function writeRows(rows) {
  await mkdir(dirname(STORE_FILE), { recursive: true })
  await writeFile(STORE_FILE, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function nextId(rows) {
  return rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1
}

function normalizeJson(value) {
  if (value === undefined || value === '') {
    return null
  }
  return value
}

export async function listContentGenerationTasks({ page = 1, pageSize = 20, status = '', keyword = '' } = {}) {
  const rows = await readRows()
  const q = String(keyword || '').trim().toLowerCase()
  const filtered = rows.filter((row) => {
    if (status && row.status !== status) {
      return false
    }
    if (!q) {
      return true
    }
    return [row.title, row.slug, row.contentType, row.targetType]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q))
  })
  const safePage = Math.max(1, Number(page) || 1)
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 20))
  const start = (safePage - 1) * safePageSize

  return {
    data: filtered.slice(start, start + safePageSize),
    total: filtered.length,
    page: safePage,
    pageSize: safePageSize,
  }
}

export async function getContentGenerationTask(id) {
  const rows = await readRows()
  return rows.find((row) => Number(row.id) === Number(id)) || null
}

export async function createContentGenerationTask(input, auth) {
  const rows = await readRows()
  const now = new Date().toISOString()
  const title = String(input.title || '').trim()
  if (!title) {
    throw createError({ statusCode: 400, statusMessage: '任务标题必填' })
  }

  const status = input.status || 'draft'
  if (!isValidContentGenerationStatus(status)) {
    throw createError({ statusCode: 400, statusMessage: '任务状态无效' })
  }

  const row = {
    id: nextId(rows),
    title,
    slug: String(input.slug || '').trim(),
    contentType: String(input.contentType || '').trim(),
    targetType: String(input.targetType || '').trim(),
    status,
    contentJson: normalizeJson(input.contentJson),
    sourceDataJson: normalizeJson(input.sourceDataJson),
    rawOutput: typeof input.rawOutput === 'string' ? input.rawOutput : '',
    validationJson: normalizeJson(input.validationJson),
    errorMessage: typeof input.errorMessage === 'string' ? input.errorMessage : '',
    createdByUserId: auth?.id ?? null,
    createdByEmail: auth?.email || '',
    createdAt: now,
    updatedAt: now,
  }

  rows.unshift(row)
  await writeRows(rows)
  return row
}

export async function updateContentGenerationTask(id, input) {
  const rows = await readRows()
  const index = rows.findIndex((row) => Number(row.id) === Number(id))
  if (index < 0) {
    throw createError({ statusCode: 404, statusMessage: '任务不存在' })
  }

  const current = rows[index]
  const next = {
    ...current,
    title: input.title !== undefined ? String(input.title || '').trim() : current.title,
    slug: input.slug !== undefined ? String(input.slug || '').trim() : current.slug,
    contentType: input.contentType !== undefined ? String(input.contentType || '').trim() : current.contentType,
    targetType: input.targetType !== undefined ? String(input.targetType || '').trim() : current.targetType,
    contentJson: input.contentJson !== undefined ? normalizeJson(input.contentJson) : current.contentJson,
    sourceDataJson: input.sourceDataJson !== undefined ? normalizeJson(input.sourceDataJson) : current.sourceDataJson,
    rawOutput: input.rawOutput !== undefined ? String(input.rawOutput || '') : current.rawOutput,
    validationJson: input.validationJson !== undefined ? normalizeJson(input.validationJson) : current.validationJson,
    errorMessage: input.errorMessage !== undefined ? String(input.errorMessage || '') : current.errorMessage,
    updatedAt: new Date().toISOString(),
  }

  if (!next.title) {
    throw createError({ statusCode: 400, statusMessage: '任务标题必填' })
  }

  rows[index] = next
  await writeRows(rows)
  return next
}

export async function updateContentGenerationTaskStatus(id, status) {
  if (!isValidContentGenerationStatus(status)) {
    throw createError({ statusCode: 400, statusMessage: '任务状态无效' })
  }

  const rows = await readRows()
  const index = rows.findIndex((row) => Number(row.id) === Number(id))
  if (index < 0) {
    throw createError({ statusCode: 404, statusMessage: '任务不存在' })
  }

  rows[index] = {
    ...rows[index],
    status,
    updatedAt: new Date().toISOString(),
  }
  await writeRows(rows)
  return rows[index]
}
