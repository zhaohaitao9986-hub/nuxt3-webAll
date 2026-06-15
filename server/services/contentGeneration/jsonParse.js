function stripBom(text) {
  return String(text || '').replace(/^\uFEFF/, '')
}

export function stripMarkdownFences(text) {
  let value = String(text || '').trim()
  if (/^```(?:json)?/i.test(value)) {
    value = value.replace(/^```(?:json)?\s*/i, '')
    value = value.replace(/\s*```\s*$/i, '')
  }
  return value.trim()
}

export function extractJsonObject(text) {
  const value = String(text || '').trim()
  const start = value.indexOf('{')
  if (start < 0) return value
  const end = value.lastIndexOf('}')
  if (end > start) return value.slice(start, end + 1).trim()
  return value.slice(start).trim()
}

export function removeTrailingCommas(text) {
  let previous = null
  let current = String(text || '')
  while (previous !== current) {
    previous = current
    current = current.replace(/,\s*([}\]])/g, '$1')
  }
  return current
}

function trimAfterLastBrace(text) {
  const value = String(text || '').trim()
  const end = value.lastIndexOf('}')
  if (end < 0) return value
  return value.slice(0, end + 1).trim()
}

export function repairTruncatedJson(text) {
  let value = String(text || '').trimEnd()
  value = value.replace(/,\s*$/, '')

  const incompletePropertyPatterns = [
    /,\s*"[^"]*"\s*:\s*("(?:[^"\\]|\\.)*)?$/,
    /,\s*"[^"]*"\s*:\s*$/,
    /,\s*"[^"]*$/,
  ]
  let changed = true
  while (changed) {
    changed = false
    for (const pattern of incompletePropertyPatterns) {
      if (pattern.test(value)) {
        value = value.replace(pattern, '')
        value = value.replace(/,\s*$/, '')
        changed = true
      }
    }
  }

  let inString = false
  let escape = false
  const stack = []
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (char === '\\') {
        escape = true
        continue
      }
      if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{') stack.push('}')
    else if (char === '[') stack.push(']')
    else if ((char === '}' || char === ']') && stack.length && stack[stack.length - 1] === char) {
      stack.pop()
    }
  }

  if (inString) value += '"'
  while (stack.length) value += stack.pop()
  return value
}

export function lineColumnAt(text, position) {
  const safePos = Math.max(0, Math.min(Number(position) || 0, text.length))
  const before = text.slice(0, safePos)
  const line = before.split('\n').length
  const column = safePos - before.lastIndexOf('\n')
  return { line, column }
}

export function snippetAround(text, position, radius = 150) {
  const safePos = Math.max(0, Math.min(Number(position) || 0, text.length))
  const start = Math.max(0, safePos - radius)
  const end = Math.min(text.length, safePos + radius)
  return text.slice(start, end)
}

function parseSyntaxError(error, text) {
  const message = error instanceof Error ? error.message : String(error)
  const match = message.match(/position\s+(\d+)/i)
  const position = match ? Number(match[1]) : text.length
  const { line, column } = lineColumnAt(text, position)
  return {
    errorMessage: message,
    position,
    line,
    column,
    snippet: snippetAround(text, position),
  }
}

function attemptParse(text) {
  try {
    return { ok: true, data: JSON.parse(text) }
  }
  catch (error) {
    return { ok: false, ...parseSyntaxError(error, text) }
  }
}

export function formatParseErrorMessage(meta) {
  const base = meta?.errorMessage || 'JSON parse failed'
  const parts = [base]
  if (meta?.position != null) {
    parts.push(`position ${meta.position}`)
  }
  if (meta?.line != null && meta?.column != null) {
    parts.push(`line ${meta.line} column ${meta.column}`)
  }
  const header = parts.length > 1 ? `${parts[0]} (${parts.slice(1).join(', ')})` : parts[0]
  return meta?.snippet ? `${header}\nNear error: ${meta.snippet}` : header
}

export function safeJsonParse(rawOutput) {
  const original = String(rawOutput || '')
  if (!original.trim()) {
    return {
      ok: false,
      errorMessage: 'AI 返回内容为空',
      position: 0,
      line: 1,
      column: 1,
      snippet: '',
      repaired: false,
      rawLength: 0,
    }
  }

  const candidates = []
  const pushCandidate = (label, value, repaired) => {
    const text = String(value || '').trim()
    if (!text) return
    candidates.push({ label, text, repaired })
  }

  let normalized = stripBom(original)
  normalized = stripMarkdownFences(normalized)
  pushCandidate('normalized', normalized, false)
  pushCandidate('extracted', extractJsonObject(normalized), false)
  pushCandidate('commas-fixed', removeTrailingCommas(extractJsonObject(normalized)), true)
  pushCandidate('truncated-repair', repairTruncatedJson(extractJsonObject(normalized)), true)
  pushCandidate(
    'truncated-repair-commas',
    removeTrailingCommas(repairTruncatedJson(extractJsonObject(normalized))),
    true,
  )
  pushCandidate('trim-after-last-brace', trimAfterLastBrace(normalized), true)

  const seen = new Set()
  let lastFailure = null

  for (const candidate of candidates) {
    if (seen.has(candidate.text)) continue
    seen.add(candidate.text)

    const parsed = attemptParse(candidate.text)
    if (parsed.ok) {
      return {
        ok: true,
        data: parsed.data,
        repaired: candidate.repaired,
        strategy: candidate.label,
        rawLength: original.length,
      }
    }
    lastFailure = { ...parsed, repaired: candidate.repaired, strategy: candidate.label }
  }

  const failure = lastFailure || parseSyntaxError(new Error('JSON parse failed'), normalized)
  return {
    ok: false,
    errorMessage: failure.errorMessage,
    position: failure.position,
    line: failure.line,
    column: failure.column,
    snippet: failure.snippet,
    repaired: Boolean(failure.repaired),
    strategy: failure.strategy || 'none',
    rawLength: original.length,
  }
}
