import prisma from '../../utils/prisma.js'
import { enforceInputContract } from './inputContracts.js'
import {
  buildSourceMap,
  claimIsUsable,
  compactToolFacts,
  flattenSourceMap,
  internalLinksFor,
  normalizeCriteria,
  normalizeStringList,
  taskBrief,
} from './sourceSelectors.js'

const SUPPORTED_CONTENT_TYPES = new Set(['BUYER_GUIDE', 'CATEGORY_GUIDE', 'TUTORIAL', 'COMPARISON', 'ALTERNATIVE'])
const GUIDE_MIN_SELECTED_TOOLS = 5
const GUIDE_MAX_SELECTED_TOOLS = 8
const GUIDE_CANDIDATE_LIMIT = 150
const GUIDE_FALLBACK_LIMIT = 8
const GENERIC_CATEGORY_HANDLES = new Set([
  'ai-chatbot',
  'ai-assistant',
  'ai-productivity',
  'productivity',
  'workspace',
  'ai-workspace',
  'ai-tools',
])
const SPECIFIC_GUIDE_HANDLES = new Set([
  'ai-writing-assistants',
  'ai-summarizer',
  'ai-paraphraser',
  'ai-grammar-checker',
  'ai-email-generator',
  'ai-image-generator',
  'ai-video-generator',
  'ai-code-assistant',
  'ai-seo',
  'ai-marketing',
  'ai-presentation',
  'ai-transcription',
  'ai-pdf',
  'ai-meeting-assistant',
  'ai-note-taker',
  'ai-research',
  'ai-design',
  'ai-social-media',
])
const GUIDE_BLOCKED_REPRESENTATIVE_PATTERNS = [
  /\bchatgpt\b/i,
  /\bnotion\b/i,
  /\bdeepl\b/i,
  /\bbitbucket\b/i,
  /\bzerogpt\b/i,
]
const GUIDE_CORE_TOOL_HANDLES = {
  'ai-writing-assistants': new Set([
    'grammarly',
    'quillbot-paraphraser',
    'wordtune',
    'hix-ai',
    'hemingway-editor',
    'smodin',
    'paraphraser-io',
    'easy-peasy-ai',
  ]),
  'ai-summarizer': new Set([
    'notegpt',
    'screenapp',
    'lilys-ai',
    'ai-pdf-summarizer-by-pdf-guru',
    'kome-ai',
    'slidespeak',
    'summarizer-org',
    'ai-summarizer-best',
  ]),
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function toNumber(value) {
  if (value == null) return null
  if (typeof value === 'object' && 'toString' in value) return Number(value.toString())
  return Number(value)
}

function mapCategory(row, parent = null) {
  if (!row) return null
  return { id: row.id, name: row.name, handle: row.handle, parent }
}

function categoryContext(category) {
  if (!category) return null
  return {
    id: category.raw.id,
    name: category.raw.name,
    handle: category.raw.handle,
    parentCategory: category.level1,
    whatIsSummary: category.raw.whatIsSummary || '',
    feature: category.raw.feature || [],
    whoIsUse: category.raw.whoIsUse || '',
    howDoWork: category.raw.howDoWork || '',
    advantages: category.raw.advantages || '',
    faq: category.raw.faq || [],
  }
}

function mapToolForValidation(tool, options = {}) {
  const relevanceTerms = options.relevanceTerms || []
  const claims = options.includeClaims === false
    ? []
    : (tool.claims || []).filter(claim => claimIsUsable(claim, relevanceTerms)).slice(0, options.maxClaims || 6)
  const pricingPlans = options.includePricing === false ? [] : (tool.pricingPlans || []).slice(0, options.maxPlans || 4)
  const compactFacts = compactToolFacts(tool, options)
  return {
    id: tool.id,
    handle: tool.handle,
    name: tool.name,
    description: tool.description,
    website: tool.website,
    pricing: options.includePricing === false ? [] : (tool.pricing || []).slice(0, 5),
    pricingPlans: pricingPlans.map(plan => ({
      id: plan.id,
      planName: plan.planName,
      price: toNumber(plan.price),
      currency: plan.currency,
      billingInterval: plan.billingInterval,
      isFree: plan.isFree,
      hasTrial: plan.hasTrial,
      seatLimit: plan.seatLimit,
      usageLimit: plan.usageLimit,
      features: plan.features || [],
      rawText: plan.rawText,
      verifiedAt: plan.verifiedAt || null,
    })),
    claims: claims.map(claim => ({
      id: claim.id,
      claimType: claim.claimType,
      claimText: claim.claimText,
      confidence: toNumber(claim.confidence),
      verifiedAt: claim.verifiedAt || null,
      expiresAt: claim.expiresAt || null,
      status: claim.status,
    })),
    platforms: (tool.platforms || []).map(item => item.platform).filter(Boolean),
    pros: tool.pros || [],
    cons: tool.cons || [],
    features: tool.feature || [],
    allowedFeatures: compactFacts.allowedFeatures,
    rating: toNumber(tool.toolInfoReview),
    monthlyVisits: toNumber(tool.monthVisitedCount) || 0,
    whatIsSummary: tool.whatIsSummary,
    tags: tool.tags || [],
    useCases: tool.useCases || [],
    forJobs: tool.forJobs || [],
    isFree: tool.isFree,
    matchedCategories: matchedCategoriesForTool(tool),
    categoryRelevanceScore: Number.isFinite(tool.categoryRelevanceScore) ? tool.categoryRelevanceScore : null,
    relevanceLabel: tool.relevanceLabel || null,
    selectionReason: tool.selectionReason || null,
    sourceCompletenessScore: Number.isFinite(tool.sourceCompletenessScore) ? tool.sourceCompletenessScore : null,
    contentCompletenessScore: Number.isFinite(tool.contentCompletenessScore) ? tool.contentCompletenessScore : null,
    categoryFocusScore: Number.isFinite(tool.categoryFocusScore) ? tool.categoryFocusScore : null,
    representativeScore: Number.isFinite(tool.representativeScore) ? tool.representativeScore : null,
    isFallback: Boolean(tool.isFallback),
  }
}

async function fetchCategory(categoryId) {
  if (!categoryId) return null
  const row = await prisma.categoryLevel2.findUnique({
    where: { id: Number(categoryId) },
    select: {
      id: true,
      name: true,
      handle: true,
      whatIsSummary: true,
      feature: true,
      whoIsUse: true,
      howDoWork: true,
      advantages: true,
      faq: true,
      level1: { select: { id: true, name: true, handle: true } },
    },
  })
  if (!row) return null
  return { raw: row, level1: mapCategory(row.level1), level2: mapCategory(row, mapCategory(row.level1)) }
}

async function fetchRelatedCategories(categoryId) {
  if (!categoryId) return []
  const current = await prisma.categoryLevel2.findUnique({ where: { id: Number(categoryId) }, select: { level1Id: true } })
  const rows = await prisma.categoryLevel2.findMany({
    where: {
      isActive: true,
      ...(current?.level1Id ? { level1Id: current.level1Id } : {}),
      NOT: { id: Number(categoryId) },
    },
    orderBy: [{ toolCount: 'desc' }, { sort: 'desc' }, { id: 'asc' }],
    take: 8,
    select: { id: true, name: true, handle: true, level1: { select: { id: true, name: true, handle: true } } },
  })
  return rows.map(row => mapCategory(row, mapCategory(row.level1)))
}

function toolInclude() {
  return {
    pricingPlans: {
      orderBy: [{ isFree: 'desc' }, { price: 'asc' }, { id: 'asc' }],
      take: 6,
      include: { source: true },
    },
    claims: {
      where: {
        status: 'ACTIVE',
        sourceId: { not: null },
        confidence: { gte: 0.7 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ confidence: 'desc' }, { id: 'asc' }],
      take: 12,
      include: { source: true },
    },
    platforms: { orderBy: [{ platform: 'asc' }], include: { source: true } },
    socialLinks: {
      orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }],
      include: { source: true },
    },
    toolCategories: {
      select: {
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
            handle: true,
            level1: { select: { id: true, name: true, handle: true } },
          },
        },
      },
      orderBy: { categoryId: 'asc' },
    },
  }
}

