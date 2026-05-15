import prisma from '~/server/utils/prisma'
import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import {
  buildTrafficWhereSql,
  conversionPredicateSql,
  formatTrafficFilters,
  identitySql,
  trafficChannelSql,
  normalizeTrafficQuery,
} from '~/server/utils/adminTraffic'

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)

  const filters = normalizeTrafficQuery(getQuery(event))
  const whereSql = buildTrafficWhereSql(filters, 't')

  const [overviewRow] = await prisma.$queryRaw`
    WITH filtered AS (
      SELECT *
      FROM "traffic_logs" AS t
      WHERE ${whereSql}
    )
    SELECT
      COUNT(DISTINCT ${identitySql('f')})::int AS "uv",
      COUNT(*)::int AS "pv",
      CASE
        WHEN COUNT(DISTINCT ${identitySql('f')}) = 0 THEN 0::float
        ELSE ROUND((COUNT(*)::numeric / NULLIF(COUNT(DISTINCT ${identitySql('f')}), 0)), 2)::float
      END AS "pvPerUv",
      COALESCE(ROUND(AVG(COALESCE(f."page_stay", 0))::numeric, 2), 0)::float AS "avgPageStay",
      COUNT(*) FILTER (WHERE ${conversionPredicateSql('f')})::int AS "conversions",
      CASE
        WHEN COUNT(DISTINCT ${identitySql('f')}) = 0 THEN 0::float
        ELSE ROUND((COUNT(*) FILTER (WHERE ${conversionPredicateSql('f')})::numeric * 100 / NULLIF(COUNT(DISTINCT ${identitySql('f')}), 0)), 2)::float
      END AS "conversionRate"
    FROM filtered AS f
  `

  const [realtimeRow] = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT ${identitySql('t')})::int AS "activeVisitors"
    FROM "traffic_logs" AS t
    WHERE t."createdAt" >= NOW() - INTERVAL '5 minutes'
  `

  const channels = await prisma.$queryRaw`
    SELECT DISTINCT ${trafficChannelSql('t')} AS "value"
    FROM "traffic_logs" AS t
    ORDER BY ${trafficChannelSql('t')} ASC
  `

  return {
    filters: formatTrafficFilters(filters),
    overview: overviewRow || {
      uv: 0,
      pv: 0,
      pvPerUv: 0,
      avgPageStay: 0,
      conversions: 0,
      conversionRate: 0,
    },
    realtime: {
      activeVisitors: realtimeRow?.activeVisitors || 0,
    },
    channelOptions: (channels || []).map((row) => row.value).filter(Boolean),
  }
})