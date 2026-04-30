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
  const level1Id = Number(body.level1Id)

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '名称必填' })
  }
  if (Number.isNaN(level1Id)) {
    throw createError({ statusCode: 400, statusMessage: '请选择一级分类' })
  }

  if (!handle) {
    handle = slugify(name)
  }
  if (!handle) {
    throw createError({ statusCode: 400, statusMessage: 'handle 无效' })
  }

  const l1 = await prisma.categoryLevel1.findUnique({ where: { id: level1Id } })
  if (!l1) {
    throw createError({ statusCode: 400, statusMessage: '一级分类不存在' })
  }

  const sort = Number(body.sort)
  const data = {
    name,
    handle,
    level1Id,
    sort: Number.isNaN(sort) ? 0 : sort,
    is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
  }

  try {
    const row = await prisma.categoryLevel2.create({
      data,
      include: {
        level1: {
          select: { id: true, name: true, handle: true },
        },
      },
    })
    return row
  }
  catch (e) {
    if (e?.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'handle 已存在' })
    }
    throw e
  }
})
