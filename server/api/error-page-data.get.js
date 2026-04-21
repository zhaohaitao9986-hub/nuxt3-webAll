import prisma from '~/server/utils/prisma'

const TOP_TOOLS_TAKE = 6
const TOP_CATEGORIES_TAKE = 8

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

const QUICK_LINKS = [
  { label: 'Home', to: '/', variant: 'primary', icon: 'home' },
  { label: 'All Categories', to: '/category', variant: 'ghost', icon: 'grid' },
  { label: 'AI Writing', to: '/search?q=AI%20Writing', variant: 'ghost', icon: 'edit' },
  { label: 'AI Video', to: '/search?q=AI%20Video', variant: 'ghost', icon: 'video' },
]

/**
 * Error 页面兜底数据 API
 * 红线：
 * 1. 字段白名单，零 SELECT *
 * 2. Promise.all 并行（热门工具 + 热门分类）
 * 3. 只查有 logo 的工具（小图兜底稳定）
 * 4. 1 小时公共缓存 —— 错误页流量大但数据低频变化
 */
export default defineEventHandler(async (event) => {
  const [rawTools, rawCategories] = await Promise.all([
    prisma.aiTool.findMany({
      where: { website_logo: { not: null } },
      orderBy: [{ month_visited_count: 'desc' }, { collected_count: 'desc' }],
      take: TOP_TOOLS_TAKE,
      select: TOOL_SELECT,
    }),
    prisma.categoryLevel2.findMany({
      where: { is_active: true },
      orderBy: [{ tool_count: 'desc' }, { sort: 'asc' }],
      take: TOP_CATEGORIES_TAKE,
      select: { id: true, name: true, handle: true, tool_count: true },
    }),
  ])

  const tools = rawTools.map((t, i) => ({
    id: t.id,
    handle: t.handle,
    name: t.name,
    shortDesc: t.description || '',
    iconUrl: t.website_logo || null,
    website: t.website || null,
    isFree: Boolean(t.is_free),
    rating: t.tool_info_review ? Number(t.tool_info_review) : null,
    monthlyVisits: Number(t.month_visited_count || 0),
    pricing: Array.isArray(t.pricing) ? t.pricing : [],
    tags: Array.isArray(t.tags) ? t.tags.slice(0, 3) : [],
    isAd: false,
    __rank: i + 1,
  }))

  // 在第 3 位（index 2）注入原生广告位
  if (tools.length >= 3) {
    tools.splice(2, 0, { isAd: true, id: 'ad-error-3', slotId: 'error-inline-3' })
  }

  const categories = rawCategories.map((c) => ({
    id: c.id,
    name: c.name,
    handle: c.handle,
    toolCount: c.tool_count || 0,
  }))

  setHeader(event, 'Cache-Control', 'public, max-age=1800, stale-while-revalidate=3600')
  setHeader(event, 'CDN-Cache-Control', 'public, max-age=3600')

  return {
    tools,
    categories,
    quickLinks: QUICK_LINKS,
  }
})
