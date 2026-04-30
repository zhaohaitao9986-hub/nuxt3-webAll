import prisma from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  // 查询所有用户
  return await prisma.user.findMany()
})