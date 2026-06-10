import { createError } from 'h3'
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

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'
const DEFAULT_TIMEOUT_MS = 300000
const API_RETRY_LIMIT = 2
const API_RETRY_DELAY_MS = 3000
const EXPAND_RETRY_LIMIT = 1

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseGeneratedJson(rawOutput) {
  const trimmed = rawOutput.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const jsonText = fenced?.[1]?.trim() || trimmed
  return JSON.parse(jsonText)
}

async function callAi({ systemPrompt, userPrompt }, event) {
  const config = useRuntimeConfig(event)
  const apiKey = config.aiApiKey || process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || ''
  const baseUrl = config.aiBaseUrl || process.env.AI_BASE_URL || DEEPSEEK_BASE_URL
  const timeoutMs = Number(config.aiTimeoutMs || process.env.AI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)

  if (!apiKey) throw new Error('AI_API_KEY 或 DEEPSEEK_API_KEY 未配置')

  let lastError = null
  for (let attempt = 0; attempt <= API_RETRY_LIMIT; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model: PRODUCTION_MODEL,
          temperature: PRODUCTION_TEMPERATURE,
          max_tokens: PRODUCTION_MAX_TOKENS,
          stream: false,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`AI 请求失败：${response.status} ${text || response.statusText}`)
      }

      const body = await response.json()
      const content = body?.choices?.[0]?.message?.content || ''
      if (!content.trim()) throw new Error('AI 返回内容为空')

      return {
        rawOutput: content.trim(),
        provider: baseUrl,
        retryCount: attempt,
        usage: body?.usage || null,
      }
    }
    catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < API_RETRY_LIMIT) await sleep(API_RETRY_DELAY_MS * (attempt + 1))
    }
  }
  const finalError = lastError || new Error('DeepSeek request failed')
  finalError.retryCount = API_RETRY_LIMIT
  throw finalError
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
  return {
    ...validation,
    model: PRODUCTION_MODEL,
    temperature: PRODUCTION_TEMPERATURE,
    max_tokens: PRODUCTION_MAX_TOKENS,
    max_completion_tokens: null,
    promptVersion: metadata.promptVersion,
    promptVersionId: metadata.promptVersionId,
    retryCount: metadata.retryCount,
    apiRetryCount: metadata.apiRetryCount,
    expandRetryCount: metadata.expandRetryCount,
    generationMode: GENERATION_MODE,
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
  let provider = DEEPSEEK_BASE_URL
  let usage = null

  try {
    sourceData = await buildContentSourceData(task)
    const sourceValidation = validateSourceData(sourceData)
    if (!sourceValidation.ok) throw new Error(`sourceData 校验失败：${sourceValidation.errors.join('；')}`)

    const sourcePrompt = buildContentPrompt(sourceData)
    promptVersion = await resolvePromptVersion(task, sourceData, sourcePrompt)
    let activeUserPrompt = promptVersion.userPrompt

    for (let generationAttempt = 0; generationAttempt <= EXPAND_RETRY_LIMIT; generationAttempt += 1) {
      const aiResult = await callAi({
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
