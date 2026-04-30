import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: '请求体无效' })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: '请输入邮箱和密码' })
  }

  const { jwtSecret: cfgSecret } = useRuntimeConfig()
  const secret = cfgSecret || process.env.JWT_SECRET || 'dev-admin-jwt-secret-change-in-production'

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !user.isActive) {
    throw createError({ statusCode: 401, statusMessage: '账号或密码错误' })
  }

  if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
    throw createError({ statusCode: 403, statusMessage: '无后台访问权限' })
  }

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) {
    throw createError({ statusCode: 401, statusMessage: '账号或密码错误' })
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: '7d' },
  )

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    },
  }
})
