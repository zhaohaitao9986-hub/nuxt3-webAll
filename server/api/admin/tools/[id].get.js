import prisma from '~/server/utils/prisma'

function serializeTool(row) {
  const { month_visited_count: mvc, tool_info_review: tir, toolCategories, ...rest } = row
  return {
    ...rest,
    month_visited_count: String(mvc),
    tool_info_review:
      tir != null && typeof tir === 'object' && 'toString' in tir
        ? tir.toString()
        : tir,
    categoryIds: toolCategories.map((tc) => tc.categoryId),
  }
}

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }

  const row = await prisma.aiTool.findUnique({
    where: { id },
    include: {
      toolCategories: {
        select: { categoryId: true },
      },
    },
  })

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  return serializeTool(row)
})
