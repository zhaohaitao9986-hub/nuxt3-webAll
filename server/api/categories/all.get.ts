import prisma from '~/server/utils/prisma'

const CACHE_KEY = 'categories-hub'
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export default defineEventHandler(async () => {
  const storage = useStorage('cache')

  // Try cache first
  const cached = await storage.getItem<{
    expiresAt: number
    payload: unknown
  }>(CACHE_KEY)

  const now = Date.now()
  if (cached && cached.expiresAt > now && cached.payload) {
    return cached.payload
  }

  // Query all level1 categories with nested level2 and tool counts
  const level1Categories = await prisma.categoryLevel1.findMany({
    where: {
      is_active: true,
    },
    orderBy: {
      sort: 'desc',
    },
    include: {
      level2Categories: {
        where: {
          is_active: true,
        },
        orderBy: {
          sort: 'desc',
        },
        include: {
          _count: {
            select: {
              toolCategories: true,
            },
          },
        },
      },
    },
  })

  const response = level1Categories.map((parent) => ({
    id: parent.id,
    name: parent.name,
    handle: parent.handle,
    priority: parent.sort,
    children: parent.level2Categories.map((child) => ({
      id: child.id,
      name: child.name,
      handle: child.handle,
      priority: child.sort,
      toolCount: child._count?.toolCategories ?? 0,
    })),
  }))

  // Save to cache
  await storage.setItem(CACHE_KEY, {
    expiresAt: now + CACHE_TTL_MS,
    payload: response,
  })

  return response
})