async function fetchRankedTools({ categoryId = null, limit = 5, excludeIds = [] } = {}) {
  return prisma.aiTool.findMany({
    where: {
      toolStatus: { in: ['ONLINE', 'ACTIVE'] },
      handle: { not: '' },
      name: { not: '' },
      ...(excludeIds.length ? { id: { notIn: excludeIds.map(Number) } } : {}),
      ...(categoryId ? { toolCategories: { some: { categoryId: Number(categoryId) } } } : {}),
    },
    orderBy: [{ rank: 'asc' }, { monthVisitedCount: 'desc' }, { updatedAt: 'desc' }],
    include: toolInclude(),
    take: Math.min(30, Math.max(1, Number(limit) || 5)),
  })
}

async function fetchGuideCandidateTools(categoryId) {
  if (!categoryId) throw new Error('BUYER_GUIDE requires categoryId; Guide generation cannot fall back to global tools')
  const rows = await prisma.aiTool.findMany({
    where: {
      toolStatus: { in: ['ONLINE', 'ACTIVE'] },
      handle: { not: '' },
      name: { not: '' },
      toolCategories: { some: { categoryId: Number(categoryId) } },
    },
    orderBy: [{ rank: 'asc' }, { monthVisitedCount: 'desc' }, { collectedCount: 'desc' }, { updatedAt: 'desc' }, { id: 'asc' }],
    select: { id: true },
    take: GUIDE_CANDIDATE_LIMIT,
  })
  return fetchToolsByIds(rows.map(row => row.id), GUIDE_CANDIDATE_LIMIT)
}

