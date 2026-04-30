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
                is_active: true,
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
          ? [{ created_at: 'desc' }]
          : [{ month_visited_count: 'desc' }, { created_at: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        handle: true,
        name: true,
        description: true,
        website: true,
        website_logo: true,
        month_visited_count: true,
        collected_count: true,
        is_free: true,
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
    }),
    prisma.categoryLevel2.findMany({
      where: { is_active: true },
      orderBy: [{ sort: 'asc' }, { tool_count: 'desc' }],
      take: 12,
      select: {
        name: true,
        handle: true,
        tool_count: true,
      },
    }),
  ])

  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    categories,
    tools: tools.map((tool) => {
      const { toolCategories, ...rest } = tool
      return {
        ...rest,
        month_visited_count: Number(tool.month_visited_count || 0),
        categories: toolCategories.map((item) => item.category),
      }
    }),
  }
})