import {
  PRODUCTION_MAX_TOKENS,
  PRODUCTION_MODEL,
  PRODUCTION_TEMPERATURE,
} from './promptVersion'

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'
const DEFAULT_TIMEOUT_MS = 300000
const API_RETRY_LIMIT = 2
const API_RETRY_DELAY_MS = 3000

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function callContentGenerationAi({ systemPrompt, userPrompt }, event) {
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