async function fetchGuideFallbackTools(category, excludeIds = []) {
  const level1Id = category?.raw?.level1?.id || category?.level1?.id || null
  const currentCategoryId = category?.level2?.id || category?.raw?.id || null
  if (!level1Id || !currentCategoryId) return []
  const siblingCategories = await prisma.categoryLevel2.findMany({
    where: {
      isActive: true,
      level1Id: Number(level1Id),
      NOT: { id: Number(currentCategoryId) },
    },
    orderBy: [{ toolCount: 'desc' }, { sort: 'desc' }, { id: 'asc' }],
    take: GUIDE_FALLBACK_LIMIT,
    select: { id: true },
  })
  const siblingIds = siblingCategories.map(row => row.id)
  if (!siblingIds.length) return []
  return prisma.aiTool.findMany({
    where: {
      toolStatus: { in: ['ONLINE', 'ACTIVE'] },
      handle: { not: '' },
      name: { not: '' },
      ...(excludeIds.length ? { id: { notIn: excludeIds.map(Number) } } : {}),
      toolCategories: { some: { categoryId: { in: siblingIds } } },
    },
    orderBy: [{ rank: 'asc' }, { monthVisitedCount: 'desc' }, { updatedAt: 'desc' }, { id: 'asc' }],
    include: toolInclude(),
    take: GUIDE_FALLBACK_LIMIT,
  })
}

function tokenizeCategory(category) {
  const text = [
    category?.level2?.handle,
    category?.level2?.name,
    category?.raw?.handle,
    category?.raw?.name,
  ].filter(Boolean).join(' ')
  return [...new Set(String(text)
    .toLowerCase()
    .replace(/^ai[-\s]+/, '')
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= 3 && !['tools', 'tool', 'generator', 'assistant', 'assistants'].includes(token)))]
}

function matchedCategoriesForTool(tool) {
  return (tool?.toolCategories || [])
    .map(row => row.category)
    .filter(Boolean)
    .map(category => ({
      id: category.id,
      name: category.name,
      handle: category.handle,
      level1Id: category.level1?.id || null,
      level1Name: category.level1?.name || null,
      level1Handle: category.level1?.handle || null,
    }))
}

function toolText(tool) {
  return [
    tool?.name,
    tool?.handle,
    tool?.description,
    tool?.whatIsSummary,
    ...(tool?.tags || []),
    ...(tool?.feature || []),
    ...(tool?.useCases || []),
    ...(tool?.forJobs || []),
  ].filter(Boolean).join(' ').toLowerCase()
}

function categoryKeywordHits(tool, category) {
  const tokens = tokenizeCategory(category)
  if (!tokens.length) return 0
  const haystack = toolText(tool)
  return tokens.filter(token => haystack.includes(token)).length
}

function hasSourceCompleteness(tool) {
  return Boolean(
    tool?.website
    || tool?.sourceMap?.length
    || tool?.claims?.some(claim => claim.sourceId || claim.source)
    || tool?.pricingPlans?.some(plan => plan.sourceId || plan.source)
    || tool?.platforms?.some(platform => platform.sourceId || platform.source)
    || tool?.socialLinks?.some(link => link.sourceId || link.source),
  )
}

function hasContentCompleteness(tool) {
  return Boolean(
    tool?.whatIsSummary
    || tool?.description
    || tool?.feature?.length
    || tool?.useCases?.length
    || tool?.faq?.length
    || tool?.pros?.length
    || tool?.cons?.length,
  )
}

function hasPricingContext(tool) {
  return Boolean(tool?.pricingPlans?.length || tool?.pricing?.length || tool?.pricingModel)
}

function isGenericTool(tool) {
  const handles = matchedCategoriesForTool(tool).map(category => category.handle)
  const text = `${tool?.handle || ''} ${tool?.name || ''} ${tool?.description || ''}`.toLowerCase()
  return handles.some(handle => GENERIC_CATEGORY_HANDLES.has(handle))
    || /\b(chatbot|general assistant|productivity|workspace|all-in-one)\b/i.test(text)
}

function relevanceCap(tool, category) {
  const handle = category?.level2?.handle || category?.raw?.handle
  const hits = categoryKeywordHits(tool, category)
  const categoryCount = tool.toolCategories?.length || 0
  const identity = `${tool?.handle || ''} ${tool?.name || ''}`.toLowerCase()
  if (GUIDE_BLOCKED_REPRESENTATIVE_PATTERNS.some(pattern => pattern.test(identity))) return 49
  const isKnownCore = knownCoreToolBonus(tool, category) > 0
  if (SPECIFIC_GUIDE_HANDLES.has(handle) && hits === 0 && !isKnownCore) return 69
  if (SPECIFIC_GUIDE_HANDLES.has(handle) && isGenericTool(tool) && hits === 0 && !isKnownCore) return 49
  if (categoryCount > 12 && hits === 0 && !isKnownCore) return 49
  return null
}

function labelForScore(score) {
  if (score >= 70) return 'STRONG'
  if (score >= 50) return 'MEDIUM'
  if (score >= 30) return 'WEAK'
  return 'INVALID'
}

function rankRepresentativeScore(rank) {
  const value = toNumber(rank)
  if (!Number.isFinite(value) || value <= 0) return 0
  if (value <= 50) return 25
  if (value <= 100) return 22
  if (value <= 500) return 18
  if (value <= 1000) return 15
  if (value <= 5000) return 10
  if (value <= 15000) return 5
  return 0
}

function knownCoreToolBonus(tool, category) {
  const categoryHandle = category?.level2?.handle || category?.raw?.handle
  const coreHandles = GUIDE_CORE_TOOL_HANDLES[categoryHandle]
  if (!coreHandles?.size) return 0
  return coreHandles.has(String(tool?.handle || '').toLowerCase()) ? 30 : 0
}

