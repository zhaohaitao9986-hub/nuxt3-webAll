import { createError } from 'h3'
import {
  approveContentGenerationTask,
  getContentGenerationTask,
  markContentGenerationTaskPublishedInTransaction,
  rejectContentGenerationTask,
  updateContentGenerationTask,
  updateContentGenerationTaskStatus,
} from './taskStore'
import { upsertPublishedContentFromTask } from './publishStore'
import prisma from '~/server/utils/prisma'
import { buildValidationPayload } from './generator.js'
import { validateGeneratedContentPage } from './validators.js'

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

function getTaskContentJson(task) {
  return task.finalContent
    || task.final_content
    || task.contentJson
    || task.content_json
    || task.generatedContent
    || task.generated_content
    || null
}

function getTaskSourceData(task) {
  return task.sourceDataJson || task.source_data_json || null
}

function getTaskValidation(task) {
  const validation = task.validationJson || task.validation_json
  return validation && typeof validation === 'object' ? validation : {}
}

function productionScoreFromValidation(validation) {
  const raw = validation.checks?.productionScore?.actual ?? validation.score ?? 0
  const score = Number(raw)
  return Number.isFinite(score) ? score : 0
}

export function canManualApproveValidation(validation) {
  const score = productionScoreFromValidation(validation)
  const failedChecks = Array.isArray(validation.failedChecks) ? validation.failedChecks : []
  return score >= 90
    && failedChecks.length > 0
    && failedChecks.every(name => name === 'toolGrounding')
}

export function shouldPromoteFailedTaskToReview(validationResult) {
  if (!validationResult) return false
  if (validationResult.ok || validationResult.passed) return true
  const score = Number(validationResult.score ?? 0)
  const failedChecks = Array.isArray(validationResult.failedChecks) ? validationResult.failedChecks : []
  return Number.isFinite(score)
    && score >= 90
    && failedChecks.length > 0
    && failedChecks.every(name => name === 'toolGrounding')
}

export async function revalidateContentGenerationTask(taskId, auth) {
  const task = await getContentGenerationTask(taskId)
  if (!task) {
    throw createError({ statusCode: 404, statusMessage: '任务不存在' })
  }

  const contentJson = getTaskContentJson(task)
  if (!contentJson || typeof contentJson !== 'object') {
    throw createError({ statusCode: 400, statusMessage: '任务缺少 contentJson，无法重新校验' })
  }

  const sourceData = getTaskSourceData(task)
  if (!sourceData) {
    throw createError({ statusCode: 400, statusMessage: '任务缺少 sourceDataJson，无法重新校验' })
  }

  const existingValidation = getTaskValidation(task)
  const validationResult = validateGeneratedContentPage(contentJson, sourceData)
  const validationJson = buildValidationPayload(validationResult, {
    promptVersion: existingValidation.promptVersion,
    promptVersionId: existingValidation.promptVersionId ?? task.promptVersionId,
    retryCount: existingValidation.retryCount ?? 0,
    apiRetryCount: existingValidation.apiRetryCount ?? 0,
    expandRetryCount: existingValidation.expandRetryCount ?? 0,
    provider: existingValidation.provider,
    usage: existingValidation.usage,
    contentType: String(task.contentType || existingValidation.contentType || '').toUpperCase(),
    generatorName: existingValidation.generatorName,
    selectedToolStrategy: validationResult.selectedToolStrategy
      || existingValidation.selectedToolStrategy
      || sourceData.selectedToolStrategy,
    toolCount: sourceData.tools?.length || existingValidation.toolCount || 0,
    sourceCount: sourceData.sources?.length || existingValidation.sourceCount || 0,
    normalizedSources: validationResult.normalizedSources
      || existingValidation.normalizedSources
      || sourceData.sources
      || [],
    typedWriteStatus: existingValidation.typedWriteStatus || 'not-written-review-stage',
    rawOutputLength: existingValidation.rawOutputLength ?? task.rawOutput?.length ?? null,
    jsonParseRepaired: existingValidation.jsonParseRepaired ?? null,
    jsonParseStrategy: existingValidation.jsonParseStrategy ?? null,
  })
  validationJson.revalidatedAt = new Date().toISOString()

  const errorMessage = validationResult.ok
    ? ''
    : `内容校验未通过：${(validationResult.errors || []).join('；') || 'unknown validation error'}`

  await updateContentGenerationTask(taskId, {
    validationJson,
    errorMessage,
  }, auth)

  let status = task.status
  let statusChanged = false
  if (task.status === 'failed' && shouldPromoteFailedTaskToReview(validationResult)) {
    const updated = await updateContentGenerationTaskStatus(taskId, 'review', auth)
    status = updated.status
    statusChanged = true
  }

  return {
    passed: Boolean(validationResult.passed),
    score: validationResult.score || 0,
    failedChecks: validationResult.failedChecks || [],
    warnings: validationResult.warnings || [],
    status,
    statusChanged,
  }
}

export async function manualApproveTaskForReview(taskId, auth) {
  const task = await getContentGenerationTask(taskId)
  if (!task) {
    throw createError({ statusCode: 404, statusMessage: '任务不存在' })
  }
  if (task.status !== 'review') {
    throw createError({ statusCode: 400, statusMessage: '只有待审核内容可以标记通过' })
  }

  const validation = getTaskValidation(task)
  if (!Object.keys(validation).length) {
    throw createError({ statusCode: 400, statusMessage: '缺少 validationJson，请先重新校验' })
  }

  const score = productionScoreFromValidation(validation)
  const failedChecks = Array.isArray(validation.failedChecks) ? validation.failedChecks : []
  if (score < 90) {
    throw createError({ statusCode: 400, statusMessage: `productionScore 需 >= 90，当前为 ${score}` })
  }
  if (!failedChecks.length || !failedChecks.every(name => name === 'toolGrounding')) {
    throw createError({ statusCode: 400, statusMessage: '仅当 failedChecks 全部为 toolGrounding 时可手动标记通过' })
  }

  return approveContentGenerationTask(taskId, auth)
}

export async function approveTaskForReview(taskId, auth) {
  return approveContentGenerationTask(taskId, auth)
}

export async function rejectTaskForReview(taskId, reason, auth) {
  return rejectContentGenerationTask(taskId, reason, auth)
}

export async function publishApprovedTask(taskId, auth, { failIfExists = false } = {}) {
  const task = await getContentGenerationTask(taskId)
  if (!task) {
    throw createError({ statusCode: 404, statusMessage: '任务不存在' })
  }
  if (task.status !== 'approved') {
    throw createError({ statusCode: 400, statusMessage: '只有审核通过的内容可以发布' })
  }

  const finalContent = validateBeforePublish(task)
  return prisma.$transaction(async (tx) => {
    const published = await upsertPublishedContentFromTask(task, finalContent, { tx, failIfExists })
    return markContentGenerationTaskPublishedInTransaction(
      tx,
      taskId,
      finalContent,
      auth,
      published.page.id,
      published.typedWriteStatus,
    )
  }, { maxWait: 10000, timeout: 30000 })
}
