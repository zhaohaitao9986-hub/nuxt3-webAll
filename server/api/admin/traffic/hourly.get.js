import prisma from '~/server/utils/prisma'
import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import {
  buildTrafficWhereSql,
  conversionPredicateSql,
  formatTrafficFilters,
  identitySql,
  localDateSql,
  localTimestampSql,
  normalizeTrafficQuery,
} from '~/server/utils/adminTraffic'

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)

  const filters = normalizeTrafficQuery(getQuery(event))
  const whereSql = buildTrafficWhereSql(filters, 't')

  const rows = await prisma.$queryRaw`
    WITH buckets AS (
      SELECT generate_series(
        date_trunc('hour', ${localDateSql(filters.startAt)}),
        date_trunc('hour', ${localDateSql(filters.endAt)} - INTERVAL '1 hour'),
        INTERVAL '1 hour'
      ) AS "bucket"
    ),
    filtered AS (
      SELECT *
      FROM "traffic_logs" AS t
      WHERE ${whereSql}
    ),
    aggregated AS (
      SELECT
        date_trunc('hour', ${localTimestampSql('f')}) AS "bucket",
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
      GROUP BY date_trunc('hour', f."createdAt")
    )
    SELECT
      to_char(b."bucket", 'YYYY-MM-DD HH24:00') AS "hourLabel",
      COALESCE(a."uv", 0)::int AS "uv",
      COALESCE(a."pv", 0)::int AS "pv",
      COALESCE(a."pvPerUv", 0)::float AS "pvPerUv",
      COALESCE(a."avgPageStay", 0)::float AS "avgPageStay",
      COALESCE(a."conversions", 0)::int AS "conversions",
      COALESCE(a."conversionRate", 0)::float AS "conversionRate"
    FROM buckets AS b
    LEFT JOIN aggregated AS a ON a."bucket" = b."bucket"
    ORDER BY b."bucket" ASC
  `

  return {
    filters: formatTrafficFilters(filters),
    data: rows,
  }
})