import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const STORE_FILE = join(process.cwd(), 'server', 'storage', 'published-content-pages.json')

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

export async function upsertPublishedContentFromTask(task, content) {
  const rows = await readRows()
  const meta = content.contentPage || {}
  const canonicalPath = meta.canonicalPath || `/${task.targetType || 'content'}/${meta.slug || task.slug}`
  const now = new Date().toISOString()
  const existingIndex = rows.findIndex((row) => row.canonicalPath === canonicalPath)
  const payload = {
    id: existingIndex >= 0 ? rows[existingIndex].id : nextId(rows),
    taskId: task.id,
    type: meta.type || task.contentType,
    title: meta.title || task.title,
    slug: meta.slug || task.slug,
    canonicalPath,
    metaTitle: meta.metaTitle || meta.meta_title,
    metaDescription: meta.metaDescription || meta.meta_description,
    content,
    status: 'published',
    publishedAt: now,
    updatedAt: now,
    createdAt: existingIndex >= 0 ? rows[existingIndex].createdAt : now,
  }

  if (existingIndex >= 0) {
    rows[existingIndex] = payload
  }
  else {
    rows.unshift(payload)
  }
  await writeRows(rows)
  return payload
}