function representativeScoreForTool(tool, category, sourceCompletenessScore, contentCompletenessScore) {
  const visits = Math.max(0, toNumber(tool?.monthVisitedCount) || 0)
  const collected = Math.max(0, toNumber(tool?.collectedCount) || 0)
  const trafficScore = Math.min(35, Math.log10(visits + 1) * 5)
  const collectedScore = Math.min(15, Math.log10(collected + 1) * 8)
  const rankScore = rankRepresentativeScore(tool?.rank)
  const sourceScore = sourceCompletenessScore ? 5 : 0
  const contentScore = contentCompletenessScore ? 5 : 0
  const coreBonus = knownCoreToolBonus(tool, category)
  const genericPenalty = isGenericTool(tool) ? -15 : 0
  const blockedPenalty = GUIDE_BLOCKED_REPRESENTATIVE_PATTERNS.some(pattern => pattern.test(`${tool?.handle || ''} ${tool?.name || ''}`))
    ? -100
    : 0
  return Math.max(0, Math.round(trafficScore + collectedScore + rankScore + sourceScore + contentScore + coreBonus + genericPenalty + blockedPenalty))
}

function scoreGuideTool(tool, category, options = {}) {
  const currentCategoryId = Number(category?.level2?.id || category?.raw?.id)
  const categories = matchedCategoriesForTool(tool)
  const categoryCount = categories.length
  const exactMatch = categories.some(row => Number(row.id) === currentCategoryId)
  const keywordHits = categoryKeywordHits(tool, category)
  const sourceCompletenessScore = hasSourceCompleteness(tool) ? 10 : 0
  const contentCompletenessScore = hasContentCompleteness(tool) ? 10 : 0
  const pricingScore = hasPricingContext(tool) ? 5 : 0
  const focusScore = categoryCount > 0 && categoryCount <= 5 ? 15 : 0
  const broadPenalty = categoryCount > 8 ? -15 : 0
  const genericPenalty = SPECIFIC_GUIDE_HANDLES.has(category?.level2?.handle || category?.raw?.handle) && isGenericTool(tool) ? -10 : 0
  const coreFitBonus = knownCoreToolBonus(tool, category) > 0 ? 10 : 0
  let score = 0
  if (exactMatch) score += 50
  if (keywordHits > 0) score += Math.min(20, keywordHits * 10)
  score += focusScore + broadPenalty + genericPenalty + coreFitBonus + sourceCompletenessScore + contentCompletenessScore + pricingScore
  if (options.fallback) score = Math.min(score, 69)
  const cap = relevanceCap(tool, category)
  if (Number.isFinite(cap)) score = Math.min(score, cap)
  const categoryRelevanceScore = Math.max(0, Math.min(100, score))
  const relevanceLabel = labelForScore(categoryRelevanceScore)
  const representativeScore = representativeScoreForTool(tool, category, sourceCompletenessScore, contentCompletenessScore)
  return {
    ...tool,
    categoryRelevanceScore,
    relevanceLabel,
    representativeScore,
    matchedCategories: categories,
    sourceCompletenessScore,
    contentCompletenessScore,
    categoryFocusScore: focusScore,
    selectionReason: [
      exactMatch ? `Bound to current L2 category ${category?.level2?.handle || category?.raw?.handle}` : 'Not bound to current L2 category',
      keywordHits ? `${keywordHits} category keyword hit(s)` : 'No direct category keyword hit',
      categoryCount <= 5 ? 'focused category footprint' : `${categoryCount} category bindings`,
      `representative score ${representativeScore}`,
      hasSourceCompleteness(tool) ? 'has source context' : 'limited source context',
      hasContentCompleteness(tool) ? 'has rewritten content fields' : 'limited rewritten content fields',
    ].join('; '),
  }
}

function guideSortValue(tool) {
  return [
    tool.relevanceLabel === 'STRONG' ? 0 : 1,
    -(tool.representativeScore || 0),
    -(tool.categoryRelevanceScore || 0),
    -(tool.sourceCompletenessScore || 0),
    -(tool.contentCompletenessScore || 0),
    -(toNumber(tool.monthVisitedCount) || 0),
    toNumber(tool.rank) || Number.MAX_SAFE_INTEGER,
    tool.id || Number.MAX_SAFE_INTEGER,
  ]
}

function sortGuideTools(rows) {
  return rows.sort((a, b) => {
    const left = guideSortValue(a)
    const right = guideSortValue(b)
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] < right[index]) return -1
      if (left[index] > right[index]) return 1
    }
    return 0
  })
}

function dedupeTools(tools) {
  return Array.from(new Map((tools || []).map(tool => [tool.id, tool])).values())
}

