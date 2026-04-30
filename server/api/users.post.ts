import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // 读取前端传过来的数据
  const body = await readBody(event)

  // 往数据库插入数据
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
    },
  })

  return user
})