import jwt from 'jsonwebtoken'

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  if (!path.startsWith('/api/admin')) {
    return
  }

  if (getMethod(event) === 'OPTIONS') {
    return
  }

  if (path.startsWith('/api/admin/auth/')) {
    return
  }

  const auth = getHeader(event, 'authorization') || ''
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    throw createError({ statusCode: 401, statusMessage: '未登录或缺少凭证' })
  }

  const config = useRuntimeConfig(event)
  const secret = config.jwtSecret || process.env.JWT_SECRET || 'dev-admin-jwt-secret-change-in-production'

  try {
    const payload = jwt.verify(match[1], secret)
    event.context.adminAuth = payload
  }
  catch {
    throw createError({ statusCode: 401, statusMessage: '登录已失效，请重新登录' })
  }
})
