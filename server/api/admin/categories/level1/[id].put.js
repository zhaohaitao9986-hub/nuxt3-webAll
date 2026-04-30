import prisma from '~/server/utils/prisma'
import { assertAnyAdmin } from '~/server/utils/requireAdminRole'

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }

  const existing = await prisma.categoryLevel1.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: '请求体无效' })
  }

  const updateData = {}

  if ('name' in body) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw createError({ statusCode: 400, statusMessage: '名称不能为空' })
    }
    updateData.name = body.name.trim()
  }
  if ('handle' in body) {
    if (typeof body.handle !== 'string' || !body.handle.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'handle 不能为空' })
    }
    updateData.handle = body.handle.trim()
  }
  if ('sort' in body) {
    const s = Number(body.sort)
    updateData.sort = Number.isNaN(s) ? 0 : s
  }
  if ('is_active' in body) {
    updateData.is_active = Boolean(body.is_active)
  }

  if (Object.keys(updateData).length === 0) {
    throw createError({ statusCode: 400, statusMessage: '没有可更新字段' })
  }

  try {
    return await prisma.categoryLevel1.update({
      where: { id },
      data: updateData,
    })
  }
  catch (e) {
    if (e?.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'handle 已存在' })
    }
    throw e
  }
})
