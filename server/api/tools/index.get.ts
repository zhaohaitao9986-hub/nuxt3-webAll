import  prisma  from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  const tools = await prisma.aiTool.findMany()

  return tools
})