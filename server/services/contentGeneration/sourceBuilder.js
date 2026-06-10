import prisma from '~/server/utils/prisma'

const SUPPORTED_CONTENT_TYPES = new Set([
  'BUYER_GUIDE',
  'CATEGORY_GUIDE',
  'TUTORIAL',
  'COMPARISON',
  'ALTERNATIVE',
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
      select: { categoryId: true },
      orderBy: { categoryId: 'asc' },
    },
  }
}

async function fetchTools({ categoryId = null, toolId = null, limit = 10, excludeIds = [] } = {}) {
  const safeLimit = Math.min(30, Math.max(1, Number(limit) || 10))
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

function requestedToolIds(task) {
  const promptJson = task.promptJson && typeof task.promptJson === 'object' ? task.promptJson : {}
  return {
    primaryToolId: Number(task.primaryToolId || promptJson.primaryToolId || task.toolId) || null,
    secondaryToolId: Number(task.secondaryToolId || promptJson.secondaryToolId) || null,
  }
}

async function fetchCompareTools(task) {
  const { primaryToolId, secondaryToolId } = requestedToolIds(task)
  const limit = Math.min(30, Math.max(2, Number(task.limit) || 10))

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

  const [category, tools, relatedCategories] = await Promise.all([
    fetchCategory(task.categoryId),
    fetchTools({ categoryId: task.categoryId, toolId: task.toolId, limit: task.limit }),
    fetchRelatedCategories(task.categoryId),
  ])

  if (task.categoryId && !category) {
    throw new Error(`分类不存在：categoryId=${task.categoryId}`)
  }
  if (!tools.length) {
    throw new Error('没有找到可用于生成的已发布 AI 工具数据')
  }

  return buildGuideSourceData(task, category, tools, relatedCategories)
}

function buildGuideSourceData(task, category, tools, relatedCategories) {
  const requestedType = String(task.contentType || '').trim().toUpperCase()
  if (!['BUYER_GUIDE', 'CATEGORY_GUIDE', 'TUTORIAL'].includes(requestedType)) {
    throw new Error(`unsupportedContentType: ${requestedType || '(empty)'}`)
  }
  const contentType = requestedType
  const slug = buildSlug(task, category, tools, contentType === 'TUTORIAL' ? 'tutorial' : '')
  const mappedTools = tools.map(mapTool)
  const primaryTool = task.toolId ? mappedTools[0] || null : null

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
    sources: collectSources(tools),
    selectedToolStrategy: task.toolId ? 'explicit-guide-tool' : 'category-ranked-tools',
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