function selectGuideTools(scoredTools) {
  const deduped = dedupeTools(scoredTools)
  const strong = sortGuideTools(deduped.filter(tool => tool.relevanceLabel === 'STRONG'))
  const medium = sortGuideTools(deduped.filter(tool => tool.relevanceLabel === 'MEDIUM'))
  const selected = dedupeTools([...strong, ...medium]).slice(0, GUIDE_MAX_SELECTED_TOOLS)
  return {
    selected: selected.length >= GUIDE_MIN_SELECTED_TOOLS ? selected : selected,
    counts: {
      candidateToolCount: scoredTools.length,
      dedupedCandidateToolCount: deduped.length,
      STRONG: strong.length,
      MEDIUM: medium.length,
      WEAK: deduped.filter(tool => tool.relevanceLabel === 'WEAK').length,
      INVALID: deduped.filter(tool => tool.relevanceLabel === 'INVALID').length,
    },
  }
}

async function fetchGuideToolSelection(task, category) {
  const candidates = await fetchGuideCandidateTools(category?.level2?.id || task.categoryId)
  const scored = candidates.map(tool => scoreGuideTool(tool, category))
  const selection = selectGuideTools(scored)
  const fallbackPool = selection.selected.length < GUIDE_MIN_SELECTED_TOOLS
    ? await fetchGuideFallbackTools(category, selection.selected.map(tool => tool.id))
    : []
  const fallbackTools = sortGuideTools(
    fallbackPool
      .map(tool => scoreGuideTool(tool, category, { fallback: true }))
      .filter(tool => ['STRONG', 'MEDIUM'].includes(tool.relevanceLabel))
      .map(tool => ({ ...tool, isFallback: true })),
  ).slice(0, GUIDE_FALLBACK_LIMIT)
  return {
    selectedTools: selection.selected,
    fallbackTools,
    diagnostics: {
      ...selection.counts,
      selectedToolsCount: selection.selected.length,
      fallbackToolsCount: fallbackTools.length,
      toolSelectionStrategy: 'l2-category-relevance-score',
      selectedToolIds: selection.selected.map(tool => tool.id),
      fallbackToolIds: fallbackTools.map(tool => tool.id),
      toolSelectionDiagnostics: scored.map(tool => ({
        toolId: tool.id,
        toolName: tool.name,
        score: tool.categoryRelevanceScore,
        label: tool.relevanceLabel,
        representativeScore: tool.representativeScore,
        selectionReason: tool.selectionReason,
        matchedCategories: tool.matchedCategories,
      })),
    },
  }
}

async function fetchTool(toolId) {
  if (!toolId) return null
  return prisma.aiTool.findFirst({
    where: { id: Number(toolId), toolStatus: { in: ['ONLINE', 'ACTIVE'] }, handle: { not: '' }, name: { not: '' } },
    include: toolInclude(),
  })
}

async function fetchToolsByIds(ids, max) {
  const normalized = [...new Set((ids || []).map(Number).filter(Number.isFinite))].slice(0, max)
  if (!normalized.length) return []
  const rows = await prisma.aiTool.findMany({
    where: { id: { in: normalized }, toolStatus: { in: ['ONLINE', 'ACTIVE'] }, handle: { not: '' }, name: { not: '' } },
    include: toolInclude(),
  })
  const byId = new Map(rows.map(row => [row.id, row]))
  return normalized.map(id => byId.get(id)).filter(Boolean)
}

function baseBrief(task, category, type) {
  const brief = taskBrief(task)
  const targetKeyword = String(brief.targetKeyword || '').trim()
  const audience = String(brief.audience || '').trim()
  const searchIntent = String(brief.searchIntent || '').trim()
  const pageGoal = String(brief.pageGoal || '').trim()
  return { brief, targetKeyword, audience, searchIntent, pageGoal }
}

function buildSlug(task, category, tools, suffix) {
  const base = task.slug || category?.level2?.handle || tools[0]?.handle || task.title || 'ai-tools'
  return slugify(`${base}${suffix ? `-${suffix}` : ''}`)
}

function sourceEnvelope(task, contentType, slug, tools, sourceMap, input, inputValidation, extra = {}) {
  const mappedTools = tools.map(tool => mapToolForValidation(tool, extra.validationToolOptions || {}))
  const byId = new Map(mappedTools.map(tool => [tool.id, tool]))
  const mappedSelectedTools = extra.selectedTools
    ? extra.selectedTools.map(tool => mapToolForValidation(tool, extra.validationToolOptions || {}))
    : ['BUYER_GUIDE'].includes(contentType) ? mappedTools : undefined
  const mappedFallbackTools = extra.fallbackTools
    ? extra.fallbackTools.map(tool => mapToolForValidation(tool, extra.validationToolOptions || {}))
    : undefined
  return {
    task: ['COMPARISON', 'ALTERNATIVE'].includes(contentType) ? 'generate_compare' : 'generate_guide',
    contentType,
    slug,
    canonicalPath: `${['COMPARISON', 'ALTERNATIVE'].includes(contentType) ? '/compare/' : '/guides/'}${slug}`,
    language: 'en',
    tools: mappedTools,
    topTools: ['BUYER_GUIDE', 'CATEGORY_GUIDE', 'TUTORIAL'].includes(contentType) ? mappedTools : undefined,
    categoryTopTools: ['COMPARISON', 'ALTERNATIVE'].includes(contentType) ? mappedTools : undefined,
    sources: flattenSourceMap(sourceMap),
    aiInput: input,
    inputValidation: { ...inputValidation, selectedToolStrategy: extra.selectedToolStrategy || null },
    selectedToolStrategy: extra.selectedToolStrategy || null,
    selectedTools: mappedSelectedTools,
    fallbackTools: mappedFallbackTools,
    toolSelectionDiagnostics: extra.toolSelectionDiagnostics || null,
    primaryTool: extra.primaryTool ? byId.get(extra.primaryTool.id) || null : null,
    secondaryTool: extra.secondaryTool ? byId.get(extra.secondaryTool.id) || null : null,
    category: extra.category || null,
    relatedCategories: extra.relatedCategories || [],
    comparisonType: extra.comparisonType,
    requiredCriteria: extra.requiredCriteria || [],
    intent: input.searchIntent || input.comparisonIntent || null,
    audience: input.audience || input.targetAudience || null,
  }
}

