import prisma from '~/server/utils/prisma'
import { assertAnyAdmin } from '~/server/utils/requireAdminRole'

const TOOL_STATUS_TO_LEGACY = {
  ACTIVE: 1,
  DRAFT: 0,
  OFFLINE: -1,
  ARCHIVED: -1,
}

function normalizeToolStatus(value) {
  if (value === undefined || value === null || String(value) === '') {
    return undefined
  }
  const raw = String(value).trim().toUpperCase()
  if (raw === '1' || raw === 'ACTIVE') return 'ACTIVE'
  if (raw === '0' || raw === 'DRAFT') return 'DRAFT'
  if (raw === '-1' || raw === 'ARCHIVED') return 'ARCHIVED'
  if (raw === 'OFFLINE') return 'OFFLINE'
  return undefined
}

function arrayToKeywordString(value) {
  return Array.isArray(value) ? value.join(', ') : (value || '')
}

function serializeToolRow(row) {
  const { monthVisitedCount, ...rest } = row
  return {
    ...rest,
    collected_count: row.collectedCount,
    month_visited_count: String(monthVisitedCount ?? 0),
    what_is_summary: row.whatIsSummary,
    is_ad: row.isAd,
    website_name: row.websiteName,
    is_free: row.isFree,
    website_logo: row.websiteLogo,
    tool_info_review:
      row.toolInfoReview != null && typeof row.toolInfoReview === 'object' && 'toString' in row.toolInfoReview
        ? row.toolInfoReview.toString()
        : row.toolInfoReview,
    add_time: row.addTime,
    website_type: row.websiteType || [],
    social_email: row.socialEmail || [],
    for_jobs: row.forJobs || [],
    use_cases: row.useCases || [],
    company_info: row.companyInfo,
    recommend_learn: row.recommendLearn || [],
    status: TOOL_STATUS_TO_LEGACY[row.toolStatus] ?? 0,
    sort_weight: row.rank ?? 0,
    seo_title: row.seoMetaTitle,
    seo_keywords: arrayToKeywordString(row.seoMetaKeywords),
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
  const name = typeof query.name === 'string' ? query.name.trim() : ''
  const categoryIdRaw = query.categoryId
  const toolStatus = normalizeToolStatus(query.status ?? query.toolStatus)

  const categoryId =
    categoryIdRaw !== undefined && categoryIdRaw !== null && String(categoryIdRaw) !== ''
      ? Number(categoryIdRaw)
      : undefined
  const where = {}

  if (name) {
    where.name = { contains: name, mode: 'insensitive' }
  }
  if (categoryId !== undefined && !Number.isNaN(categoryId)) {
    where.toolCategories = { some: { categoryId } }
  }
  if (toolStatus) {
    where.toolStatus = toolStatus
  }

  const [total, rows] = await Promise.all([
    prisma.aiTool.count({ where }),
    prisma.aiTool.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { updatedAt: 'desc' },
      include: {
        toolCategories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                handle: true,
                level1: {
                  select: { id: true, name: true, handle: true },
                },
              },
            },
          },
        },
      },
    }),
  ])

  const data = rows.map((row) => serializeToolRow(row))

  return { data, total, page, pageSize }
})
