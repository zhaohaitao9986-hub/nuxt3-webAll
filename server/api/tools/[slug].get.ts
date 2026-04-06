import prisma  from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const { slug } = event.context.params || {}

  const tool = await prisma.aiTool.findUnique({
    where: {
      slug: slug
    }
  })

  if (!tool) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Tool not found'
    })
  }

  return tool
})