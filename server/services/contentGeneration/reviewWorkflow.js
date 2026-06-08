import { createError } from 'h3'
import {
  approveContentGenerationTask,
  getContentGenerationTask,
  markContentGenerationTaskPublished,
  rejectContentGenerationTask,
} from './taskStore'
import { upsertPublishedContentFromTask } from './publishStore'

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function getPublishContent(task) {
  return task.finalContent || task.final_content || task.contentJson || null
}

function getContentBody(content) {
  return content?.bodyJson || content?.body_json || content?.content || null
}

export function validateBeforePublish(task) {
  const errors = []
  const content = getPublishContent(task)
  const meta = content?.contentPage || content?.content_page || {}

  if (!nonEmpty(meta.title || task.title)) {
    errors.push('title 不能为空')
  }
  if (!nonEmpty(meta.slug || task.slug)) {
    errors.push('slug 不能为空')
  }
  if (!nonEmpty(meta.metaTitle || meta.meta_title)) {
    errors.push('meta_title 不能为空')
  }
  if (!nonEmpty(meta.metaDescription || meta.meta_description)) {
    errors.push('meta_description 不能为空')
  }
  const body = getContentBody(content)
  if (!body || (Array.isArray(body?.blocks) && body.blocks.length === 0)) {
    errors.push('content 不能为空')
  }

  if (errors.length) {
    throw createError({ statusCode: 400, statusMessage: errors.join('；') })
  }

  if (meta.status === 'PUBLISHED') {
    meta.status = 'REVIEW'
  }

  return {
    ...content,
    contentPage: {
      ...meta,
      title: meta.title || task.title,
      slug: meta.slug || task.slug,
      metaTitle: meta.metaTitle || meta.meta_title,
      metaDescription: meta.metaDescription || meta.meta_description,
      status: 'PUBLISHED',
    },
  }
}

export async function approveTaskForReview(taskId) {
  return approveContentGenerationTask(taskId)
}

export async function rejectTaskForReview(taskId, reason) {
  return rejectContentGenerationTask(taskId, reason)
}

export async function publishApprovedTask(taskId) {
  const task = await getContentGenerationTask(taskId)
  if (!task) {
    throw createError({ statusCode: 404, statusMessage: '任务不存在' })
  }
  if (task.status !== 'approved') {
    throw createError({ statusCode: 400, statusMessage: '只有审核通过的内容可以发布' })
  }

  const finalContent = validateBeforePublish(task)
  await upsertPublishedContentFromTask(task, finalContent)
  return markContentGenerationTaskPublished(taskId, finalContent)
}