async function buildBuyerGuide(task, category, relatedCategories) {
  const { brief, targetKeyword, audience, searchIntent, pageGoal } = baseBrief(task, category, 'BUYER_GUIDE')
  if (!category?.level2?.id) throw new Error('BUYER_GUIDE requires categoryId; Guide generation cannot fall back to global tools')
  const explicitIds = brief.selectedToolIds || brief.toolIds
  const selection = explicitIds?.length
    ? {
        selectedTools: sortGuideTools(
          (await fetchToolsByIds(explicitIds, 10))
            .map(tool => scoreGuideTool(tool, category))
            .filter(tool => ['STRONG', 'MEDIUM'].includes(tool.relevanceLabel)),
        ).slice(0, 10),
        fallbackTools: [],
        diagnostics: { toolSelectionStrategy: 'explicit-selected-tools-category-relevance' },
      }
    : await fetchGuideToolSelection(task, category)
  const tools = selection.selectedTools
  const fallbackTools = selection.fallbackTools || []
  const criteria = normalizeCriteria(brief.decisionCriteria)
  const relevanceTerms = [targetKeyword, ...criteria.map(row => row.name)].filter(Boolean)
  const toolFacts = tools.map(tool => compactToolFacts(tool, { relevanceTerms, maxClaims: 6, maxPlans: 4 }))
  const sourceMap = buildSourceMap([...tools, ...fallbackTools], { relevanceTerms, maxClaims: 6, maxPlans: 4, includePlatforms: true, maxSources: 30 })
  const selectedTools = tools.map(tool => ({
    id: tool.id,
    handle: tool.handle,
    name: tool.name,
    categoryRelevanceScore: tool.categoryRelevanceScore,
    relevanceLabel: tool.relevanceLabel,
    matchedCategories: matchedCategoriesForTool(tool),
    selectionReason: tool.selectionReason,
  }))
  const candidate = {
    pageType: 'GUIDE', contentType: 'BUYER_GUIDE', targetKeyword, pageGoal, searchIntent, audience,
    categoryContext: categoryContext(category), selectedTools, toolFacts, decisionCriteria: criteria, sourceMap,
    internalLinks: internalLinksFor({ category, tools, relatedCategories, extra: brief.internalLinks }),
  }
  const { input, validation } = enforceInputContract('BUYER_GUIDE', candidate)
  const strategy = explicitIds?.length ? 'explicit-selected-tools-category-relevance' : 'l2-category-relevance-score'
  const slug = buildSlug(task, category, tools, '')
  return sourceEnvelope(task, 'BUYER_GUIDE', slug, tools, sourceMap, input, validation, {
    category: category ? { level1: category.level1, level2: category.level2 } : null,
    relatedCategories,
    selectedToolStrategy: strategy,
    selectedTools: tools,
    fallbackTools,
    toolSelectionDiagnostics: selection.diagnostics,
    validationToolOptions: { relevanceTerms },
  })
}

async function buildCategoryGuide(task, category, relatedCategories) {
  const { brief, targetKeyword, audience, searchIntent, pageGoal } = baseBrief(task, category, 'CATEGORY_GUIDE')
  const explicitIds = brief.representativeToolIds || brief.selectedToolIds
  const tools = explicitIds?.length
    ? await fetchToolsByIds(explicitIds, 5)
    : await fetchRankedTools({ categoryId: task.categoryId, limit: Math.min(5, Math.max(3, Number(task.limit) || 3)) })
  const representativeTools = tools.map(tool => compactToolFacts(tool, { includePricing: false, includeClaims: false, maxFeatures: 5, maxPros: 3, maxCons: 3, maxUseCases: 4, descriptionMax: 350 }))
  const sourceMap = buildSourceMap(tools, { includePricing: false, includeClaims: false, includePlatforms: false, maxSources: 12 })
  const candidate = {
    pageType: 'GUIDE', contentType: 'CATEGORY_GUIDE', targetKeyword, pageGoal, searchIntent, audience,
    categoryContext: categoryContext(category), relatedCategories, representativeTools, sourceMap,
    internalLinks: internalLinksFor({ category, tools, relatedCategories, extra: brief.internalLinks }),
  }
  const { input, validation } = enforceInputContract('CATEGORY_GUIDE', candidate)
  const slug = buildSlug(task, category, tools, '')
  return sourceEnvelope(task, 'CATEGORY_GUIDE', slug, tools, sourceMap, input, validation, {
    category: category ? { level1: category.level1, level2: category.level2 } : null,
    relatedCategories, selectedToolStrategy: explicitIds?.length ? 'explicit-representative-tools' : 'category-representative-tools',
    validationToolOptions: { includePricing: false, includeClaims: false },
  })
}

