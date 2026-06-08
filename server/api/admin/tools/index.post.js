import prisma from '~/server/utils/prisma'
import { assertAnyAdmin } from '~/server/utils/requireAdminRole'

function parseOptionalInt(v) {
  if (v === undefined || v === null || v === '') {
    return undefined
  }
  const n = Number(v)
  return Number.isNaN(n) ? undefined : n
}

function normalizeCategoryIds(body) {
  if (Array.isArray(body.categoryIds)) {
    return body.categoryIds
      .map((id) => Number(id))
      .filter((id) => !Number.isNaN(id))
  }
  const single = parseOptionalInt(body.categoryId)
  return single !== undefined ? [single] : []
}

function normalizeToolStatus(value) {
  if (value === undefined || value === null || String(value) === '') {
    return 'ACTIVE'
  }
  const raw = String(value).trim().toUpperCase()
  if (raw === '1' || raw === 'ACTIVE') return 'ACTIVE'
  if (raw === '0' || raw === 'DRAFT') return 'DRAFT'
  if (raw === '-1' || raw === 'ARCHIVED') return 'ARCHIVED'
  if (raw === 'OFFLINE') return 'OFFLINE'
  return 'ACTIVE'
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
  return []
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
    tool_info_review: row.toolInfoReview != null ? row.toolInfoReview.toString() : null,
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
  }
}

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)
  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid body' })
  }

  const b = body
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  let handle = typeof b.handle === 'string' ? b.handle.trim() : ''
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }
  if (!handle) {
    handle = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
  }
  if (!handle) {
    throw createError({ statusCode: 400, statusMessage: 'handle is required' })
  }

  const categoryIds = normalizeCategoryIds(b)

  const data = {
    name,
    handle,
    website: typeof b.website === 'string' ? b.website : null,
    description: typeof b.description === 'string' ? b.description : null,
    image:
      typeof b.image === 'string'
        ? b.image
        : typeof b.website_logo === 'string'
          ? b.website_logo
          : null,
    websiteLogo: typeof b.website_logo === 'string' ? b.website_logo : null,
    websiteName: typeof b.website_name === 'string' ? b.website_name : null,
    whatIsSummary: typeof b.what_is_summary === 'string' ? b.what_is_summary : null,
    toolStatus: normalizeToolStatus(b.toolStatus ?? b.status),
    isFree: Boolean(b.isFree ?? b.is_free),
    isAd: Boolean(b.isAd ?? b.is_ad),
    seoMetaTitle: typeof (b.seoMetaTitle ?? b.seo_title) === 'string' ? (b.seoMetaTitle ?? b.seo_title) : null,
    seoMetaDescription: typeof (b.seoMetaDescription ?? b.seo_meta_description) === 'string' ? (b.seoMetaDescription ?? b.seo_meta_description) : null,
    seoMetaKeywords: normalizeStringArray(b.seoMetaKeywords ?? b.seo_keywords),
    pros: Array.isArray(b.pros) ? b.pros : [],
    cons: Array.isArray(b.cons) ? b.cons : [],
    pricing: Array.isArray(b.pricing) ? b.pricing : [],
    faq: b.faq ?? null,
    companyInfo: typeof b.company_info === 'string' ? b.company_info : null,
    addTime: typeof b.add_time === 'string' ? b.add_time : null,
    rank: parseOptionalInt(b.rank ?? b.sort_weight) ?? 0,
  }

  try {
    const tool = await prisma.$transaction(async (tx) => {
      const created = await tx.aiTool.create({ data })
      if (categoryIds.length) {
        await tx.aiToolCategory.createMany({
          data: categoryIds.map((categoryId) => ({
            aiToolId: created.id,
            categoryId,
          })),
          skipDuplicates: true,
        })
      }
      return tx.aiTool.findUnique({
        where: { id: created.id },
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
      })
    })

    if (!tool) {
      throw createError({ statusCode: 500, statusMessage: 'Create failed' })
    }

    return serializeToolRow(tool)
  }
  catch (e) {
    const err = e
    if (err && err.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'handle already exists' })
    }
    throw e
  }
})
