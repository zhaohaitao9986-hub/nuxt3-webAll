import prisma from '~/server/utils/prisma'

const TOOLS_PER_PAGE = 30
const RELATED_NICHES_TAKE = 12
const AD_POSITIONS = [3, 10] // 1-based positions where native ads are injected

// 工具字段白名单 —— 严禁 SELECT *
const TOOL_SELECT = {
  id: true,
  handle: true,
  name: true,
  description: true,
  website: true,
  website_logo: true,
  month_visited_count: true,
  is_free: true,
  tool_info_review: true,
  pricing: true,
  tags: true,
}

/**
 * 二级分类详情页 API
 * 性能红线：
 * 1. Prisma select 严格白名单，不走 SELECT *
 * 2. 并行查询：category + related-niches
 * 3. 工具列表限定 take: 30，分页由 ?page 控制
 * 4. isAd 标记由后端混入，前端零判断逻辑
 * 5. Cache-Control public max-age=60, SWR=600 —— 命中 CDN 即零 DB
 */
export default defineEventHandler(async (event) => {
  // ---------- 1. slug 规范化 ----------
  let slug = getRouterParam(event, 'slug')
  if (slug && slug.includes(',')) {
    const parts = slug.split(',')
    slug = parts[parts.length - 1]
  }
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing category slug' })
  }

  // ---------- 2. 分页参数 ----------
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(50, Math.max(6, Number(query.pageSize) || TOOLS_PER_PAGE))

  // ---------- 3. 先查分类（拿 level1Id 才能并行查 related） ----------
  const category = await prisma.categoryLevel2.findUnique({
    where: { handle: slug },
    select: {
      id: true,
      name: true,
      handle: true,
      tool_count: true,
      what_is_summary: true,
      feature: true,
      who_is_use: true,
      how_do_work: true,
      advantages: true,
      faq: true,
      level1Id: true,
      level1: {
        select: { id: true, name: true, handle: true },
      },
    },
  })

  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }

  // ---------- 4. 并行查询：tools count / tools page / related niches ----------
  const where = {
    toolCategories: {
      some: { categoryId: category.id },
    },
  }

  const [total, toolsRaw, relatedNiches] = await Promise.all([
    prisma.aiTool.count({ where }),

    prisma.aiTool.findMany({
      where,
      orderBy: [
        { month_visited_count: 'desc' },
        { collected_count: 'desc' },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: TOOL_SELECT,
    }),

    prisma.categoryLevel2.findMany({
      where: {
        is_active: true,
        level1Id: category.level1Id,
        NOT: { id: category.id },
      },
      orderBy: [{ tool_count: 'desc' }, { sort: 'desc' }],
      take: RELATED_NICHES_TAKE,
      select: {
        id: true,
        name: true,
        handle: true,
        tool_count: true,
      },
    }),
  ])
  // ---------- 5. 工具数据整形 + 原生广告混入 ----------
  const tools = toolsRaw.map((t) => ({
    id: t.id,
    handle: t.handle,
    name: t.name,
    shortDesc: t.description || '',
    iconUrl: t.website_logo || null,
    rating: t.tool_info_review ? Number(t.tool_info_review) : null,
    pricing: Array.isArray(t.pricing) ? t.pricing : [],
    tags: Array.isArray(t.tags) ? t.tags.slice(0, 3) : [],
    isFree: Boolean(t.is_free),
    monthlyVisits: Number(t.month_visited_count || 0),
    website: t.website || null,
    isAd: false,
  }))
console.log(toolsRaw,'33333')
  // 混入广告占位。仅在第 1 页注入，且当工具数足够时才插入（避免空列表全是广告）
  const toolsWithAds = []
  if (page === 1) {
    const adSlotIds = ['sub-cat-ad-1', 'sub-cat-ad-2']
    let adIdx = 0
    tools.forEach((tool, i) => {
      toolsWithAds.push(tool)
      const pos = i + 1
      if (AD_POSITIONS.includes(pos) && adIdx < adSlotIds.length && tools.length > pos) {
        toolsWithAds.push({
          id: `__ad_${adSlotIds[adIdx]}`,
          isAd: true,
          slotId: adSlotIds[adIdx],
        })
        adIdx++
      }
    })
  } else {
    toolsWithAds.push(...tools)
  }

  // ---------- 6. FAQ 规范化 ----------
  const faqRaw = Array.isArray(category.faq) ? category.faq : []
  const faq = faqRaw
    .map((item) => {
      if (!item) return null
      const question = item.title || item.question || ''
      const answer = item.desc || item.answer || ''
      if (!question || !answer) return null
      return { question: String(question), answer: String(answer) }
    })
    .filter(Boolean)

  // ---------- 7. 响应 + Cache-Control ----------
  setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=600')
  setHeader(event, 'CDN-Cache-Control', 'public, max-age=300')

  return {
    category: {
      id: category.id,
      name: category.name,
      handle: category.handle,
      toolCount: total,
      what_is_summary: category.what_is_summary,
      feature: category.feature,
      who_is_use: category.who_is_use,
      how_do_work: category.how_do_work,
      advantages: category.advantages,
      faq,
      parent: category.level1,
    },
    tools: toolsWithAds,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasMore: page * pageSize < total,
    },
    relatedNiches: relatedNiches.map((r) => ({
      id: r.id,
      name: r.name,
      handle: r.handle,
      toolCount: r.tool_count || 0,
    })),
  }
})
