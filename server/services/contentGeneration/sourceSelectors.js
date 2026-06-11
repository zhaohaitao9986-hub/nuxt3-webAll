const HIGH_CONFIDENCE_THRESHOLD = 0.7

function text(value, max = 500) {
  const normalized = String(value || '').trim()
  return normalized ? normalized.slice(0, max) : ''
}

function values(value, maxItems = 10, maxLength = 300) {
  return (Array.isArray(value) ? value : [])
    .map(item => text(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

export function taskBrief(task) {
  const promptJson = task?.promptJson && typeof task.promptJson === 'object' ? task.promptJson : {}
  const nested = promptJson.brief && typeof promptJson.brief === 'object'
    ? promptJson.brief
    : promptJson.input && typeof promptJson.input === 'object' ? promptJson.input : {}
  return { ...promptJson, ...nested }
}

export function normalizeStringList(value, maxItems = 10) {
  if (Array.isArray(value)) return values(value, maxItems)
  if (typeof value === 'string') return values(value.split(/\r?\n|,/), maxItems)
  return []
}

export function normalizeCriteria(value, fallback = []) {
  const rows = Array.isArray(value) && value.length ? value : fallback
  return rows.map((item, index) => {
    if (typeof item === 'string') return { name: text(item, 120), description: '', weight: index + 1 }
    return {
      name: text(item?.name || item?.label, 120),
      description: text(item?.description || item?.reason, 300),
      weight: Number(item?.weight) || index + 1,
    }
  }).filter(item => item.name).slice(0, 10)
}

export function claimIsUsable(claim, relevanceTerms = []) {
  if (!claim?.source?.url || claim.status !== 'ACTIVE') return false
  if (claim.expiresAt && new Date(claim.expiresAt).getTime() <= Date.now()) return false
  if (Number(claim.confidence || 0) < HIGH_CONFIDENCE_THRESHOLD) return false
  if (!relevanceTerms.length) return true
  const corpus = `${claim.claimType || ''} ${claim.claimText || ''}`.toLowerCase()
  return relevanceTerms.some(term => corpus.includes(String(term).toLowerCase()))
}

function compactPlan(plan, includeDetails) {
  if (!includeDetails) return null
  return {
    planName: text(plan.planName, 120),
    billingInterval: plan.billingInterval,
    isFree: Boolean(plan.isFree),
    hasTrial: Boolean(plan.hasTrial),
    seatLimit: plan.seatLimit ?? null,
    usageLimit: text(plan.usageLimit, 240) || null,
    features: values(plan.features, 6, 180),
    rawText: text(plan.rawText, 400) || null,
  }
}

export function compactToolFacts(tool, options = {}) {
  const includePricing = options.includePricing !== false
  const includeClaims = options.includeClaims !== false
  const includeDetails = options.includePlanDetails !== false
  const relevanceTerms = options.relevanceTerms || []
  const claims = includeClaims
    ? (tool.claims || []).filter(claim => claimIsUsable(claim, relevanceTerms)).slice(0, options.maxClaims || 6)
    : []

  return {
    id: tool.id,
    handle: tool.handle,
    name: tool.name,
    website: tool.website,
    description: text(tool.description, options.descriptionMax || 600) || null,
    whatIsSummary: text(tool.whatIsSummary, options.descriptionMax || 600) || null,
    features: values(tool.feature || tool.features, options.maxFeatures || 10),
    pros: values(tool.pros, options.maxPros || 6),
    cons: values(tool.cons, options.maxCons || 6),
    useCases: values(tool.useCases, options.maxUseCases || 8),
    platforms: (tool.platforms || []).map(item => typeof item === 'string' ? item : item.platform).filter(Boolean).slice(0, 8),
    pricingSummary: includePricing ? values(tool.pricing, 5, 400) : [],
    pricingPlans: includePricing
      ? (tool.pricingPlans || []).map(plan => compactPlan(plan, includeDetails)).filter(Boolean).slice(0, options.maxPlans || 4)
      : [],
    keyClaims: claims.map(claim => ({
      claimType: claim.claimType,
      claimText: text(claim.claimText, 400),
      confidence: Number(claim.confidence),
    })),
    isFree: Boolean(tool.isFree),
  }
}

function sourceRow(source, context, toolId, factType, factKey) {
  if (!source?.url) return null
  return {
    id: source.id ?? null,
    url: source.url,
    domain: source.domain || safeDomain(source.url),
    title: source.title || '',
    sourceType: source.sourceType || 'OTHER',
    retrievedAt: source.retrievedAt || null,
    context,
    toolId,
    factType,
    factKey,
  }
}

export function buildSourceMap(tools, options = {}) {
  const rows = []
  const seen = new Set()
  const push = (row) => {
    if (!row?.url) return
    const key = `${row.toolId}:${row.factType}:${row.url}`
    if (seen.has(key)) return
    seen.add(key)
    rows.push(row)
  }

  for (const tool of tools) {
    push(sourceRow({ url: tool.website, title: tool.name, sourceType: 'OFFICIAL_SITE' }, `Official website for ${tool.name}`, tool.id, 'official', 'website'))
    if (options.includePricing !== false) {
      for (const plan of (tool.pricingPlans || []).slice(0, options.maxPlans || 4)) {
        push(sourceRow(plan.source, `Pricing evidence for ${tool.name}`, tool.id, 'pricing', plan.planName || 'pricing'))
      }
    }
    if (options.includeClaims !== false) {
      const claims = (tool.claims || []).filter(claim => claimIsUsable(claim, options.relevanceTerms || [])).slice(0, options.maxClaims || 6)
      for (const claim of claims) push(sourceRow(claim.source, `Claim evidence for ${tool.name}`, tool.id, 'claim', claim.claimType))
    }
    if (options.includePlatforms) {
      for (const platform of (tool.platforms || []).slice(0, 6)) {
        push(sourceRow(platform.source, `Platform evidence for ${tool.name}`, tool.id, 'platform', platform.platform))
      }
    }
  }

  return rows.slice(0, options.maxSources || 30).map((row, index) => ({ ...row, sort: index + 1 }))
}

export function flattenSourceMap(sourceMap) {
  const seen = new Set()
  return (sourceMap || []).filter(source => {
    if (!source?.url || seen.has(source.url)) return false
    seen.add(source.url)
    return true
  }).map((source, index) => ({
    id: source.id,
    url: source.url,
    domain: source.domain,
    title: source.title,
    sourceType: source.sourceType,
    retrievedAt: source.retrievedAt,
    context: source.context,
    sort: index + 1,
  }))
}

export function internalLinksFor({ category, tools = [], relatedCategories = [], extra = [] }) {
  const links = []
  if (category?.level2?.handle || category?.handle) {
    const row = category.level2 || category
    links.push({ path: `/ai-tools/${row.handle}`, anchor: row.name, reason: 'Primary category context' })
  }
  for (const tool of tools) links.push({ path: `/tool/${tool.handle}`, anchor: tool.name, reason: 'Tool detail' })
  for (const row of relatedCategories.slice(0, 4)) links.push({ path: `/ai-tools/${row.handle}`, anchor: row.name, reason: 'Related category' })
  for (const row of Array.isArray(extra) ? extra : []) {
    if (row?.path && row?.anchor) links.push({ path: text(row.path, 300), anchor: text(row.anchor, 120), reason: text(row.reason, 200) })
  }
  return links.slice(0, 12)
}

function safeDomain(url) {
  try {
    return new URL(url).hostname
  }
  catch {
    return ''
  }
}
