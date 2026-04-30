import prisma from '~/server/utils/prisma'
import { assertAnyAdmin } from '~/server/utils/requireAdminRole'

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
}

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)
  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: '请求体无效' })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  let handle = typeof body.handle === 'string' ? body.handle.trim() : ''

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '名称必填' })
  }
  if (!handle) {
    handle = slugify(name)
  }
  if (!handle) {
    throw createError({ statusCode: 400, statusMessage: 'handle 无效' })
  }

  const sort = Number(body.sort)
  const data = {
    name,
    handle,
    sort: Number.isNaN(sort) ? 0 : sort,
    is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
  }

  try {
    return await prisma.categoryLevel1.create({ data })
  }
  catch (e) {
    if (e?.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'handle 已存在' })
    }
    throw e
  }
})
