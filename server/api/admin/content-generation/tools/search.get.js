import prisma from '~/server/utils/prisma'
import { assertAnyAdmin } from '~/server/utils/requireAdminRole'

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)
  const query = getQuery(event)
  const keyword = String(query.q || '').trim()
  const keywordId = /^\d+$/.test(keyword) ? Number(keyword) : null
  const categoryId = Number(query.categoryId) || null
  const ids = String(query.ids || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .map(Number)
    .filter(id => Number.isInteger(id) && id > 0)
    .slice(0, 30)
  const rows = await prisma.aiTool.findMany({
    where: {
      toolStatus: { in: ['ONLINE', 'ACTIVE'] },
      handle: { not: '' },
      name: { not: '' },
      ...(categoryId ? { toolCategories: { some: { categoryId } } } : {}),
      ...(ids.length
        ? { id: { in: ids } }
        : keyword
        ? {
            OR: [
              { name: { contains: keyword, mode: 'insensitive' } },
              { handle: { equals: keyword, mode: 'insensitive' } },
              ...(keywordId ? [{ id: keywordId }] : []),
            ],
          }
        : {}),
    },
    orderBy: [{ rank: 'asc' }, { monthVisitedCount: 'desc' }],
    take: 30,
    select: {
      id: true,
      name: true,
      handle: true,
      websiteLogo: true,
      toolCategories: {
        take: 5,
        select: { category: { select: { name: true } } },
      },
    },
  })

  return {
    data: rows.map(tool => ({
      id: tool.id,
      name: tool.name,
      handle: tool.handle,
      websiteLogo: tool.websiteLogo,
      categoryNames: tool.toolCategories.map(item => item.category.name),
    })),
  }
})
