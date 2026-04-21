import prisma from '~/server/utils/prisma'

/**
 * 一级分类详情页 API —— /api/category/[parentSlug]
 *
 * 返回结构：
 *   - category       一级分类基本信息 + L2 聚合统计
 *   - subCategories  当前 L1 下的 L2 分页列表（28/页）
 *   - pagination     分页元数据
 *   - topTools       本 L1 下 12 个热门工具（is_ad 优先、流量降序）
 *
 * 性能约束：
 *   1. 先串行拿 L1 id + L2.id 列表（一次 query），之后 3 查询并行
 *   2. Prisma select 字段严格白名单，禁 select *
 *   3. defineCachedEventHandler —— 1 小时缓存，命中 0 DB 读
 *   4. 热门工具 is_ad=true 优先（高佣金/PGC 位），再按月访问量降序
 */

const SUBS_PER_PAGE = 28
const TOP_TOOLS_TAKE = 12
const AD_SLOT_POSITION = 3 // 工具列表第 3 位插入原生广告位

const L2_SELECT = {
  id: true,
  name: true,
  handle: true,
  tool_count: true,
  what_is_summary: true,
}

const TOOL_SELECT = {
  id: true,
  handle: true,
  name: true,
  description: true,
  website: true,
  website_logo: true,
  image: true,
  month_visited_count: true,
  is_free: true,
  is_ad: true,
  tool_info_review: true,
  pricing: true,
  tags: true,
}

export default defineCachedEventHandler(
  async (event) => {
    // ---------- 1. 取 parentSlug ----------
    const slug = getRouterParam(event, 'parentSlug')
    if (!slug) {
      throw createError({ statusCode: 400, statusMessage: 'Missing parentSlug' })
    }

    const query = getQuery(event)
    const page = Math.max(1, Number(query.page) || 1)
    const pageSize = Math.min(60, Math.max(6, Number(query.pageSize) || SUBS_PER_PAGE))

    // ---------- 2. 取 L1 及全部 L2.id（后续工具查询需要） ----------
    const l1 = await prisma.categoryLevel1.findUnique({
      where: { handle: slug },
      select: {
        id: true,
        name: true,
        handle: true,
        level2Categories: {
          where: { is_active: true },
          select: { id: true, tool_count: true },
        },
      },
    })

    if (!l1) {
      throw createError({ statusCode: 404, statusMessage: 'Category not found' })
    }

    const l2Ids = l1.level2Categories.map((x) => x.id)
    const totalTools = l1.level2Categories.reduce(
      (sum, x) => sum + (x.tool_count || 0),
      0,
    )

    // ---------- 3. 并行：L2 分页列表 / L2 总数 / 热门工具 ----------
    const [subCatsRaw, subTotal, topToolsRaw] = await Promise.all([
      prisma.categoryLevel2.findMany({
        where: { level1Id: l1.id, is_active: true },
        orderBy: [{ tool_count: 'desc' }, { sort: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: L2_SELECT,
      }),

      prisma.categoryLevel2.count({
        where: { level1Id: l1.id, is_active: true },
      }),

      // 空 L1（没有任何 L2）时避免 `in: []` 无意义查询
      l2Ids.length
        ? prisma.aiTool.findMany({
            where: {
              toolCategories: {
                some: { categoryId: { in: l2Ids } },
              },
            },
            orderBy: [
              { is_ad: 'desc' }, // 付费/高佣金位置优先
              { month_visited_count: 'desc' }, // 再按流量
              { collected_count: 'desc' },
            ],
            take: TOP_TOOLS_TAKE,
            select: TOOL_SELECT,
          })
        : Promise.resolve([]),
    ])

    // ---------- 4. 数据整形 ----------
    const subCategories = subCatsRaw.map((c) => ({
      id: c.id,
      name: c.name,
      handle: c.handle,
      parentHandle: l1.handle,
      toolCount: c.tool_count || 0,
      summary: (c.what_is_summary || '').slice(0, 120),
    }))

    const topTools = topToolsRaw.map((t) => ({
      id: t.id,
      handle: t.handle,
      name: t.name,
      description: t.description || '',
      website: t.website || null,
      website_logo: t.website_logo || null,
      image: t.image || null,
      month_visited_count: Number(t.month_visited_count || 0),
      is_free: Boolean(t.is_free),
      is_ad: Boolean(t.is_ad),
      rating: t.tool_info_review ? Number(t.tool_info_review) : null,
      pricing: Array.isArray(t.pricing) ? t.pricing : [],
      tags: Array.isArray(t.tags) ? t.tags.slice(0, 3) : [],
      isAd: false, // 列表条目类型标记（区别于下方原生广告位）
    }))

    // 列表第 3 位注入原生广告位（仅第 1 页，避免广告污染分页）
    const toolsWithAd = []
    if (page === 1 && topTools.length >= AD_SLOT_POSITION) {
      topTools.forEach((t, i) => {
        toolsWithAd.push(t)
        if (i + 1 === AD_SLOT_POSITION) {
          toolsWithAd.push({
            id: `__ad_l1_${l1.handle}`,
            isAd: true,
            slotId: `cat-l1-native-${l1.handle}`,
          })
        }
      })
    } else {
      toolsWithAd.push(...topTools)
    }

    // ---------- 5. 响应 + Cache-Control ----------
    setHeader(event, 'Cache-Control', 'public, max-age=600, stale-while-revalidate=3600')
    setHeader(event, 'CDN-Cache-Control', 'public, max-age=3600')

    return {
      category: {
        id: l1.id,
        name: l1.name,
        handle: l1.handle,
        subCount: l1.level2Categories.length,
        totalTools,
      },
      subCategories,
      pagination: {
        page,
        pageSize,
        total: subTotal,
        totalPages: Math.max(1, Math.ceil(subTotal / pageSize)),
        hasMore: page * pageSize < subTotal,
      },
      topTools: toolsWithAd,
    }
  },
  {
    name: 'category-l1',
    maxAge: 60 * 60, // 1 小时
    swr: true,
    // 缓存 key 必须带 parentSlug + page，避免串页
    getKey: (event) => {
      const slug = getRouterParam(event, 'parentSlug') || ''
      const q = getQuery(event)
      const page = Math.max(1, Number(q.page) || 1)
      const pageSize = Math.min(60, Math.max(6, Number(q.pageSize) || SUBS_PER_PAGE))
      return `${slug}:p${page}:s${pageSize}`
    },
  },
)
