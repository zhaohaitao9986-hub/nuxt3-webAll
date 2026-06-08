import prisma from '~/server/utils/prisma'
import { assertAnyAdmin } from '~/server/utils/requireAdminRole'

function serialize(row) {
  return {
    ...row,
    tool_count: row.toolCount,
    is_active: row.isActive,
    what_is_summary: row.whatIsSummary,
    who_is_use: row.whoIsUse,
    how_do_work: row.howDoWork,
  }
}

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
  const name = typeof query.name === 'string' ? query.name.trim() : ''
  const level1Raw = query.level1Id
  const level1Id =
    level1Raw !== undefined && level1Raw !== null && String(level1Raw) !== ''
      ? Number(level1Raw)
      : undefined
  const activeRaw = query.isActive
  const isActive =
    activeRaw === 'true' ? true : activeRaw === 'false' ? false : undefined

  const where = {}
  if (name) {
    where.name = { contains: name, mode: 'insensitive' }
  }
  if (level1Id !== undefined && !Number.isNaN(level1Id)) {
    where.level1Id = level1Id
  }
  if (isActive !== undefined) {
    where.isActive = isActive
  }

  const [total, rows] = await Promise.all([
    prisma.categoryLevel2.count({ where }),
    prisma.categoryLevel2.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      include: {
        level1: {
          select: { id: true, name: true, handle: true },
        },
      },
    }),
  ])

  return { data: rows.map(serialize), total, page, pageSize }
})
