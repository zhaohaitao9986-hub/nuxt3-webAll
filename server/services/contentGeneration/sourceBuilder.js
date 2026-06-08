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

function mapTool(tool) {
  return {
    id: tool.id,
    handle: tool.handle,
    name: tool.name,
    description: tool.description,
    website: tool.website,
    pricing: tool.pricing || [],
    pricingPlans: [],
    claims: [],
    platforms: tool.website_type || [],
    pros: tool.pros || [],
    cons: tool.cons || [],
    features: tool.feature || [],
    rating: toNumber(tool.tool_info_review),
    monthlyVisits: toNumber(tool.month_visited_count) || 0,
    whatIsSummary: tool.what_is_summary,
    tags: tool.tags || [],
    useCases: tool.use_cases || [],
    forJobs: tool.for_jobs || [],
    companyInfo: tool.company_info,
    isFree: tool.is_free,
  }
}

function collectSources(tools) {
  const sources = []
  const seen = new Set()
  for (const tool of tools) {
    if (!tool.website || seen.has(tool.website)) continue
    seen.add(tool.website)
    sources.push({
      url: tool.website,
      domain: safeDomain(tool.website),
      title: tool.name,
      sourceType: 'OFFICIAL_SITE',
      retrievedAt: null,
      context: `Official website for ${tool.name}`,
      sort: sources.length + 1,
    })
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
      what_is_summary: true,
      feature: true,
      who_is_use: true,
      how_do_work: true,
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
      is_active: true,
      ...(current?.level1Id ? { level1Id: current.level1Id } : {}),
      ...(categoryId ? { NOT: { id: Number(categoryId) } } : {}),
    },
    orderBy: [{ tool_count: 'desc' }, { sort: 'desc' }, { id: 'asc' }],
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
    status: 1,
    handle: { not: '' },
    name: { not: '' },
    ...(task.toolId ? { id: Number(task.toolId) } : {}),
    ...(task.categoryId && !task.toolId ? { toolCategories: { some: { categoryId: Number(task.categoryId) } } } : {}),
  }
  return prisma.aiTool.findMany({
    where,
    orderBy: [{ sort_weight: 'desc' }, { month_visited_count: 'desc' }, { updated_at: 'desc' }],
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

  const type = task.contentType || 'BUYER_GUIDE'
  if (type === 'COMPARISON' || type === 'ALTERNATIVE') {
    return buildCompareSourceData(task, category, tools, relatedCategories)
  }
  return buildGuideSourceData(task, category, tools, relatedCategories)
}

function buildGuideSourceData(task, category, tools, relatedCategories) {
  const contentType = ['BUYER_GUIDE', 'CATEGORY_GUIDE', 'TUTORIAL'].includes(task.contentType)
    ? task.contentType
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
  const contentType = task.contentType === 'ALTERNATIVE' ? 'ALTERNATIVE' : 'COMPARISON'
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
    knownPricing: mappedTools.flatMap((tool) => tool.pricing || []).filter(Boolean),
    knownClaims: [],
    sources: collectSources(tools),
    requiredCriteria: ['Ease of use', 'Output quality', 'Integrations', 'Pricing', 'Best fit'],
  }
}
