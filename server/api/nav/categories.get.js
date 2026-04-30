import prisma from '~/server/utils/prisma'

/**
 * 导航栏 Categories Hover 面板数据源
 * 性能红线：
 * 1. 只返回 L1 + 每个 L1 最多 4 个热门 L2（导航悬停卡够用即可）
 * 2. 字段白名单，payload 体积极小（通常 < 10 KB）
 * 3. 全局 1 小时强缓存（导航数据低频变更）
 * 4. `defineCachedEventHandler` —— 命中缓存 0 DB 读
 *
 * 被 TheHeader 通过 useAsyncData 懒加载（不阻塞首屏）。
 */
export default defineCachedEventHandler(
  async (event) => {
    const rows = await prisma.categoryLevel1.findMany({
      where: { is_active: true },
      orderBy: [{ sort: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        handle: true,
        _count: {
          select: {
            level2Categories: { where: { is_active: true } },
          },
        },
        level2Categories: {
          where: { is_active: true },
          orderBy: [{ tool_count: 'desc' }, { sort: 'desc' }],
          take: 4,
          select: { id: true, name: true, handle: true, tool_count: true },
        },
      },
    })

    const categories = rows.map((l1) => ({
      id: l1.id,
      name: l1.name,
      handle: l1.handle,
      subCount: l1._count?.level2Categories || 0,
      topSubs: (l1.level2Categories || []).map((s) => ({
        id: s.id,
        name: s.name,
        handle: s.handle,
        parentHandle: l1.handle,
        toolCount: s.tool_count || 0,
      })),
    }))

    setHeader(event, 'Cache-Control', 'public, max-age=600, stale-while-revalidate=3600')
    setHeader(event, 'CDN-Cache-Control', 'public, max-age=3600')

    return { categories }
  },
  {
    name: 'nav-categories',
    maxAge: 60 * 60,
    swr: true,
    getKey: () => 'v1',
  },
)
