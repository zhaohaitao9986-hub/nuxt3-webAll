import bcrypt from 'bcryptjs'
import prisma from '~/server/utils/prisma'
import { assertSuperAdmin } from '~/server/utils/requireAdminRole'

export default defineEventHandler(async (event) => {
  assertSuperAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: '请求体无效' })
  }

  const updateData = {}

  if ('name' in body) {
    const n = body.name
    updateData.name = n === null || n === '' ? null : String(n).trim() || null
  }

  if ('role' in body) {
    const r = body.role
    if (r !== 'USER' && r !== 'ADMIN' && r !== 'SUPERADMIN') {
      throw createError({ statusCode: 400, statusMessage: 'role 无效' })
    }
    if (existing.role === 'SUPERADMIN' && r !== 'SUPERADMIN') {
      const cnt = await prisma.user.count({ where: { role: 'SUPERADMIN' } })
      if (cnt <= 1) {
        throw createError({ statusCode: 400, statusMessage: '不能降级或删除唯一的超级管理员' })
      }
    }
    updateData.role = r
  }

  if ('isActive' in body) {
    const nextActive = Boolean(body.isActive)
    if (existing.role === 'SUPERADMIN' && !nextActive) {
      const cnt = await prisma.user.count({
        where: { role: 'SUPERADMIN', isActive: true },
      })
      if (cnt <= 1 && existing.isActive) {
        throw createError({ statusCode: 400, statusMessage: '不能禁用唯一的有效超级管理员' })
      }
    }
    updateData.isActive = nextActive
  }

  if ('password' in body && body.password != null && String(body.password).length > 0) {
    const plain = String(body.password)
    if (plain.length < 6) {
      throw createError({ statusCode: 400, statusMessage: '密码至少 6 位' })
    }
    updateData.password = await bcrypt.hash(plain, 10)
  }

  if (Object.keys(updateData).length === 0) {
    throw createError({ statusCode: 400, statusMessage: '没有可更新字段' })
  }

  const row = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return row
})
