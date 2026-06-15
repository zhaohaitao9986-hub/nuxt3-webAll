import { createError } from 'h3'
import { generateContentForTask } from './generator.js'
import { listContentGenerationTasksByIds, updateContentGenerationTask } from './taskStore.js'

const MAX_BATCH_SIZE = 20
const ALLOWED_BATCH_STATUSES = new Set(['draft', 'pending', 'review_queue', 'failed'])

function normalizeIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id)))]
}

export async function batchGenerateContentTasks(input, event, auth) {
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

  const results = []
  const rowById = new Map(rows.map(row => [Number(row.id), row]))

  for (const id of ids) {
    const row = rowById.get(Number(id))
    const brief = row?.promptJson?.brief && typeof row.promptJson.brief === 'object' ? row.promptJson.brief : null
    if (!ALLOWED_BATCH_STATUSES.has(row?.status) || !brief || !Object.keys(brief).length) {
      results.push({
        id,
        taskId: id,
        ok: false,
        skipped: true,
        contentType: row?.contentType || '',
        title: row?.title || '',
        slug: row?.slug || '',
        status: row?.status || 'skipped',
        errorMessage: !brief ? 'missing_brief' : `status_not_allowed: ${row?.status || 'unknown'}`,
        warnings: [],
      })
      continue
    }

    try {
      await updateContentGenerationTask(id, {
        errorMessage: '',
        rejectReason: '',
        validationJson: null,
        sourceDataJson: null,
        contentJson: null,
        generatedContent: null,
        finalContent: null,
        rawOutput: '',
      }, auth)
      const task = await generateContentForTask(id, event, auth)
      const validation = task.validationJson || {}
      results.push({
        id,
        taskId: id,
        ok: true,
        skipped: false,
        contentType: task.contentType,
        title: task.title,
        slug: task.slug,
        score: validation.score || task.score || null,
        wordCount: validation.wordCount || task.wordCount || null,
        status: task.status,
        errorMessage: task.errorMessage || '',
        warnings: validation.warnings || [],
      })
    }
    catch (error) {
      const failed = error?.data || null
      const validation = failed?.validationJson || {}
      results.push({
        id,
        taskId: id,
        ok: false,
        skipped: false,
        contentType: failed?.contentType || row?.contentType || '',
        title: failed?.title || row?.title || '',
        slug: failed?.slug || row?.slug || '',
        score: validation.score || null,
        wordCount: validation.wordCount || null,
        status: 'failed',
        errorMessage: error?.statusMessage || error?.message || String(error),
        warnings: validation.warnings || [],
      })
    }
  }

  return {
    total: ids.length,
    running: 0,
    succeeded: results.filter(item => item.ok).length,
    success: results.filter(item => item.ok).length,
    failed: results.filter(item => !item.ok && !item.skipped).length,
    skipped: results.filter(item => item.skipped).length,
    concurrency: 1,
    results: ids.map(id => results.find(item => item.id === id)).filter(Boolean),
  }
}
