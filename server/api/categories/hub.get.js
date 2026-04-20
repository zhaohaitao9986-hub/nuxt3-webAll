import prisma from '~/server/utils/prisma'

const TOP_SUBS_PER_PARENT = 6
const TRENDING_NICHES_TAKE = 6
const HERO_TAGS_TAKE = 8

// 人工标记的高 CPC / 高转化二级分类 handle（按实际业务调整）
// 查询优先展示这些 handle 的二级分类作为 Trending Niches
const CURATED_HIGH_CPC_HANDLES = [
  'ai-video-generator',
  'ai-image-generator',
  'seo-writing',
  'ai-chatbot',
  'ai-code-assistant',
  'ai-voice-generator',
]

/**
 * 分类总枢纽 Hub API
 * 严格约束：
 * 1. Level1 仅 select { id, name, handle, sort }
 * 2. Level2 按 tool_count 降序，每个 Level1 只 take 前 6 个
 * 3. 总计算 Level1 的 subCount 通过 Prisma _count，避免 O(N) 二次查询
 * 4. Nitro 10 分钟边缘缓存
 */
export default defineCachedEventHandler(
  async (event) => {
    // 并行三个独立查询，减少串行 RTT
    const [level1Raw, trendingRaw, hotTags] = await Promise.all([
      // ---------- 20+ Level1 + 每个最多 6 个 Level2 ----------
      prisma.categoryLevel1.findMany({
        where: { is_active: true },
        orderBy: [{ sort: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          handle: true,
          sort: true,
          _count: {
            select: {
              level2Categories: {
                where: { is_active: true },
              },
            },
          },
          level2Categories: {
            where: { is_active: true },
            orderBy: [{ tool_count: 'desc' }, { sort: 'desc' }],
            take: TOP_SUBS_PER_PARENT,
            select: {
              id: true,
              name: true,
              handle: true,
              tool_count: true,
            },
          },
        },
      }),

      // ---------- Trending / 高收益 niches（跨所有 Level1） ----------
      prisma.categoryLevel2.findMany({
        where: {
          is_active: true,
          OR: [
            { handle: { in: CURATED_HIGH_CPC_HANDLES } },
            { tool_count: { gt: 0 } },
          ],
        },
        orderBy: [{ tool_count: 'desc' }, { sort: 'desc' }],
        take: TRENDING_NICHES_TAKE,
        select: {
          id: true,
          name: true,
          handle: true,
          tool_count: true,
          level1: {
            select: { name: true, handle: true },
          },
        },
      }),

      // ---------- Hero 下方的热门搜索 tags ----------
      prisma.categoryLevel2.findMany({
        where: { is_active: true },
        orderBy: [{ tool_count: 'desc' }],
        take: HERO_TAGS_TAKE,
        select: {
          id: true,
          name: true,
          handle: true,
        },
      }),
    ])

    // ---------- 数据整形（Level1 总工具数 = sum of level2.tool_count，但 take 后只有6个不能sum）----------
    // 为了获得 "totalTools" 精确值，我们再做一次聚合查询（Prisma 没有直接 group by 还带 where 的高效办法）
    // 这里选择一次性 groupBy level1Id -> 一次请求解决
    const toolCountsByL1 = await prisma.categoryLevel2.groupBy({
      by: ['level1Id'],
      where: { is_active: true },
      _sum: { tool_count: true },
    })
    const totalToolsMap = new Map(
      toolCountsByL1.map((r) => [r.level1Id, r._sum.tool_count || 0]),
    )

    const level1 = level1Raw.map((l1) => ({
      id: l1.id,
      name: l1.name,
      handle: l1.handle,
      sort: l1.sort,
      subCount: l1._count?.level2Categories || 0,
      totalTools: totalToolsMap.get(l1.id) || 0,
      topSubs: l1.level2Categories.map((s) => ({
        id: s.id,
        name: s.name,
        handle: s.handle,
        toolCount: s.tool_count || 0,
      })),
    }))

    const trending = trendingRaw.map((t) => ({
      id: t.id,
      name: t.name,
      handle: t.handle,
      toolCount: t.tool_count || 0,
      parentName: t.level1?.name || '',
      parentHandle: t.level1?.handle || '',
    }))

    const tags = hotTags.map((t) => ({
      id: t.id,
      name: t.name,
      handle: t.handle,
    }))

    // SEO 富文本 (关键词堆叠，便于 Google 抓)
    const seo = {
      title: 'Explore 400+ AI Categories — The Complete Directory',
      body:
        'aiseekertools.com is the most comprehensive AI tools directory on the web. ' +
        'Browse 20+ top-level categories and 400+ specialized sub-categories spanning ' +
        'AI video generators, AI image generators, AI writing assistants, AI chatbots, ' +
        'AI code assistants, AI SEO tools, AI voice generators, productivity AI, ' +
        'AI for marketers, AI for designers, AI for developers, ChatGPT alternatives, ' +
        'Midjourney alternatives, open-source AI, and more — updated daily.',
    }

    // 对响应设置浏览器边缘缓存（CDN 命中后零延迟）
    setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=600')

    return {
      level1,
      trending,
      tags,
      seo,
      counts: {
        level1Total: level1.length,
        level2Total: level1.reduce((sum, l) => sum + (l.subCount || 0), 0),
      },
    }
  },
  {
    name: 'categories-hub',
    maxAge: 60 * 10,          // 10 分钟内存/存储缓存
    swr: true,                // stale-while-revalidate
    getKey: () => 'v1',       // 无参数，固定 key
  },
)
