import prisma from '~/server/utils/prisma'
import { assertAnyAdmin } from '~/server/utils/requireAdminRole'

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)

  const [
    toolCount,
    userCount,
    adminCount,
    categoryLevel1Count,
    categoryLevel2Count,
    publishedToolCount,
  ] = await Promise.all([
    prisma.aiTool.count(),
    prisma.user.count(),
    prisma.user.count({
      where: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
    }),
    prisma.categoryLevel1.count(),
    prisma.categoryLevel2.count(),
    prisma.aiTool.count({ where: { status: 1 } }),
  ])

  return {
    toolCount,
    publishedToolCount,
    userCount,
    adminCount,
    categoryLevel1Count,
    categoryLevel2Count,
  }
})
