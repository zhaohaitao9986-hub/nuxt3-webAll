import prisma from '~/server/utils/prisma'
import { assertAnyAdmin } from '~/server/utils/requireAdminRole'

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)
  const rows = await prisma.categoryLevel2.findMany({
    where: { isActive: true },
    orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      handle: true,
      level1: { select: { name: true } },
    },
  })

  const data = rows.map((r) => ({
    id: r.id,
    name: r.name,
    label: r.level1 ? `${r.level1.name} / ${r.name}` : r.name,
  }))

  return { data }
})
