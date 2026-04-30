import prisma from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  const rows = await prisma.categoryLevel2.findMany({
    where: { is_active: true },
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
