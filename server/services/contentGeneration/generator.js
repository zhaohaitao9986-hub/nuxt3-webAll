import { createError } from 'h3'
import {
  getContentGenerationTask,
  saveContentGenerationTaskGenerationResult,
  updateContentGenerationTaskStatus,
} from './taskStore'
import { buildContentSourceData } from './sourceBuilder'
import { buildContentPrompt, editorialSystemPrompt } from './prompts'
import { validateGeneratedContentPage, validateSourceData } from './validators'

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1'
const DEFAULT_MODEL = 'deepseek-chat'
const DEFAULT_TIMEOUT_MS = 300000

function parseGeneratedJson(rawOutput) {
  const trimmed = rawOutput.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const jsonText = fenced?.[1]?.trim() || trimmed
  return JSON.parse(jsonText)
}

async function callAi(prompt, event) {
  const config = useRuntimeConfig(event)
  const apiKey = config.aiApiKey || process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || ''
  const baseUrl = config.aiBaseUrl || process.env.AI_BASE_URL || DEFAULT_BASE_URL
  const model = config.aiModel || process.env.AI_MODEL || DEFAULT_MODEL
  const timeoutMs = Number(config.aiTimeoutMs || process.env.AI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)

  if (!apiKey) {
    throw new Error('AI_API_KEY 或 DEEPSEEK_API_KEY 未配置')
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      temperature: 0.25,
      max_tokens: 12000,
      messages: [
        { role: 'system', content: editorialSystemPrompt },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`AI 请求失败：${response.status} ${text || response.statusText}`)
  }

  const body = await response.json()
  const content = body?.choices?.[0]?.message?.content || body?.choices?.[0]?.delta?.content || ''
  if (!content.trim()) {
    throw new Error('AI 返回内容为空')
  }

  return {
    rawOutput: content.trim(),
    model,
    provider: baseUrl,
  }
}

export async function generateContentForTask(taskId, event, auth) {
  const task = await getContentGenerationTask(taskId)
  if (!task) {
    throw createError({ statusCode: 404, statusMessage: '任务不存在' })
  }

  await updateContentGenerationTaskStatus(taskId, 'generating', auth)

  let sourceData = null
  let rawOutput = ''
  let parsedContent = null
  let validationResult = null
  try {
    sourceData = await buildContentSourceData(task)
    const sourceValidation = validateSourceData(sourceData)
    if (!sourceValidation.ok) {
      throw new Error(`sourceData 校验失败：${sourceValidation.errors.join('；')}`)
    }
    const prompt = buildContentPrompt(sourceData)
    const aiResult = await callAi(prompt, event)
    rawOutput = aiResult.rawOutput
    parsedContent = parseGeneratedJson(rawOutput)
    if (parsedContent?.contentPage) {
      parsedContent.contentPage.status = 'REVIEW'
    }
    validationResult = validateGeneratedContentPage(parsedContent, sourceData)

    if (!validationResult.ok) {
      throw new Error(`生成结果校验失败：${validationResult.errors.join('；')}`)
    }

    return saveContentGenerationTaskGenerationResult(taskId, {
      status: 'review',
      contentJson: parsedContent,
      sourceDataJson: sourceData,
      rawOutput,
      validationJson: {
        ...validationResult,
        model: aiResult.model,
        provider: aiResult.provider,
        generatedAt: new Date().toISOString(),
      },
      errorMessage: '',
    }, auth)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await saveContentGenerationTaskGenerationResult(taskId, {
      status: 'failed',
      contentJson: parsedContent,
      sourceDataJson: sourceData,
      rawOutput,
      validationJson: validationResult || {
        ok: false,
        errors: [message],
        failedAt: new Date().toISOString(),
      },
      errorMessage: message,
    }, auth)
    throw createError({ statusCode: 500, statusMessage: message })
  }
}
