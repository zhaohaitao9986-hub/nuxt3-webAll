import prisma from '~/server/utils/prisma'

const SUPPORTED_CONTENT_TYPES = new Set([
  'BUYER_GUIDE',
  'CATEGORY_GUIDE',
  'TUTORIAL',
  'COMPARISON',
  'ALTERNATIVE',
])

const GUIDE_MIN_SELECTED_TOOLS = 5
const GUIDE_MAX_SELECTED_TOOLS = 8
const GUIDE_CANDIDATE_LIMIT = 500
const GUIDE_FALLBACK_LIMIT = 8
const GENERIC_CATEGORY_HANDLES = new Set([
  'ai-chatbot',
  'ai-assistant',
  'ai-productivity-tools',
  'ai-workflow',
  'ai-knowledge-base',
  'ai-project-management',
])
const SPECIFIC_GUIDE_HANDLES = new Set([
  'ai-summarizer',
  'ai-writing-assistants',
  'ai-grammar-checker',
  'ai-paraphraser',
  'ai-rewriter',
  'ai-text-generator',
  'ai-blog-generator',
  'ai-email-generator',
])

function toNumber(value) {
  if (value == null) return null
  if (typeof value === 'object' && 'toString' in value) return Number(value.toString())
  return Number(value)
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

function mapCategory(row, parent = null) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    parent,
  }
}

function mapSource(source, context = '', sort = 0) {
  if (!source?.url) return null
  return {
    id: source.id,
    url: source.url,
    domain: source.domain || safeDomain(source.url),
    title: source.title || '',
    sourceType: source.sourceType || 'OTHER',
    retrievedAt: source.retrievedAt || null,
    context,
    sort,
  }
}

function mapTool(tool) {
  const pricingPlans = (tool.pricingPlans || []).map((plan) => ({
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
  }))
  const claims = (tool.claims || []).map((claim) => ({
    id: claim.id,
    claimType: claim.claimType,
    claimText: claim.claimText,
    valueJson: claim.valueJson,
    confidence: toNumber(claim.confidence),
    verifiedAt: claim.verifiedAt || null,
    expiresAt: claim.expiresAt || null,
    status: claim.status,
  }))
  const normalizedPlatforms = (tool.platforms || []).map((item) => item.platform).filter(Boolean)

  return {
    id: tool.id,
    handle: tool.handle,
    name: tool.name,
    description: tool.description,
    website: tool.website,
    pricing: tool.pricing || [],
    pricingPlans,
    claims,
    platforms: normalizedPlatforms.length ? normalizedPlatforms : (tool.websiteType || []),
    socialLinks: (tool.socialLinks || []).map((link) => ({
      linkType: link.linkType,
      label: link.label,
      url: link.url,
      email: link.email,
      isPrimary: link.isPrimary,
      verifiedAt: link.verifiedAt || null,
    })),
    pros: tool.pros || [],
    cons: tool.cons || [],
    features: tool.feature || [],
    rating: toNumber(tool.toolInfoReview),
    monthlyVisits: toNumber(tool.monthVisitedCount) || 0,
    whatIsSummary: tool.whatIsSummary,
    tags: tool.tags || [],
    useCases: tool.useCases || [],
    forJobs: tool.forJobs || [],
    companyInfo: tool.companyInfo,
    isFree: tool.isFree,
    matchedCategories: (tool.toolCategories || []).map((link) => ({
      id: link.categoryId,
      name: link.category?.name || '',
      handle: link.category?.handle || '',
      level1Handle: link.category?.level1?.handle || '',
    })).filter((row) => row.id),
    categoryRelevanceScore: tool.categoryRelevanceScore ?? null,
    relevanceLabel: tool.relevanceLabel || null,
    selectionReason: tool.selectionReason || '',
    sourceCompletenessScore: tool.sourceCompletenessScore ?? null,
    contentCompletenessScore: tool.contentCompletenessScore ?? null,
    categoryFocusScore: tool.categoryFocusScore ?? null,
    isFallback: Boolean(tool.isFallback),
  }
}

