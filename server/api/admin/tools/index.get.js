import prisma from '~/server/utils/prisma'

function serializeToolRow(row) {
  const { month_visited_count: mvc, tool_info_review: tir, ...rest } = row
  return {
    ...rest,
    month_visited_count: String(mvc),
    tool_info_review:
      tir != null && typeof tir === 'object' && 'toString' in tir
        ? tir.toString()
        : tir,
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
  const name = typeof query.name === 'string' ? query.name.trim() : ''
  const categoryIdRaw = query.categoryId
  const statusRaw = query.status

  const categoryId =
    categoryIdRaw !== undefined && categoryIdRaw !== null && String(categoryIdRaw) !== ''
      ? Number(categoryIdRaw)
      : undefined
  const status =
    statusRaw !== undefined && statusRaw !== null && String(statusRaw) !== ''
      ? Number(statusRaw)
      : undefined

  const where = {}

  if (name) {
    where.name = { contains: name, mode: 'insensitive' }
  }
  if (categoryId !== undefined && !Number.isNaN(categoryId)) {
    where.toolCategories = { some: { categoryId } }
  }
  if (status !== undefined && !Number.isNaN(status)) {
    where.status = status
  }

  const [total, rows] = await Promise.all([
    prisma.aiTool.count({ where }),
    prisma.aiTool.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { updated_at: 'desc' },
      include: {
        toolCategories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                handle: true,
                level1: {
                  select: { id: true, name: true, handle: true },
                },
              },
            },
          },
        },
      },
    }),
  ])

  const data = rows.map((row) => serializeToolRow(row))

  return { data, total, page, pageSize }
})
