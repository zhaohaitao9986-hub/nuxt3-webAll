import {
  PRODUCTION_MAX_TOKENS,
  PRODUCTION_MODEL,
  PRODUCTION_TEMPERATURE,
} from './promptVersion.js'

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'
const DEFAULT_TIMEOUT_MS = 300000
const API_RETRY_LIMIT = 2
const API_RETRY_DELAY_MS = 3000

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function extractChatCompletionText(body) {
  if (!body || typeof body !== 'object') return ''
  const choices = Array.isArray(body.choices) ? body.choices : []
  const first = choices[0]
  if (!first || typeof first !== 'object') return ''
  if (first.message && typeof first.message === 'object' && typeof first.message.content === 'string') {
    return first.message.content
  }
  if (first.delta && typeof first.delta === 'object' && typeof first.delta.content === 'string') {
    return first.delta.content
  }
  return ''
}

function parseSseDataLine(line) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return ''
  const payload = trimmed.slice(5).trim()
  if (!payload || payload === '[DONE]') return ''
  try {
    const data = JSON.parse(payload)
    if (data.error) throw new Error(`AI stream error: ${JSON.stringify(data.error)}`)
    return extractChatCompletionText(data)
  }
  catch (error) {
    if (error instanceof Error && error.message.startsWith('AI stream error:')) throw error
    return ''
  }
}

async function readSseStreamToText(body, onChunk) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const piece = parseSseDataLine(line)
      if (!piece) continue
      text += piece
      onChunk?.(piece)
    }
  }

  if (buffer.trim()) {
    for (const line of buffer.split('\n')) {
      const piece = parseSseDataLine(line)
      if (piece) {
        text += piece
        onChunk?.(piece)
      }
    }
  }

  return text
}

function getAiConfig(event) {
  const config = useRuntimeConfig(event)
  const apiKey = config.aiApiKey || process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || ''
  const baseUrl = config.aiBaseUrl || process.env.AI_BASE_URL || DEEPSEEK_BASE_URL
  const timeoutMs = Number(config.aiTimeoutMs || process.env.AI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  return { apiKey, baseUrl, timeoutMs }
}

async function requestChatCompletion({ systemPrompt, userPrompt, stream, onChunk }, event) {
  const { apiKey, baseUrl, timeoutMs } = getAiConfig(event)
  if (!apiKey) throw new Error('AI_API_KEY 或 DEEPSEEK_API_KEY 未配置')

  const chatUrl = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  const response = await fetch(chatUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(stream ? { Accept: 'text/event-stream' } : {}),
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: PRODUCTION_MODEL,
      temperature: PRODUCTION_TEMPERATURE,
      max_tokens: PRODUCTION_MAX_TOKENS,
      stream,
      messages,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`AI 请求失败：${response.status} ${text || response.statusText}`)
  }

  if (!stream) {
    const body = await response.json()
    const content = body?.choices?.[0]?.message?.content || ''
    if (!content.trim()) throw new Error('AI 返回内容为空')
    return {
      rawOutput: content.trim(),
      provider: baseUrl,
      usage: body?.usage || null,
    }
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/event-stream')) {
    const body = await response.json().catch(() => null)
    const text = extractChatCompletionText(body)
    if (!text.trim()) throw new Error('AI 非流式响应无内容')
    return {
      rawOutput: text.trim(),
      provider: baseUrl,
      usage: body?.usage || null,
    }
  }

  if (!response.body) throw new Error('AI 流式响应无 body')
  const rawOutput = await readSseStreamToText(response.body, onChunk)
  if (!rawOutput.trim()) throw new Error('AI 流式响应内容为空')
  return {
    rawOutput: rawOutput.trim(),
    provider: baseUrl,
    usage: null,
  }
}

export async function callContentGenerationAi({ systemPrompt, userPrompt }, event) {
  let lastError = null
  for (let attempt = 0; attempt <= API_RETRY_LIMIT; attempt += 1) {
    try {
      const result = await requestChatCompletion({ systemPrompt, userPrompt, stream: false }, event)
      return {
        ...result,
        retryCount: attempt,
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

export async function callContentGenerationAiStream({ systemPrompt, userPrompt, onChunk }, event) {
  let lastError = null
  for (let attempt = 0; attempt <= API_RETRY_LIMIT; attempt += 1) {
    try {
      const result = await requestChatCompletion({
        systemPrompt,
        userPrompt,
        stream: true,
        onChunk,
      }, event)
      return {
        ...result,
        retryCount: attempt,
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
