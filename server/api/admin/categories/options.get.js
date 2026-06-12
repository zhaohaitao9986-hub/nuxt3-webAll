import prisma from '~/server/utils/prisma'
import { assertAnyAdmin } from '~/server/utils/requireAdminRole'

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)
  const query = getQuery(event)
  const level1Id = Number(query.level1Id) || null
  const rows = await prisma.categoryLevel2.findMany({
    where: {
      isActive: true,
      ...(level1Id ? { level1Id } : {}),
    },
    orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      handle: true,
      level1Id: true,
      level1: { select: { name: true } },
    },
  })

  const data = rows.map((r) => ({
    id: r.id,
    name: r.name,
    level1Id: r.level1Id,
    label: r.level1 ? `${r.level1.name} / ${r.name}` : r.name,
  }))

  return { data }
})
