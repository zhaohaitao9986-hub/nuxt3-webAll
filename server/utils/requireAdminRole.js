/**
 * JWT 中间件校验通过后，event.context.adminAuth 由 server/middleware/admin-api-auth 写入。
 * @param {import('h3').H3Event} event
 * @param {string[]} allowed Prisma Role：ADMIN | SUPERADMIN
 */
export function assertAdminRoles(event, allowed) {
  const auth = event.context.adminAuth
  if (!auth || !auth.role) {
    throw createError({ statusCode: 401, statusMessage: '未登录' })
  }
  if (!allowed.includes(auth.role)) {
    throw createError({ statusCode: 403, statusMessage: '权限不足' })
  }
  return auth
}

/** 普通管理员与超级管理员均可 */
export function assertAnyAdmin(event) {
  return assertAdminRoles(event, ['ADMIN', 'SUPERADMIN'])
}

/** 仅超级管理员 */
export function assertSuperAdmin(event) {
  return assertAdminRoles(event, ['SUPERADMIN'])
}
