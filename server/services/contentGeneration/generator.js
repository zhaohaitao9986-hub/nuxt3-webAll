import { createError } from 'h3'
import { callContentGenerationAi } from './aiClient'
import {
  getContentGenerationTask,
  saveContentGenerationTaskGenerationResult,
  updateContentGenerationTaskStatus,
} from './taskStore'
import { buildContentSourceData } from './sourceBuilder'
import { buildContentPrompt, buildExpandFixPrompt } from './prompts'
import {
  GENERATION_MODE,
  PRODUCTION_MAX_TOKENS,
  PRODUCTION_MODEL,
  PRODUCTION_TEMPERATURE,
  resolvePromptVersion,
} from './promptVersion'
import { validateGeneratedContentPage, validateSourceData } from './validators'

const EXPAND_RETRY_LIMIT = 1

function parseGeneratedJson(rawOutput) {
  const trimmed = rawOutput.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const jsonText = fenced?.[1]?.trim() || trimmed
  return JSON.parse(jsonText)
}

function enforceReviewState(content) {
  if (!content?.contentPage) return
  content.contentPage.status = 'REVIEW'
  content.contentPage.robots = 'NOINDEX_FOLLOW'
}

function shouldExpand(validation) {
  if (!validation || validation.ok) return false
  const expandable = new Set([
    'wordCount',
    'blockCount',
    'faqCount',
    'matrixRowCount',
    'criteriaCount',
    'recommendedToolsCount',
    'toolCalloutCount',
    'minSectionWordCount',
    'minFaqAnswerWordCount',
    'minRecommendedToolWordCount',
    'verdictSpecific',
    'requiredTopics',
    'hasPricingContext',
    'hasDecisionGuidance',
    'hasUseCases',
    'hasMethodology',
  ])
  return Object.entries(validation.checks || {}).some(([name, row]) => expandable.has(name) && row?.passed === false)
}

function buildValidationPayload(validation, metadata) {
  const metrics = validation?.metrics || {}
  return {
    ...validation,
    contentType: metadata.contentType,
    generatorName: metadata.generatorName,
    selectedToolStrategy: metadata.selectedToolStrategy,
    model: PRODUCTION_MODEL,
    temperature: PRODUCTION_TEMPERATURE,
    max_tokens: PRODUCTION_MAX_TOKENS,
    maxTokens: PRODUCTION_MAX_TOKENS,
    max_completion_tokens: null,
    promptVersion: metadata.promptVersion,
    promptVersionId: metadata.promptVersionId,
    retryCount: metadata.retryCount,
    apiRetryCount: metadata.apiRetryCount,
    expandRetryCount: metadata.expandRetryCount,
    generationMode: GENERATION_MODE,
    wordCount: metrics.wordCount || 0,
    blockCount: metrics.blockCount || 0,
    faqCount: metrics.faqCount || 0,
    sourceCount: metrics.sourceCount || validation?.normalizedSources?.length || metadata.sourceCount || 0,
    toolCount: metadata.toolCount || 0,
    criteriaCount: metrics.criteriaCount || 0,
    matrixRowCount: metrics.matrixRowCount || 0,
    score: validation?.score || 0,
    passed: Boolean(validation?.passed),
    failedChecks: validation?.failedChecks?.length
      ? validation.failedChecks
      : validation?.passed ? [] : ['generationError'],
    warnings: validation?.warnings || [],
    missingToolFields: validation?.missingToolFields || [],
    normalizedSources: validation?.normalizedSources?.length
      ? validation.normalizedSources
      : metadata.normalizedSources || [],
    typedWriteStatus: metadata.typedWriteStatus || 'not-written-review-stage',
    provider: metadata.provider,
    usage: metadata.usage,
    generatedAt: new Date().toISOString(),
  }
}

