import prisma from '~/server/utils/prisma'
import { assertSuperAdmin } from '~/server/utils/requireAdminRole'

export default defineEventHandler(async (event) => {
  assertSuperAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }

  try {
    await prisma.categoryLevel1.delete({ where: { id } })
  }
  catch (e) {
    if (e?.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: 'Not found' })
    }
    throw e
  }

  return { ok: true }
})
