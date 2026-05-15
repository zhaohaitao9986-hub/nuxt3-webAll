import prisma from '~/server/utils/prisma'
import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import {
  buildTrafficWhereSql,
  conversionPredicateSql,
  formatTrafficFilters,
  identitySql,
  normalizeTrafficQuery,
} from '~/server/utils/adminTraffic'

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)

  const filters = normalizeTrafficQuery(getQuery(event))
  const whereSql = buildTrafficWhereSql(filters, 't')

  const rows = await prisma.$queryRaw`
    WITH filtered AS (
      SELECT
        t.*,
        regexp_replace(t."url", '^https?://[^/]+', '') AS "path",
        CASE
          WHEN regexp_replace(t."url", '^https?://[^/]+', '') LIKE '/app/%'
            THEN split_part(regexp_replace(t."url", '^https?://[^/]+', ''), '/', 3)
          ELSE NULL
        END AS "tool_handle"
      FROM "traffic_logs" AS t
      WHERE ${whereSql}
    ),
    aggregated AS (
      SELECT
        f."url" AS "url",
        MAX(f."path") AS "path",
        MAX(f."tool_handle") AS "toolHandle",
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
      GROUP BY f."url"
    ),
    counted AS (
      SELECT COUNT(*)::int AS "total"
      FROM aggregated
    )
    SELECT
      a."url",
      COALESCE(
        tool."name",
        CASE
          WHEN a."path" = '/' THEN '首页'
          WHEN a."path" LIKE '/search%' THEN '搜索页'
          ELSE NULL
        END
      ) AS "name",
      a."uv",
      a."pv",
      a."pvPerUv",
      a."avgPageStay",
      a."conversions",
      a."conversionRate",
      counted."total"
    FROM aggregated AS a
    CROSS JOIN counted
    LEFT JOIN "ai_tools" AS tool ON tool."handle" = a."toolHandle"
    ORDER BY a."pv" DESC, a."uv" DESC, a."url" ASC
    LIMIT ${filters.pageSize}
    OFFSET ${filters.offset}
  `

  return {
    filters: formatTrafficFilters(filters),
    data: rows.map((row) => ({
      url: row.url,
      name: row.name,
      uv: row.uv,
      pv: row.pv,
      pvPerUv: row.pvPerUv,
      avgPageStay: row.avgPageStay,
      conversions: row.conversions,
      conversionRate: row.conversionRate,
    })),
    total: rows[0]?.total || 0,
    page: filters.page,
    pageSize: filters.pageSize,
  }
})