async function buildTutorial(task, category, relatedCategories) {
  const { brief, targetKeyword, audience, searchIntent, pageGoal } = baseBrief(task, category, 'TUTORIAL')
  const primaryTool = await fetchTool(brief.primaryToolId || task.toolId)
  const relatedTools = await fetchToolsByIds(brief.relatedToolIds || [], 2)
  const tutorialGoal = String(brief.tutorialGoal || '').trim()
  const workflowContext = Array.isArray(brief.workflowContext) ? brief.workflowContext.slice(0, 15) : []
  const relevanceTerms = [tutorialGoal, ...workflowContext.flatMap(step => typeof step === 'string' ? [step] : [step?.title, step?.instruction])].filter(Boolean)
  const tools = [primaryTool, ...relatedTools].filter(Boolean)
  const primaryFact = primaryTool ? compactToolFacts(primaryTool, { relevanceTerms, includePricing: false, maxClaims: 6, maxPlans: 0 }) : null
  const relatedFacts = relatedTools.map(tool => compactToolFacts(tool, { relevanceTerms, includePricing: false, maxClaims: 3, maxPlans: 0, descriptionMax: 350 }))
  const sourceMap = buildSourceMap(tools, { relevanceTerms, includePricing: false, maxClaims: 6, includePlatforms: true, maxSources: 12 })
  const candidate = {
    pageType: 'GUIDE', contentType: 'TUTORIAL', targetKeyword, pageGoal, searchIntent, audience,
    tutorialGoal,
    prerequisiteKnowledge: normalizeStringList(brief.prerequisiteKnowledge || brief.prerequisites, 10),
    primaryTool: primaryFact,
    workflowContext,
    commonMistakes: normalizeStringList(brief.commonMistakes, 10),
    outputChecklist: normalizeStringList(brief.outputChecklist, 10),
    relatedTools: relatedFacts,
    sourceMap,
    internalLinks: internalLinksFor({ category: null, tools, relatedCategories: [], extra: brief.internalLinks }),
  }
  const { input, validation } = enforceInputContract('TUTORIAL', candidate)
  const slug = buildSlug(task, category, tools, 'tutorial')
  return sourceEnvelope(task, 'TUTORIAL', slug, tools, sourceMap, input, validation, {
    category: category ? { level1: category.level1, level2: category.level2 } : null,
    relatedCategories, primaryTool, selectedToolStrategy: 'explicit-tutorial-primary-and-workflow',
    validationToolOptions: { relevanceTerms, includePricing: false },
  })
}

function sharedUseCases(primary, secondary, explicit) {
  const supplied = normalizeStringList(explicit, 8)
  if (supplied.length) return supplied
  const secondarySet = new Set((secondary?.useCases || []).map(value => String(value).toLowerCase()))
  return (primary?.useCases || []).filter(value => secondarySet.has(String(value).toLowerCase())).slice(0, 8)
}

function featureComparisonFacts(tools, criteria) {
  return criteria.map(criterion => ({
    dimension: criterion.name,
    tools: tools.map(tool => ({
      toolId: tool.id,
      toolName: tool.name,
      facts: [...(tool.feature || []), ...(tool.pros || []), ...(tool.cons || [])]
        .filter(value => String(value).toLowerCase().includes(criterion.name.toLowerCase().split(' ')[0]))
        .slice(0, 5),
    })),
  }))
}

function pricingComparisonFacts(tools) {
  return tools.map(tool => ({
    toolId: tool.id,
    toolName: tool.name,
    pricingSummary: (tool.pricing || []).slice(0, 5),
    plans: (tool.pricingPlans || []).slice(0, 4).map(plan => ({
      planName: plan.planName, billingInterval: plan.billingInterval, isFree: plan.isFree,
      hasTrial: plan.hasTrial, usageLimit: plan.usageLimit || null,
    })),
  }))
}

