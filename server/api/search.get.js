import prisma from '~/server/utils/prisma'

const PAGE_SIZE = 12
const MAX_PAGE = 50
// 首页广告位插入点（1-indexed 人类计数）：第 4、第 12 位
const AD_POSITIONS = [3, 11]
const POPULAR_FALLBACK = 12
const TRENDING_TAGS = ['AI Video', 'SEO Writing', 'Chatbot', 'Image', 'Voice', 'Coding']
const SIMILAR_CATS_TAKE = 10

const TOOL_SELECT = {
  id: true,
  handle: true,
  name: true,
  description: true,
  website: true,
  website_logo: true,
  month_visited_count: true,
  collected_count: true,
  is_free: true,
  tool_info_review: true,
  pricing: true,
  tags: true,
}

/** 把 DB 原始字段映射成前端（SubToolCard）需要的形状 */
const shapeTool = (t, i = 0) => ({
  id: t.id,
  handle: t.handle,
  name: t.name,
  shortDesc: t.description || '',
  iconUrl: t.website_logo || null,
  website: t.website || null,
  isFree: Boolean(t.is_free),
  rating: t.tool_info_review ? Number(t.tool_info_review) : null,
  monthlyVisits: Number(t.month_visited_count || 0),
  collected: Number(t.collected_count || 0),
  pricing: Array.isArray(t.pricing) ? t.pricing : [],
  tags: Array.isArray(t.tags) ? t.tags.slice(0, 3) : [],
  isAd: false,
  __rank: i + 1,
})

/**
 * 搜索 API
 * 性能红线：
 * 1. 字段白名单（TOOL_SELECT），严禁 SELECT *
 * 2. 结果 + 总数通过 Promise.all 并行
 * 3. 固定 pageSize = 12，max page = 50，防止刷爆 DB
 * 4. 空关键词或零命中时回退 TOP 12 热门（杜绝白屏跳出）
 * 5. Cache-Control: 30min 公共缓存
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  // ---------- 1. 参数归一化 ----------
  const q = (typeof query.q === 'string' ? query.q : '').trim().slice(0, 80)
  const price = ['free', 'freemium', 'pro'].includes(query.price) ? query.price : 'all'
  const sort = ['relevance', 'rating', 'new'].includes(query.sort) ? query.sort : 'relevance'
  const page = Math.max(1, Math.min(MAX_PAGE, Number(query.page) || 1))

  // ---------- 2. 构造 where ----------
  const kwWhere = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { tags: { has: q } },
        ],
      }
    : {}

  const priceWhere = (() => {
    switch (price) {
      case 'free':
        // 纯免费：is_free=true 且无 pricing 档位
        return { is_free: true, pricing: { isEmpty: true } }
      case 'freemium':
        // 免费+付费档位并存
        return { is_free: true, pricing: { isEmpty: false } }
      case 'pro':
        return { is_free: false }
      default:
        return {}
    }
  })()

  const where = { ...kwWhere, ...priceWhere }

  // ---------- 3. 排序 ----------
  const orderBy = (() => {
    switch (sort) {
      case 'rating':
        return [{ tool_info_review: 'desc' }, { month_visited_count: 'desc' }]
      case 'new':
        return [{ created_at: 'desc' }, { month_visited_count: 'desc' }]
      case 'relevance':
      default:
        // 没有 FTS 的情况下：把流量作为相关性兜底（热 = 最匹配用户意图）
        return [{ month_visited_count: 'desc' }, { collected_count: 'desc' }]
    }
  })()

  // ---------- 4. 并行：结果 + 总数 + 相似分类 ----------
  const [total, rows, similarCategories] = await Promise.all([
    prisma.aiTool.count({ where }),
    prisma.aiTool.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: TOOL_SELECT,
    }),
    // 相似分类：固定 10 个（流量分发用）
    prisma.categoryLevel2.findMany({
      where: { is_active: true },
      orderBy: [{ tool_count: 'desc' }, { sort: 'asc' }],
      take: SIMILAR_CATS_TAKE,
      select: {
        id: true,
        name: true,
        handle: true,
        tool_count: true,
        level1: { select: { handle: true } },
      },
    }),
  ])

  // ---------- 5. 结果成型 ----------
  const tools = rows.map((t, i) => shapeTool(t, (page - 1) * PAGE_SIZE + i))

  // 仅首页注入广告位（SPA 翻页继续注入易造成视觉疲劳）
  if (page === 1 && tools.length) {
    AD_POSITIONS.forEach((idx) => {
      if (idx <= tools.length) {
        tools.splice(idx, 0, {
          isAd: true,
          id: `ad-${idx}`,
          slotId: `search-inline-${idx}`,
        })
      }
    })
  }

  // ---------- 6. 兜底：空关键词 / 零命中 —— 塞 12 个热门 ----------
  let popularFallback = []
  const isEmptyResult = q && total === 0
  const needFallback = isEmptyResult || !q

  if (needFallback) {
    const rawPopular = await prisma.aiTool.findMany({
      where: { website_logo: { not: null } },
      orderBy: [{ month_visited_count: 'desc' }, { collected_count: 'desc' }],
      take: POPULAR_FALLBACK,
      select: TOOL_SELECT,
    })
    popularFallback = rawPopular.map((t, i) => shapeTool(t, i))
  }

  // ---------- 7. 缓存头 ----------
  setHeader(event, 'Cache-Control', 'public, max-age=300, stale-while-revalidate=1800')
  setHeader(event, 'CDN-Cache-Control', 'public, max-age=1800')

  return {
    q,
    filters: { price, sort },
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      hasMore: page * PAGE_SIZE < total,
    },
    tools,
    popularFallback,
    similarCategories: similarCategories.map((c) => ({
      id: c.id,
      name: c.name,
      handle: c.handle,
      toolCount: c.tool_count || 0,
      parentHandle: c.level1?.handle || '',
    })),
    trendingTags: TRENDING_TAGS,
    meta: {
      hasQuery: Boolean(q),
      isEmpty: isEmptyResult,
    },
  }
})
