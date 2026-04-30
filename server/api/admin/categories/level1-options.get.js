import prisma from '~/server/utils/prisma'
import { assertAnyAdmin } from '~/server/utils/requireAdminRole'

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)
  const rows = await prisma.categoryLevel1.findMany({
    where: { is_active: true },
    orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      handle: true,
    },
  })
  return { data: rows }
})
