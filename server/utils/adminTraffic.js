import { Prisma } from '@prisma/client'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const DEFAULT_RANGE = 'today'
const ADMIN_TIMEZONE = 'Asia/Shanghai'

function toDate(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function resolveRange(range) {
  const now = new Date()
  const todayStart = startOfDay(now)

  switch (range) {
    case 'yesterday':
      return {
        startAt: addDays(todayStart, -1),
        endAt: todayStart,
      }
    case '7d':
      return {
        startAt: addDays(todayStart, -6),
        endAt: addDays(todayStart, 1),
      }
    case '30d':
      return {
        startAt: addDays(todayStart, -29),
        endAt: addDays(todayStart, 1),
      }
    case 'today':
    default:
      return {
        startAt: todayStart,
        endAt: addDays(todayStart, 1),
      }
  }
}

export function normalizeTrafficQuery(query) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.pageSize) || DEFAULT_PAGE_SIZE))
  const range = typeof query.range === 'string' && query.range ? query.range : DEFAULT_RANGE
  const channel = typeof query.channel === 'string' ? query.channel.trim() : ''
  const device = typeof query.device === 'string' ? query.device.trim().toLowerCase() : ''
  const start = toDate(typeof query.start === 'string' ? query.start : '')
  const end = toDate(typeof query.end === 'string' ? query.end : '')

  const resolved = start && end && start < end
    ? { startAt: start, endAt: end }
    : resolveRange(range)

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    range,
    channel,
    device: ['mobile', 'tablet', 'desktop'].includes(device) ? device : '',
    startAt: resolved.startAt,
    endAt: resolved.endAt,
  }
}

export function identitySql(alias) {
  return Prisma.raw(`COALESCE(NULLIF("${alias}"."uid", ''), NULLIF("${alias}"."ip", ''), NULLIF("${alias}"."sid", ''))`)
}

export function conversionPredicateSql(alias) {
  return Prisma.raw(`LOWER(COALESCE("${alias}"."type", '')) ~ '(conversion|convert|lead|submit|download|outbound|clickout|click_out|signup|purchase)'`)
}

function normalizedRefHostExpr(alias) {
  return `LOWER(REGEXP_REPLACE(COALESCE("${alias}"."ref", ''), '^https?://([^/]+).*$','\\1'))`
}

function urlExpr(alias) {
  return `LOWER(COALESCE("${alias}"."url", ''))`
}

function utmSourceExpr(alias) {
  return `LOWER(BTRIM(COALESCE("${alias}"."utm_source", '')))`
}

export function trafficChannelSql(alias = 't') {
  const refHost = normalizedRefHostExpr(alias)
  const url = urlExpr(alias)
  const utmSource = utmSourceExpr(alias)

  return Prisma.raw(`
    CASE
      WHEN ${utmSource} <> '' THEN ${utmSource}
      WHEN ${url} ~ '(^|[?&])utm_source=google([&#]|$)' OR ${url} ~ '(^|[?&])gclid=' OR ${refHost} LIKE '%google.%' THEN 'google'
      WHEN ${url} ~ '(^|[?&])utm_source=bing([&#]|$)' OR ${url} ~ '(^|[?&])msclkid=' OR ${refHost} LIKE '%bing.%' THEN 'bing'
      WHEN ${url} ~ '(^|[?&])utm_source=baidu([&#]|$)' OR ${refHost} LIKE '%baidu.%' THEN 'baidu'
      WHEN ${url} ~ '(^|[?&])utm_source=yahoo([&#]|$)' OR ${refHost} LIKE '%yahoo.%' THEN 'yahoo'
      WHEN ${url} ~ '(^|[?&])utm_source=duckduckgo([&#]|$)' OR ${refHost} LIKE '%duckduckgo.%' THEN 'duckduckgo'
      WHEN ${url} ~ '(^|[?&])utm_source=yandex([&#]|$)' OR ${refHost} LIKE '%yandex.%' THEN 'yandex'
      WHEN ${url} ~ '(^|[?&])utm_source=facebook([&#]|$)' OR ${refHost} LIKE '%facebook.%' THEN 'facebook'
      WHEN ${url} ~ '(^|[?&])utm_source=instagram([&#]|$)' OR ${refHost} LIKE '%instagram.%' THEN 'instagram'
      WHEN ${url} ~ '(^|[?&])utm_source=twitter([&#]|$)' OR ${url} ~ '(^|[?&])utm_source=x([&#]|$)' OR ${refHost} LIKE '%t.co%' OR ${refHost} LIKE '%twitter.%' OR ${refHost} LIKE '%x.com%' THEN 'x'
      WHEN ${url} ~ '(^|[?&])utm_source=linkedin([&#]|$)' OR ${refHost} LIKE '%linkedin.%' THEN 'linkedin'
      WHEN ${url} ~ '(^|[?&])utm_source=reddit([&#]|$)' OR ${refHost} LIKE '%reddit.%' THEN 'reddit'
      WHEN ${url} ~ '(^|[?&])utm_source=direct([&#]|$)' THEN 'direct'
      WHEN ${refHost} = '' THEN 'direct'
      ELSE ${refHost}
    END
  `)
}

export function localTimestampSql(alias, column = 'createdAt') {
  return Prisma.raw(`timezone('${ADMIN_TIMEZONE}', "${alias}"."${column}")`)
}

export function localDateSql(dateValue) {
  return Prisma.sql`timezone(${ADMIN_TIMEZONE}, ${dateValue}::timestamptz)`
}

function devicePredicateSql(alias, device) {
  const uaExpr = `LOWER(COALESCE("${alias}"."userAgent", "${alias}"."ua", ''))`

  if (device === 'mobile') {
    return Prisma.raw(`(${uaExpr} LIKE '%mobile%' AND ${uaExpr} NOT LIKE '%ipad%' AND ${uaExpr} NOT LIKE '%tablet%')`)
  }
  if (device === 'tablet') {
    return Prisma.raw(`(${uaExpr} LIKE '%ipad%' OR ${uaExpr} LIKE '%tablet%')`)
  }
  if (device === 'desktop') {
    return Prisma.raw(`(${uaExpr} NOT LIKE '%mobile%' AND ${uaExpr} NOT LIKE '%ipad%' AND ${uaExpr} NOT LIKE '%tablet%')`)
  }
  return null
}

export function buildTrafficWhereSql(filters, alias = 't') {
  const clauses = [
    Prisma.sql`${Prisma.raw(`"${alias}"."createdAt"`)} >= ${filters.startAt}`,
    Prisma.sql`${Prisma.raw(`"${alias}"."createdAt"`)} < ${filters.endAt}`,
  ]

  if (filters.channel) {
    clauses.push(Prisma.sql`${trafficChannelSql(alias)} = ${filters.channel.toLowerCase()}`)
  }

  const deviceClause = devicePredicateSql(alias, filters.device)
  if (deviceClause) {
    clauses.push(Prisma.sql`${deviceClause}`)
  }

  let whereSql = Prisma.sql`TRUE`
  for (const clause of clauses) {
    whereSql = Prisma.sql`${whereSql} AND ${clause}`
  }
  return whereSql
}

export function formatTrafficFilters(filters) {
  return {
    range: filters.range,
    channel: filters.channel,
    device: filters.device,
    timezone: ADMIN_TIMEZONE,
    startAt: filters.startAt,
    endAt: filters.endAt,
    page: filters.page,
    pageSize: filters.pageSize,
  }
}