import { createError } from 'h3'
import { getContentGenerationTask } from './taskStore'
import { approveTaskForReview, publishApprovedTask } from './reviewWorkflow'

const MAX_BATCH_SIZE = 50

function normalizeTaskIds(input) {
  const taskIds = [...new Set((Array.isArray(input?.taskIds) ? input.taskIds : [])
    .map(id => Number(id))
    .filter(id => Number.isInteger(id) && id > 0))]

  if (!taskIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'taskIds 不能为空' })
  }
  if (taskIds.length > MAX_BATCH_SIZE) {
    throw createError({ statusCode: 400, statusMessage: `单次最多处理 ${MAX_BATCH_SIZE} 条任务` })
  }
  return taskIds
}

function failureMessage(error, fallback) {
  return error?.statusMessage || error?.data?.statusMessage || error?.message || fallback
}

function summarize(results) {
  return {
    success: true,
    total: results.length,
    succeeded: results.filter(item => item.status === 'success').length,
    failed: results.filter(item => item.status === 'failed').length,
    skipped: results.filter(item => item.status === 'skipped').length,
    results,
  }
}

export async function batchApproveTasks(input, auth) {
  const taskIds = normalizeTaskIds(input)
  const results = []

  for (const taskId of taskIds) {
    try {
      const task = await getContentGenerationTask(taskId)
      if (!task) {
        results.push({ taskId, status: 'failed', message: 'Task not found' })
        continue
      }
      if (task.status !== 'review') {
        results.push({ taskId, status: 'skipped', message: `Current status is not reviewable: ${task.status}` })
        continue
      }
      if (!task.finalContent && !task.contentJson && !task.generatedContent) {
        results.push({ taskId, status: 'failed', message: 'Missing generated content' })
        continue
      }

      await approveTaskForReview(taskId, auth)
      results.push({ taskId, status: 'success', message: 'Approved' })
      console.info('[content-generation] batch approve succeeded', { taskId })
    }
    catch (error) {
      const message = failureMessage(error, 'Approve failed')
      results.push({ taskId, status: 'failed', message })
      console.error('[content-generation] batch approve failed', { taskId, message })
    }
  }

  return summarize(results)
}

export async function batchPublishTasks(input, auth) {
  const taskIds = normalizeTaskIds(input)
  const results = []

  for (const taskId of taskIds) {
    try {
      const task = await getContentGenerationTask(taskId)
      if (!task) {
        results.push({ taskId, status: 'failed', message: 'Task not found' })
        continue
      }
      if (task.status !== 'approved') {
        results.push({ taskId, status: 'skipped', message: `Current status is not publishable: ${task.status}` })
        continue
      }

      await publishApprovedTask(taskId, auth, { failIfExists: true })
      results.push({ taskId, status: 'success', message: 'Published' })
      console.info('[content-generation] batch publish succeeded', { taskId })
    }
    catch (error) {
      const message = failureMessage(error, 'Publish failed')
      const status = error?.code === 'CONTENT_PAGE_EXISTS' ? 'skipped' : 'failed'
      results.push({ taskId, status, message })
      const log = status === 'skipped' ? console.warn : console.error
      log('[content-generation] batch publish did not complete', { taskId, status, message })
    }
  }

  return summarize(results)
}