export async function generateContentForTask(taskId, event, auth) {
  const task = await getContentGenerationTask(taskId)
  if (!task) throw createError({ statusCode: 404, statusMessage: '任务不存在' })

  await updateContentGenerationTaskStatus(taskId, 'generating', auth)

  let sourceData = null
  let rawOutput = ''
  let parsedContent = null
  let validationResult = null
  let promptVersion = null
  let apiRetryCount = 0
  let expandRetryCount = 0
  let provider = 'https://api.deepseek.com/v1'
  let usage = null

  try {
    sourceData = await buildContentSourceData(task)
    const sourceValidation = validateSourceData(sourceData)
    if (!sourceValidation.ok) throw new Error(`sourceData 校验失败：${sourceValidation.errors.join('；')}`)

    const sourcePrompt = buildContentPrompt(sourceData)
    promptVersion = await resolvePromptVersion(task, sourceData, sourcePrompt)
    let activeUserPrompt = promptVersion.userPrompt

    for (let generationAttempt = 0; generationAttempt <= EXPAND_RETRY_LIMIT; generationAttempt += 1) {
      const aiResult = await callContentGenerationAi({
        systemPrompt: promptVersion.systemPrompt,
        userPrompt: activeUserPrompt,
      }, event)
      apiRetryCount += aiResult.retryCount
      provider = aiResult.provider
      usage = aiResult.usage
      rawOutput = aiResult.rawOutput
      parsedContent = parseGeneratedJson(rawOutput)
      enforceReviewState(parsedContent)
      if (!parsedContent.sources?.length && sourceData.sources?.length) parsedContent.sources = sourceData.sources
      validationResult = validateGeneratedContentPage(parsedContent, sourceData)
      if (validationResult.normalizedSources?.length) parsedContent.sources = validationResult.normalizedSources

      if (validationResult.ok) break
      if (generationAttempt >= EXPAND_RETRY_LIMIT || !shouldExpand(validationResult)) break

      expandRetryCount += 1
      activeUserPrompt = buildExpandFixPrompt(promptVersion.userPrompt, rawOutput, validationResult)
    }

    const validationJson = buildValidationPayload(validationResult, {
      promptVersion: promptVersion.promptVersion,
      promptVersionId: promptVersion.id,
      retryCount: apiRetryCount + expandRetryCount,
      apiRetryCount,
      expandRetryCount,
      provider,
      usage,
      contentType: sourceData.contentType,
      generatorName: sourceData.task === 'generate_compare' ? 'compare-generator' : 'guide-generator',
      selectedToolStrategy: sourceData.selectedToolStrategy,
      toolCount: sourceData.tools?.length || 0,
      sourceCount: sourceData.sources?.length || 0,
      normalizedSources: validationResult?.normalizedSources || sourceData.sources || [],
    })

    if (!validationResult?.ok) {
      const message = `生成结果未达到 production-ready SEO draft 标准：${validationResult?.errors?.join('；') || 'unknown validation error'}`
      await saveContentGenerationTaskGenerationResult(taskId, {
        status: 'failed',
        contentJson: parsedContent,
        sourceDataJson: sourceData,
        promptVersionId: promptVersion.id,
        promptJson: {
          promptVersion: promptVersion.promptVersion,
          systemPrompt: promptVersion.systemPrompt,
          userPrompt: promptVersion.userPrompt,
        },
        rawOutput,
        validationJson,
        errorMessage: message,
      }, auth)
      throw createError({ statusCode: 422, statusMessage: message })
    }

    return saveContentGenerationTaskGenerationResult(taskId, {
      status: 'review',
      contentJson: parsedContent,
      sourceDataJson: sourceData,
      promptVersionId: promptVersion.id,
      promptJson: {
        promptVersion: promptVersion.promptVersion,
        systemPrompt: promptVersion.systemPrompt,
        userPrompt: promptVersion.userPrompt,
      },
      rawOutput,
      validationJson,
      errorMessage: '',
    }, auth)
  }
  catch (error) {
    if (error?.statusCode === 422) throw error
    apiRetryCount += Number(error?.retryCount || 0)
    const message = error instanceof Error ? error.message : String(error)
    const validationJson = buildValidationPayload(validationResult || {
      ok: false,
      passed: false,
      errors: [message],
      warnings: [],
      checks: {},
      metrics: {},
      missingToolFields: sourceData ? validateSourceData(sourceData).missingToolFields || [] : [],
    }, {
      promptVersion: promptVersion?.promptVersion || null,
      promptVersionId: promptVersion?.id || null,
      retryCount: apiRetryCount + expandRetryCount,
      apiRetryCount,
      expandRetryCount,
      provider,
      usage,
      contentType: sourceData?.contentType || task.contentType?.toUpperCase?.() || task.contentType,
      generatorName: sourceData?.task === 'generate_compare'
        ? 'compare-generator'
        : sourceData?.task === 'generate_guide' ? 'guide-generator' : 'unsupported-generator',
      selectedToolStrategy: sourceData?.selectedToolStrategy || null,
      toolCount: sourceData?.tools?.length || 0,
      sourceCount: sourceData?.sources?.length || 0,
      normalizedSources: validationResult?.normalizedSources || sourceData?.sources || [],
    })

    await saveContentGenerationTaskGenerationResult(taskId, {
      status: 'failed',
      contentJson: parsedContent,
      sourceDataJson: sourceData,
      promptVersionId: promptVersion?.id,
      promptJson: promptVersion
        ? {
            promptVersion: promptVersion.promptVersion,
            systemPrompt: promptVersion.systemPrompt,
            userPrompt: promptVersion.userPrompt,
          }
        : undefined,
      rawOutput,
      validationJson,
      errorMessage: message,
    }, auth)
    throw createError({ statusCode: 500, statusMessage: message })
  }
}