function collectSources(tools) {
  const sources = []
  const seen = new Set()
  function push(source) {
    if (!source?.url || seen.has(source.url)) return
    seen.add(source.url)
    sources.push({ ...source, sort: sources.length + 1 })
  }

  for (const tool of tools) {
    push({
      url: tool.website,
      domain: safeDomain(tool.website),
      title: tool.name,
      sourceType: 'OFFICIAL_SITE',
      retrievedAt: null,
      context: `Official website for ${tool.name}`,
    })
    for (const plan of tool.pricingPlans || []) {
      push(mapSource(plan.source, `Pricing source for ${tool.name}`, sources.length + 1))
    }
    for (const claim of tool.claims || []) {
      push(mapSource(claim.source, `Claim source for ${tool.name}: ${claim.claimType}`, sources.length + 1))
    }
    for (const platform of tool.platforms || []) {
      push(mapSource(platform.source, `Platform source for ${tool.name}`, sources.length + 1))
    }
    for (const link of tool.socialLinks || []) {
      push(mapSource(link.source, `Social/contact source for ${tool.name}`, sources.length + 1))
    }
  }
  return sources
}

function safeDomain(url) {
  try {
    return new URL(url).hostname
  }
  catch {
    return ''
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
  return {
    raw: row,
    level1: mapCategory(row.level1),
    level2: mapCategory(row, mapCategory(row.level1)),
  }
}

async function fetchRelatedCategories(categoryId) {
  const current = categoryId
    ? await prisma.categoryLevel2.findUnique({ where: { id: Number(categoryId) }, select: { level1Id: true } })
    : null
  const rows = await prisma.categoryLevel2.findMany({
    where: {
      isActive: true,
      ...(current?.level1Id ? { level1Id: current.level1Id } : {}),
      ...(categoryId ? { NOT: { id: Number(categoryId) } } : {}),
    },
    orderBy: [{ toolCount: 'desc' }, { sort: 'desc' }, { id: 'asc' }],
    take: 8,
    select: {
      id: true,
      name: true,
      handle: true,
      level1: { select: { id: true, name: true, handle: true } },
    },
  })
  return rows.map((row) => mapCategory(row, mapCategory(row.level1)))
}

function toolInclude() {
  return {
    pricingPlans: {
      orderBy: [{ isFree: 'desc' }, { price: 'asc' }, { id: 'asc' }],
      take: 6,
      include: { source: true },
    },
    claims: {
      where: { status: 'ACTIVE' },
      orderBy: [{ confidence: 'desc' }, { id: 'asc' }],
      take: 12,
      include: { source: true },
    },
    platforms: {
      orderBy: [{ platform: 'asc' }],
      include: { source: true },
    },
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

async function fetchTools({ categoryId = null, toolId = null, limit = 5, excludeIds = [] } = {}) {
  const safeLimit = Math.min(30, Math.max(1, Number(limit) || 5))
  const where = {
    toolStatus: { in: ['ONLINE', 'ACTIVE'] },
    handle: { not: '' },
    name: { not: '' },
    ...(toolId ? { id: Number(toolId) } : {}),
    ...(excludeIds.length ? { id: { notIn: excludeIds.map(Number) } } : {}),
    ...(categoryId ? { toolCategories: { some: { categoryId: Number(categoryId) } } } : {}),
  }
  return prisma.aiTool.findMany({
    where,
    orderBy: [{ rank: 'asc' }, { monthVisitedCount: 'desc' }, { updatedAt: 'desc' }],
    include: toolInclude(),
    take: safeLimit,
  })
}

async function fetchGuideCandidateTools({ categoryId, limit = GUIDE_CANDIDATE_LIMIT, excludeIds = [] } = {}) {
  return prisma.aiTool.findMany({
    where: {
      toolStatus: { in: ['ONLINE', 'ACTIVE'] },
      handle: { not: '' },
      name: { not: '' },
      ...(excludeIds.length ? { id: { notIn: excludeIds.map(Number) } } : {}),
      toolCategories: { some: { categoryId: Number(categoryId) } },
    },
    orderBy: [{ monthVisitedCount: 'desc' }, { rank: 'asc' }, { updatedAt: 'desc' }],
    include: toolInclude(),
    take: Math.min(1000, Math.max(50, Number(limit) || GUIDE_CANDIDATE_LIMIT)),
  })
}

async function fetchGuideFallbackTools({ category, excludeIds = [] } = {}) {
  if (!category?.raw?.level1?.id) return []
  return prisma.aiTool.findMany({
    where: {
      toolStatus: { in: ['ONLINE', 'ACTIVE'] },
      handle: { not: '' },
      name: { not: '' },
      ...(excludeIds.length ? { id: { notIn: excludeIds.map(Number) } } : {}),
      toolCategories: {
        some: {
          category: {
            level1Id: category.raw.level1.id,
            NOT: { id: category.raw.id },
          },
        },
      },
    },
    orderBy: [{ monthVisitedCount: 'desc' }, { rank: 'asc' }, { updatedAt: 'desc' }],
    include: toolInclude(),
    take: GUIDE_CANDIDATE_LIMIT,
  })
}

function tokenizeCategory(category) {
  const raw = [
    category?.name,
    String(category?.handle || '').replace(/-/g, ' '),
  ].filter(Boolean).join(' ')
  return [...new Set(String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !['the', 'and', 'for', 'with', 'tools', 'tool', 'online'].includes(token)))]
}

function toolText(tool) {
  return [
    tool.name,
    tool.handle,
    tool.seoMetaTitle,
    tool.seoMetaDescription,
    ...(tool.seoMetaKeywords || []),
    tool.whatIsSummary,
    tool.description,
    ...(tool.tags || []),
    ...(tool.feature || []),
    ...(tool.useCases || []),
    tool.expandedAbout,
    JSON.stringify(tool.featuresDetails || ''),
    JSON.stringify(tool.expandedUsecases || ''),
    JSON.stringify(tool.expandedFaqs || ''),
  ].filter(Boolean).join(' ').toLowerCase()
}

function categoryKeywordHits(tool, category) {
  const text = toolText(tool)
  const tokens = tokenizeCategory(category)
  const phrases = [
    String(category?.handle || '').toLowerCase(),
    String(category?.handle || '').toLowerCase().replace(/-/g, ' '),
    String(category?.name || '').toLowerCase(),
  ].filter((value) => value.length >= 4)

  const phraseHit = phrases.some((phrase) => text.includes(phrase))
  const tokenHits = tokens.filter((token) => {
    if (text.includes(token)) return true
    if (token.endsWith('s') && text.includes(token.slice(0, -1))) return true
    return false
  })
  return {
    phraseHit,
    tokenHits,
    hasHit: phraseHit || tokenHits.length > 0,
  }
}

function hasSourceCompleteness(tool) {
  return Boolean(tool.website)
    || (tool.pricingPlans || []).some((plan) => plan.source)
    || (tool.claims || []).some((claim) => claim.source)
    || (tool.platforms || []).some((platform) => platform.source)
    || (tool.socialLinks || []).some((link) => link.source)
}

function hasContentCompleteness(tool) {
  return Boolean(tool.expandedAbout)
    || Boolean(tool.featuresDetails)
    || Boolean(tool.expandedUsecases)
    || Boolean(tool.expandedFaqs)
    || Boolean(tool.whatIsSummary)
    || Boolean((tool.feature || []).length)
    || Boolean((tool.useCases || []).length)
}

function hasPricingContext(tool) {
  return Boolean((tool.pricing || []).length || (tool.pricingPlans || []).length || tool.isFree)
}

function isGenericTool(tool, currentCategory) {
  const handles = (tool.toolCategories || []).map((link) => link.category?.handle).filter(Boolean)
  const text = toolText(tool)
  if (!SPECIFIC_GUIDE_HANDLES.has(currentCategory?.handle)) return false
  if (currentCategory?.handle === 'ai-writing-assistants' && handles.some((handle) => ['ai-grammar-checker', 'ai-paraphraser', 'ai-rewriter', 'ai-text-generator', 'ai-writing'].includes(handle))) return false
  if (currentCategory?.handle === 'ai-summarizer' && handles.some((handle) => ['ai-pdf-summarizer', 'ai-video-summarizer', 'ai-youtube-summary', 'ai-article-summarizer', 'ai-book-summarizer'].includes(handle))) return false
  return handles.some((handle) => GENERIC_CATEGORY_HANDLES.has(handle))
    || /\b(chatbot|assistant|workspace|productivity|project management|calendar|wiki)\b/i.test(text)
}

function relevanceCap(tool, currentCategory, hits) {
  const text = toolText(tool)
  const handle = currentCategory?.handle
  const categoryHandles = (tool.toolCategories || []).map((link) => link.category?.handle).filter(Boolean)
  const hasAnyCategory = (...handles) => handles.some((value) => categoryHandles.includes(value))
  if (!hits.hasHit) {
    if (handle === 'ai-summarizer' && /\b(bitbucket|git|repository|devops|ci\/cd|code review|pull request)\b/i.test(text)) return 25
    if (/\b(workspace|project management|calendar|wiki|database)\b/i.test(text)) return 45
    return 49
  }
  if (handle === 'ai-summarizer' && /\b(ai detector|content detector|plagiarism checker|chatgpt detector|zerogpt)\b/i.test(text)) return 49
  if (handle === 'ai-summarizer' && hasAnyCategory('ai-search-engine')) return 69
  if (handle === 'ai-summarizer' && hasAnyCategory('ai-flashcard-maker', 'ai-quiz-generator', 'ai-mind-mapping', 'ai-notes-generator') && !hasAnyCategory('ai-pdf-summarizer', 'ai-video-summarizer', 'ai-youtube-summary', 'ai-article-summarizer', 'ai-book-summarizer')) return 79
  if (handle === 'ai-writing-assistants' && /\b(humanize ai|ai humanizer|anti detector|bypass detector)\b/i.test(text) && !hasAnyCategory('ai-grammar-checker', 'ai-paraphraser', 'ai-rewriter', 'ai-text-generator', 'ai-writing')) return 49
  if (handle === 'ai-writing-assistants' && /\b(ai detector|chatgpt detector|copyleaks)\b/i.test(text) && !hasAnyCategory('ai-grammar-checker', 'ai-paraphraser', 'ai-rewriter', 'ai-text-generator', 'ai-writing')) return 49
  if (handle === 'ai-writing-assistants' && /\b(machine translation|document translation|localization|translate)\b/i.test(text)) return 69
  if (handle === 'ai-writing-assistants' && hasAnyCategory('ai-homework-helper', 'ai-answer', 'ai-math', 'ai-course')) return 69
  if (handle === 'ai-writing-assistants' && hasAnyCategory('ai-note-taker', 'ai-email-writer', 'ai-email-assistant', 'ai-cover-letter-generator', 'ai-resume-builder', 'ai-resume-checker', 'ai-research-tool') && !hasAnyCategory('ai-grammar-checker', 'ai-paraphraser', 'ai-rewriter', 'ai-text-generator', 'ai-writing')) return 69
  return 100
}

function labelForScore(score) {
  if (score >= 70) return 'STRONG'
  if (score >= 50) return 'MEDIUM'
  if (score >= 30) return 'WEAK'
  return 'INVALID'
}

function scoreGuideTool(tool, category, { fallback = false } = {}) {
  const currentCategory = category?.raw || category?.level2
  const links = tool.toolCategories || []
  const currentLink = links.find((link) => Number(link.categoryId) === Number(currentCategory?.id))
  const categoryCount = links.length
  const hits = categoryKeywordHits(tool, currentCategory)
  const sourceComplete = hasSourceCompleteness(tool)
  const contentComplete = hasContentCompleteness(tool)
  const pricingComplete = hasPricingContext(tool)
  const genericPenalty = isGenericTool(tool, currentCategory)
  const categoryHandles = links.map((link) => link.category?.handle).filter(Boolean)

  let score = 0
  const reasons = []
  if (currentLink) {
    score += 50
    reasons.push('bound to current L2')
  }
  if (hits.hasHit) {
    const keywordScore = hits.phraseHit || (currentCategory?.handle === 'ai-summarizer' && hits.tokenHits.includes('summarizer'))
      ? 20
      : Math.min(15, hits.tokenHits.length * 8)
    score += keywordScore
    reasons.push(`matches category keywords: ${(hits.phraseHit ? ['phrase'] : hits.tokenHits).slice(0, 3).join(', ')}`)
  }
  if (currentCategory?.handle === 'ai-writing-assistants' && categoryHandles.some((handle) => ['ai-grammar-checker', 'ai-paraphraser', 'ai-rewriter', 'ai-text-generator', 'ai-writing'].includes(handle))) {
    score += 15
    reasons.push('matches writing-core adjacent category')
  }
  if (currentCategory?.handle === 'ai-summarizer' && categoryHandles.some((handle) => ['ai-pdf-summarizer', 'ai-video-summarizer', 'ai-youtube-summary', 'ai-article-summarizer', 'ai-book-summarizer'].includes(handle))) {
    score += 15
    reasons.push('matches summarizer-core adjacent category')
  }
  if (categoryCount > 0 && categoryCount <= 5) {
    score += 15
    reasons.push('focused category footprint')
  }
  if (categoryCount > 8) {
    score -= 15
    reasons.push('broad multi-category binding')
  }
  if (genericPenalty) {
    score -= 10
    reasons.push('generic assistant/productivity positioning')
  }
  if (sourceComplete) {
    score += 10
    reasons.push('has official/source context')
  }
  if (contentComplete) {
    score += 10
    reasons.push('has usable content fields')
  }
  if (pricingComplete) {
    score += 5
    reasons.push('has pricing context')
  }

  const categoryFocusScore = calculateCategoryFocusScore({
    currentCategory,
    categoryHandles,
    categoryCount,
    hits,
    genericPenalty,
  })
  score = Math.min(score, relevanceCap(tool, currentCategory, hits))
  if (fallback) score = Math.min(score, 69)
  score = Math.max(0, Math.min(100, Math.round(score)))

  return {
    ...tool,
    categoryRelevanceScore: score,
    relevanceLabel: labelForScore(score),
    selectionReason: reasons.join('; ') || 'low category evidence',
    sourceCompletenessScore: sourceComplete ? 1 : 0,
    contentCompletenessScore: contentComplete ? 1 : 0,
    categoryFocusScore,
    isFallback: fallback,
  }
}

function calculateCategoryFocusScore({ currentCategory, categoryHandles, categoryCount, hits, genericPenalty }) {
  let score = 0
  if (hits.phraseHit) score += 20
  score += Math.min(12, (hits.tokenHits || []).length * 4)
  if (currentCategory?.handle === 'ai-writing-assistants' && categoryHandles.some((handle) => ['ai-grammar-checker', 'ai-paraphraser', 'ai-rewriter', 'ai-text-generator', 'ai-writing'].includes(handle))) score += 18
  if (currentCategory?.handle === 'ai-summarizer' && categoryHandles.some((handle) => ['ai-pdf-summarizer', 'ai-video-summarizer', 'ai-youtube-summary', 'ai-article-summarizer', 'ai-book-summarizer'].includes(handle))) score += 18
  if (categoryCount > 0 && categoryCount <= 5) score += 8
  if (categoryCount > 8) score -= 8
  if (genericPenalty) score -= 6
  return Math.max(0, Math.min(60, score))
}

function guideSortValue(label) {
  return label === 'STRONG' ? 2 : label === 'MEDIUM' ? 1 : 0
}

function sortGuideTools(a, b) {
  const labelDiff = guideSortValue(b.relevanceLabel) - guideSortValue(a.relevanceLabel)
  if (labelDiff) return labelDiff
  if (b.categoryRelevanceScore !== a.categoryRelevanceScore) return b.categoryRelevanceScore - a.categoryRelevanceScore
  if ((b.sourceCompletenessScore || 0) !== (a.sourceCompletenessScore || 0)) return (b.sourceCompletenessScore || 0) - (a.sourceCompletenessScore || 0)
  if ((b.contentCompletenessScore || 0) !== (a.contentCompletenessScore || 0)) return (b.contentCompletenessScore || 0) - (a.contentCompletenessScore || 0)
  const visitDiff = (toNumber(b.monthVisitedCount) || 0) - (toNumber(a.monthVisitedCount) || 0)
  if (visitDiff) return visitDiff
  if ((a.rank || 0) !== (b.rank || 0)) return (a.rank || 0) - (b.rank || 0)
  return (a.id || 0) - (b.id || 0)
}

function dedupeTools(tools) {
  return Array.from(new Map((tools || []).filter(Boolean).map((tool) => [tool.id, tool])).values())
}

function selectGuideTools(candidates, category, targetLimit) {
  const scored = dedupeTools(candidates).map((tool) => scoreGuideTool(tool, category))
  const selected = [
    ...scored.filter((tool) => tool.relevanceLabel === 'STRONG').sort(sortGuideTools),
    ...scored.filter((tool) => tool.relevanceLabel === 'MEDIUM').sort(sortGuideTools),
  ].slice(0, targetLimit)
  return {
    scored,
    selected,
    counts: {
      total: scored.length,
      STRONG: scored.filter((tool) => tool.relevanceLabel === 'STRONG').length,
      MEDIUM: scored.filter((tool) => tool.relevanceLabel === 'MEDIUM').length,
      WEAK: scored.filter((tool) => tool.relevanceLabel === 'WEAK').length,
      INVALID: scored.filter((tool) => tool.relevanceLabel === 'INVALID').length,
    },
  }
}

async function fetchGuideToolSelection(task, category) {
  if (!category?.level2?.id) {
    throw new Error('BUYER_GUIDE/CATEGORY_GUIDE requires categoryId; Guide generation cannot fall back to global tools')
  }

  const targetLimit = Math.min(GUIDE_MAX_SELECTED_TOOLS, Math.max(GUIDE_MIN_SELECTED_TOOLS, Number(task.limit) || GUIDE_MIN_SELECTED_TOOLS))
  const candidates = await fetchGuideCandidateTools({ categoryId: category.level2.id })
  const selection = selectGuideTools(candidates, category, targetLimit)
  if (!selection.selected.length) {
    throw new Error(`No STRONG or MEDIUM tools available for categoryId=${category.level2.id}`)
  }

  let fallbackTools = []
  if (selection.selected.length < GUIDE_MIN_SELECTED_TOOLS) {
    const fallbackCandidates = await fetchGuideFallbackTools({
      category,
      excludeIds: selection.selected.map((tool) => tool.id),
    })
    fallbackTools = dedupeTools(fallbackCandidates)
      .map((tool) => scoreGuideTool(tool, category, { fallback: true }))
      .filter((tool) => ['STRONG', 'MEDIUM'].includes(tool.relevanceLabel))
      .sort(sortGuideTools)
      .slice(0, GUIDE_FALLBACK_LIMIT)
  }

  return {
    ...selection,
    fallbackTools,
  }
}

function requestedToolIds(task) {
  const promptJson = task.promptJson && typeof task.promptJson === 'object' ? task.promptJson : {}
  return {
    primaryToolId: Number(task.primaryToolId || promptJson.primaryToolId || task.toolId) || null,
    secondaryToolId: Number(task.secondaryToolId || promptJson.secondaryToolId) || null,
  }
}

async function fetchCompareTools(task) {
  const { primaryToolId, secondaryToolId } = requestedToolIds(task)
  const limit = Math.min(30, Math.max(2, Number(task.limit) || 5))

  let primaryTool = null
  let secondaryTool = null
  if (primaryToolId) {
    primaryTool = (await fetchTools({ toolId: primaryToolId, limit: 1 }))[0] || null
    if (!primaryTool) throw new Error(`primaryToolNotFound: ${primaryToolId}`)
  }
  if (secondaryToolId) {
    secondaryTool = (await fetchTools({ toolId: secondaryToolId, limit: 1 }))[0] || null
    if (!secondaryTool) throw new Error(`secondaryToolNotFound: ${secondaryToolId}`)
  }
  if (primaryTool && secondaryTool && primaryTool.id === secondaryTool.id) {
    throw new Error('secondaryToolSameAsPrimary')
  }

  const inferredCategoryId = Number(task.categoryId)
    || Number(primaryTool?.toolCategories?.[0]?.categoryId)
    || null
  const candidates = await fetchTools({ categoryId: inferredCategoryId, limit })
  if (!primaryTool) primaryTool = candidates[0] || null
  if (!secondaryTool) secondaryTool = candidates.find(tool => tool.id !== primaryTool?.id) || null

  if (!primaryTool) throw new Error('primaryToolNotFound')
  if (!secondaryTool) throw new Error('secondaryToolNotFound: no distinct tool available in the selected category')

  const tools = Array.from(new Map([primaryTool, secondaryTool, ...candidates].map(tool => [tool.id, tool])).values())
  const selectedToolStrategy = secondaryToolId
    ? 'explicit-primary-secondary'
    : primaryToolId
      ? 'task-toolId-primary-category-secondary'
      : 'category-ranked-primary-secondary'

  return { tools, primaryTool, secondaryTool, selectedToolStrategy, inferredCategoryId }
}

function buildSlug(task, category, tools, suffix) {
  const base = task.slug || category?.level2?.handle || tools[0]?.handle || task.title || 'ai-tools'
  return slugify(`${base}${suffix ? `-${suffix}` : ''}`)
}

export async function buildContentSourceData(task) {
  const type = String(task.contentType || '').trim().toUpperCase()
  if (!SUPPORTED_CONTENT_TYPES.has(type)) {
    throw new Error(`unsupportedContentType: ${type || '(empty)'}`)
  }

  if (type === 'COMPARISON' || type === 'ALTERNATIVE') {
    const selection = await fetchCompareTools(task)
    const categoryId = Number(task.categoryId) || selection.inferredCategoryId
    const [category, relatedCategories] = await Promise.all([
      fetchCategory(categoryId),
      fetchRelatedCategories(categoryId),
    ])
    if (task.categoryId && !category) {
      throw new Error(`categoryNotFound: categoryId=${task.categoryId}`)
    }
    return buildCompareSourceData(task, category, selection.tools, relatedCategories, selection)
  }

  const [category, relatedCategories] = await Promise.all([
    fetchCategory(task.categoryId),
    fetchRelatedCategories(task.categoryId),
  ])

  if (!task.categoryId) {
    throw new Error('BUYER_GUIDE/CATEGORY_GUIDE requires categoryId; Guide generation cannot fall back to global tools')
  }
  if (!category) {
    throw new Error(`分类不存在：categoryId=${task.categoryId}`)
  }
  const selection = await fetchGuideToolSelection(task, category)
  if (!selection.selected.length) {
    throw new Error('没有找到可用于生成的已发布 AI 工具数据')
  }

  return buildGuideSourceData(task, category, selection.selected, relatedCategories, selection)
}

function buildGuideSourceData(task, category, tools, relatedCategories, selection = null) {
  const requestedType = String(task.contentType || '').trim().toUpperCase()
  if (!['BUYER_GUIDE', 'CATEGORY_GUIDE', 'TUTORIAL'].includes(requestedType)) {
    throw new Error(`unsupportedContentType: ${requestedType || '(empty)'}`)
  }
  const contentType = requestedType
  const slug = buildSlug(task, category, tools, contentType === 'TUTORIAL' ? 'tutorial' : '')
  const mappedTools = tools.map(mapTool)
  const primaryTool = task.toolId ? mappedTools[0] || null : null
  const fallbackTools = (selection?.fallbackTools || []).map(mapTool)

  return {
    task: 'generate_guide',
    contentType,
    slug,
    canonicalPath: `/guides/${slug}`,
    language: 'en',
    audience: 'buyers evaluating AI tools',
    intent: contentType === 'TUTORIAL' ? 'tutorial' : 'choose_tools',
    category: category ? { level1: category.level1, level2: category.level2 } : null,
    relatedCategories,
    primaryTool,
    topTools: mappedTools,
    tools: mappedTools,
    selectedTools: mappedTools,
    fallbackTools,
    sources: collectSources([...tools, ...(selection?.fallbackTools || [])]),
    selectedToolStrategy: task.toolId ? 'explicit-guide-tool' : 'category-relevance-ranked-tools',
    toolSelectionDiagnostics: selection
      ? {
          candidateCount: selection.counts.total,
          relevanceCounts: {
            STRONG: selection.counts.STRONG,
            MEDIUM: selection.counts.MEDIUM,
            WEAK: selection.counts.WEAK,
            INVALID: selection.counts.INVALID,
          },
          selectedCount: mappedTools.length,
          fallbackCount: fallbackTools.length,
          minSelectedTools: GUIDE_MIN_SELECTED_TOOLS,
          maxSelectedTools: GUIDE_MAX_SELECTED_TOOLS,
        }
      : null,
    siteRules: {
      brand: 'AISeekTools',
      forbiddenClaims: ['unverified pricing', 'guaranteed outcomes', 'legal advice', 'medical advice', 'financial advice'],
    },
  }
}

function buildCompareSourceData(task, category, tools, relatedCategories, selection) {
  const mappedTools = tools.map(mapTool)
  const primaryTool = mappedTools.find(tool => tool.id === selection.primaryTool.id) || null
  const secondaryTool = mappedTools.find(tool => tool.id === selection.secondaryTool.id) || null
  const contentType = String(task.contentType || '').trim().toUpperCase() === 'ALTERNATIVE'
    ? 'ALTERNATIVE'
    : 'COMPARISON'
  const comparisonType = contentType === 'ALTERNATIVE'
    ? 'ALTERNATIVES'
    : (secondaryTool ? 'TOOL_VS_TOOL' : 'MULTI_TOOL')
  const slug = buildSlug(task, category, tools, contentType === 'ALTERNATIVE' ? 'alternatives' : 'comparison')

  return {
    task: 'generate_compare',
    contentType,
    comparisonType,
    slug,
    canonicalPath: `/compare/${slug}`,
    language: 'en',
    primaryTool,
    secondaryTool,
    selectedToolStrategy: selection.selectedToolStrategy,
    tools: mappedTools,
    category: category?.level2 || null,
    categoryTopTools: mappedTools,
    relatedCategories,
    knownPricing: mappedTools.flatMap((tool) => [
      ...(tool.pricing || []),
      ...(tool.pricingPlans || []).map((plan) => plan.rawText || plan.planName).filter(Boolean),
    ]),
    knownClaims: mappedTools.flatMap((tool) => tool.claims || []),
    sources: collectSources(tools),
    requiredCriteria: ['Ease of use', 'Output quality', 'Integrations', 'Pricing', 'Best fit'],
  }
}
