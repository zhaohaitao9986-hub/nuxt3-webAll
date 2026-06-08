import prisma from '~/server/utils/prisma'
import { assertAnyAdmin } from '~/server/utils/requireAdminRole'

function serializeTool(row) {
  const { toolCategories, monthVisitedCount, ...rest } = row
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
    status: row.toolStatus === 'ACTIVE' ? 1 : row.toolStatus === 'DRAFT' ? 0 : -1,
    sort_weight: row.rank ?? 0,
    seo_title: row.seoMetaTitle,
    seo_keywords: Array.isArray(row.seoMetaKeywords) ? row.seoMetaKeywords.join(', ') : '',
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    categoryIds: toolCategories.map((tc) => tc.categoryId),
  }
}

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }

  const row = await prisma.aiTool.findUnique({
    where: { id },
    include: {
      toolCategories: {
        select: { categoryId: true },
      },
    },
  })

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  return serializeTool(row)
})