async function buildComparison(task, category, relatedCategories) {
  const brief = taskBrief(task)
  const primaryTool = await fetchTool(brief.primaryToolId || task.toolId)
  let secondaryTool = await fetchTool(brief.secondaryToolId)
  let strategy = secondaryTool ? 'explicit-primary-secondary' : 'missing-secondary'
  if (!secondaryTool && brief.autoSelectSecondaryTool === true && primaryTool) {
    const inferredCategoryId = Number(task.categoryId) || Number(primaryTool.toolCategories?.[0]?.categoryId) || null
    secondaryTool = (await fetchRankedTools({ categoryId: inferredCategoryId, limit: 1, excludeIds: [primaryTool.id] }))[0] || null
    strategy = secondaryTool ? 'explicit-auto-select-secondary' : 'missing-secondary'
  }
  const tools = [primaryTool, secondaryTool].filter(Boolean)
  const criteria = normalizeCriteria(brief.decisionCriteria)
  const comparisonIntent = String(brief.comparisonIntent || '').trim()
  const targetAudience = String(brief.targetAudience || '').trim()
  const useCases = primaryTool && secondaryTool ? sharedUseCases(primaryTool, secondaryTool, brief.sharedUseCases) : []
  const relevanceTerms = [comparisonIntent, ...criteria.map(row => row.name), ...useCases].filter(Boolean)
  const compactTools = tools.map(tool => compactToolFacts(tool, { relevanceTerms, maxClaims: 6, maxPlans: 4 }))
  const sourceMap = buildSourceMap(tools, { relevanceTerms, maxClaims: 6, maxPlans: 4, includePlatforms: true, maxSources: 20 })
  const candidate = {
    pageType: 'COMPARE', contentType: 'COMPARISON', comparisonIntent, targetAudience,
    primaryTool: compactTools.find(tool => tool.id === primaryTool?.id) || null,
    secondaryTool: compactTools.find(tool => tool.id === secondaryTool?.id) || null,
    sharedUseCases: useCases,
    decisionCriteria: criteria,
    featureComparisonFacts: featureComparisonFacts(tools, criteria),
    pricingComparisonFacts: pricingComparisonFacts(tools),
    sourceMap,
    internalLinks: internalLinksFor({ category, tools, relatedCategories: [], extra: brief.internalLinks }),
  }
  const { input, validation } = enforceInputContract('COMPARISON', candidate)
  if (!secondaryTool && !validation.missingRequiredFields.includes('missingSecondaryTool')) validation.missingRequiredFields.push('missingSecondaryTool')
  validation.passed = validation.missingRequiredFields.length === 0
  const slug = buildSlug(task, category, tools, 'comparison')
  return sourceEnvelope(task, 'COMPARISON', slug, tools, sourceMap, input, validation, {
    category: category?.level2 || null, relatedCategories, primaryTool, secondaryTool, comparisonType: 'TOOL_VS_TOOL',
    selectedToolStrategy: strategy, requiredCriteria: criteria.map(row => row.name), validationToolOptions: { relevanceTerms },
  })
}

async function buildAlternative(task, category, relatedCategories) {
  const brief = taskBrief(task)
  const primaryTool = await fetchTool(brief.primaryToolId || task.toolId)
  const alternativeTools = await fetchToolsByIds(brief.alternativeToolIds || [], 8)
  const tools = [primaryTool, ...alternativeTools.filter(tool => tool.id !== primaryTool?.id)].filter(Boolean)
  const criteria = normalizeCriteria(brief.selectionCriteria)
  const dimensions = normalizeStringList(brief.comparisonDimensions, 10).length
    ? normalizeStringList(brief.comparisonDimensions, 10)
    : criteria.map(row => row.name).filter(Boolean)
  const reasonToSwitch = String(brief.reasonToSwitch || '').trim()
  const relevanceTerms = [reasonToSwitch, ...criteria.map(row => row.name), ...dimensions].filter(Boolean)
  const compactTools = tools.map(tool => compactToolFacts(tool, { relevanceTerms, maxClaims: 5, maxPlans: 4 }))
  const sourceMap = buildSourceMap(tools, { relevanceTerms, maxClaims: 5, maxPlans: 4, includePlatforms: true, maxSources: 30 })
  const candidate = {
    pageType: 'COMPARE', contentType: 'ALTERNATIVE',
    primaryTool: compactTools.find(tool => tool.id === primaryTool?.id) || null,
    alternativeTools: compactTools.filter(tool => tool.id !== primaryTool?.id),
    reasonToSwitch,
    selectionCriteria: criteria,
    comparisonDimensions: dimensions,
    pricingSummary: pricingComparisonFacts(tools),
    sourceMap,
    internalLinks: internalLinksFor({ category, tools, relatedCategories: [], extra: brief.internalLinks }),
  }
  const { input, validation } = enforceInputContract('ALTERNATIVE', candidate)
  const slug = buildSlug(task, category, tools, 'alternatives')
  return sourceEnvelope(task, 'ALTERNATIVE', slug, tools, sourceMap, input, validation, {
    category: category?.level2 || null, relatedCategories, primaryTool, comparisonType: 'ALTERNATIVES',
    selectedToolStrategy: 'explicit-primary-alternative-tools', requiredCriteria: criteria.map(row => row.name),
    validationToolOptions: { relevanceTerms },
  })
}

export async function buildContentSourceData(task) {
  const type = String(task.contentType || '').trim().toUpperCase()
  if (!SUPPORTED_CONTENT_TYPES.has(type)) throw new Error(`unsupportedContentType: ${type || '(empty)'}`)

  const categoryId = Number(task.categoryId) || null
  const [category, relatedCategories] = await Promise.all([fetchCategory(categoryId), fetchRelatedCategories(categoryId)])
  if (categoryId && !category) throw new Error(`categoryNotFound: categoryId=${categoryId}`)

  if (type === 'BUYER_GUIDE') return buildBuyerGuide(task, category, relatedCategories)
  if (type === 'CATEGORY_GUIDE') return buildCategoryGuide(task, category, relatedCategories)
  if (type === 'TUTORIAL') return buildTutorial(task, category, relatedCategories)
  if (type === 'COMPARISON') return buildComparison(task, category, relatedCategories)
  return buildAlternative(task, category, relatedCategories)
}
