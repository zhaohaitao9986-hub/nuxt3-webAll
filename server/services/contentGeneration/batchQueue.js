import { createError } from 'h3'
import { generateContentForTask } from './generator'
import { listContentGenerationTasksByIds } from './taskStore'

const MAX_BATCH_SIZE = 20
const MAX_CONCURRENCY = 3

function normalizeIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id)))]
}

export async function batchGenerateContentTasks(input, event) {
  const ids = normalizeIds(input?.ids)
  if (!ids.length) {
    throw createError({ statusCode: 400, statusMessage: '请选择需要批量生成的任务' })
  }
  if (ids.length > MAX_BATCH_SIZE) {
    throw createError({ statusCode: 400, statusMessage: `单次最多批量生成 ${MAX_BATCH_SIZE} 个任务` })
  }

  const rows = await listContentGenerationTasksByIds(ids)
  const foundIds = new Set(rows.map((row) => Number(row.id)))
  const missingIds = ids.filter((id) => !foundIds.has(id))
  if (missingIds.length) {
    throw createError({ statusCode: 404, statusMessage: `任务不存在：${missingIds.join(', ')}` })
  }

  const concurrency = Math.min(MAX_CONCURRENCY, Math.max(1, Number(input?.concurrency) || 2))
  const results = []
  let cursor = 0

  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor]
      cursor += 1
      try {
        const task = await generateContentForTask(id, event)
        results.push({
          id,
          ok: true,
          status: task.status,
          title: task.title,
        })
      }
      catch (error) {
        results.push({
          id,
          ok: false,
          status: 'failed',
          errorMessage: error?.statusMessage || error?.message || String(error),
        })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, () => worker()))

  return {
    total: ids.length,
    success: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results: ids.map((id) => results.find((item) => item.id === id)).filter(Boolean),
  }
}
