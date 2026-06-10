import prisma from '~/server/utils/prisma'

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

async function fetchTools(task) {
  const limit = Math.min(30, Math.max(1, Number(task.limit) || 10))
  const where = {
    toolStatus: { in: ['ONLINE', 'ACTIVE'] },
    handle: { not: '' },
    name: { not: '' },
    ...(task.toolId ? { id: Number(task.toolId) } : {}),
    ...(task.categoryId && !task.toolId ? { toolCategories: { some: { categoryId: Number(task.categoryId) } } } : {}),
  }
  return prisma.aiTool.findMany({
    where,
    orderBy: [{ rank: 'asc' }, { monthVisitedCount: 'desc' }, { updatedAt: 'desc' }],
    include: {
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
    },
    take: limit,
  })
}

function buildSlug(task, category, tools, suffix) {
  const base = task.slug || category?.level2?.handle || tools[0]?.handle || task.title || 'ai-tools'
  return slugify(`${base}${suffix ? `-${suffix}` : ''}`)
}

export async function buildContentSourceData(task) {
  const [category, tools, relatedCategories] = await Promise.all([
    fetchCategory(task.categoryId),
    fetchTools(task),
    fetchRelatedCategories(task.categoryId),
  ])

  if (task.categoryId && !category) {
    throw new Error(`分类不存在：categoryId=${task.categoryId}`)
  }
  if (!tools.length) {
    throw new Error('没有找到可用于生成的已发布 AI 工具数据')
  }

  const type = String(task.contentType || 'BUYER_GUIDE').trim().toUpperCase()
  if (type === 'COMPARISON' || type === 'ALTERNATIVE') {
    return buildCompareSourceData(task, category, tools, relatedCategories)
  }
  return buildGuideSourceData(task, category, tools, relatedCategories)
}

function buildGuideSourceData(task, category, tools, relatedCategories) {
  const requestedType = String(task.contentType || '').trim().toUpperCase()
  const contentType = ['BUYER_GUIDE', 'CATEGORY_GUIDE', 'TUTORIAL'].includes(requestedType)
    ? requestedType
    : 'BUYER_GUIDE'
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
    siteRules: {
      brand: 'AISeekTools',
      forbiddenClaims: ['unverified pricing', 'guaranteed outcomes', 'legal advice', 'medical advice', 'financial advice'],
    },
  }
}

function buildCompareSourceData(task, category, tools, relatedCategories) {
  const mappedTools = tools.map(mapTool)
  const primaryTool = mappedTools[0] || null
  const secondaryTool = mappedTools.find((tool) => tool.id !== primaryTool?.id) || null
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
