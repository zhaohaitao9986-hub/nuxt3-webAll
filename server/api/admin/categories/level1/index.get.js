import prisma from '~/server/utils/prisma'
import { assertAnyAdmin } from '~/server/utils/requireAdminRole'

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
  const name = typeof query.name === 'string' ? query.name.trim() : ''
  const activeRaw = query.isActive
  const isActive =
    activeRaw === 'true' ? true : activeRaw === 'false' ? false : undefined

  const where = {}
  if (name) {
    where.name = { contains: name, mode: 'insensitive' }
  }
  if (isActive !== undefined) {
    where.is_active = isActive
  }

  const [total, rows] = await Promise.all([
    prisma.categoryLevel1.count({ where }),
    prisma.categoryLevel1.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    }),
  ])

  return { data: rows, total, page, pageSize }
})
