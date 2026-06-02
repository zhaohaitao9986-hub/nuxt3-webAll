import prisma from '~/server/utils/prisma'

const MAX_PAGE_SIZE = 20
const DEFAULT_PAGE_SIZE = 12

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(query.pageSize) || DEFAULT_PAGE_SIZE),
  )
  const category = typeof query.category === 'string' ? query.category : 'all'
  const search = typeof query.q === 'string' ? query.q.trim() : ''
  const sort = query.sort === 'new' ? 'new' : 'hot'

  const where = {
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
            { tags: { has: search } },
          ],
        }
      : {}),
    ...(category !== 'all'
      ? {
          toolCategories: {
            some: {
              category: {
                handle: category,
                isActive: true,
              },
            },
          },
        }
      : {}),
  }

  const [total, tools, categories] = await prisma.$transaction([
    prisma.aiTool.count({ where }),
    prisma.aiTool.findMany({
      where,
      orderBy:
        sort === 'new'
          ? [{ createdAt: 'desc' }]
          : [{ monthVisitedCount: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        handle: true,
        name: true,
        description: true,
        website: true,
        websiteLogo: true,
        monthVisitedCount: true,
        collectedCount: true,
        isFree: true,
        toolCategories: {
          select: {
            category: {
              select: {
                name: true,
                handle: true,
              },
            },
          },
          take: 2,
        },
      },
    } as any),
    prisma.categoryLevel2.findMany({
      where: { isActive: true },
      orderBy: [{ sort: 'asc' }, { toolCount: 'desc' }],
      take: 12,
      select: {
        name: true,
        handle: true,
        toolCount: true,
      },
    } as any),
  ]) as [number, any[], any[]]

  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    categories: categories.map((category: any) => ({
      name: category.name,
      handle: category.handle,
      toolCount: Number(category.toolCount || 0),
      tool_count: Number(category.toolCount || 0),
    })),
    tools: tools.map((tool: any) => {
      const { toolCategories } = tool
      return {
        id: tool.id,
        handle: tool.handle,
        name: tool.name,
        description: tool.description,
        website: tool.website,
        websiteLogo: tool.websiteLogo || null,
        website_logo: tool.websiteLogo || null,
        monthVisitedCount: Number(tool.monthVisitedCount || 0),
        month_visited_count: Number(tool.monthVisitedCount || 0),
        collectedCount: Number(tool.collectedCount || 0),
        collected_count: Number(tool.collectedCount || 0),
        isFree: Boolean(tool.isFree),
        is_free: Boolean(tool.isFree),
        is_ad: false,
        categories: toolCategories.map((item: any) => item.category),
      }
    }),
  }
})