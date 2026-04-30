import prisma from '~/server/utils/prisma'
import { assertAnyAdmin } from '~/server/utils/requireAdminRole'

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
  const kw = typeof query.keyword === 'string' ? query.keyword.trim() : ''
  const roleRaw = query.role
  const role =
    roleRaw === 'USER' || roleRaw === 'ADMIN' || roleRaw === 'SUPERADMIN'
      ? roleRaw
      : undefined

  const where = {}
  if (kw) {
    where.OR = [
      { email: { contains: kw, mode: 'insensitive' } },
      { name: { contains: kw, mode: 'insensitive' } },
    ]
  }
  if (role) {
    where.role = role
  }

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ])

  return { data: rows, total, page, pageSize }
})
