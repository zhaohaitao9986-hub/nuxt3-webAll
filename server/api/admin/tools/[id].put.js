import prisma from '~/server/utils/prisma'
import { assertAnyAdmin } from '~/server/utils/requireAdminRole'

function parseOptionalInt(v) {
  if (v === undefined || v === null || v === '') {
    return undefined
  }
  const n = Number(v)
  return Number.isNaN(n) ? undefined : n
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
  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }

  const existing = await prisma.aiTool.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid body' })
  }

  const b = body

  const updateData = {}

  const assignString = (inputKey, dataKey = inputKey, optional = true) => {
    if (!(inputKey in b)) {
      return
    }
    const v = b[inputKey]
    if (v === '' || v === null) {
      if (optional) {
        updateData[dataKey] = null
      }
      return
    }
    if (typeof v === 'string') {
      updateData[dataKey] = v
    }
  }

  if ('name' in b) {
    if (typeof b.name !== 'string' || !b.name.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'name cannot be empty' })
    }
    updateData.name = b.name.trim()
  }
  if ('handle' in b) {
    if (typeof b.handle !== 'string' || !b.handle.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'handle cannot be empty' })
    }
    updateData.handle = b.handle.trim()
  }

  assignString('website')
  assignString('description')
  assignString('image')
  assignString('website_logo', 'websiteLogo')
  assignString('website_name', 'websiteName')
  assignString('what_is_summary', 'whatIsSummary')
  assignString('seo_title', 'seoMetaTitle')
  assignString('seoMetaTitle')
  assignString('seo_meta_description', 'seoMetaDescription')
  assignString('seoMetaDescription')
  assignString('company_info', 'companyInfo')
  assignString('add_time', 'addTime')

  if ('status' in b || 'toolStatus' in b) {
    const s = normalizeToolStatus(b.toolStatus ?? b.status)
    if (!s) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
    }
    updateData.toolStatus = s
  }
  if ('is_free' in b || 'isFree' in b) {
    updateData.isFree = Boolean(b.isFree ?? b.is_free)
  }
  if ('is_ad' in b || 'isAd' in b) {
    updateData.isAd = Boolean(b.isAd ?? b.is_ad)
  }
  if ('sort_weight' in b || 'rank' in b) {
    const w = parseOptionalInt(b.rank ?? b.sort_weight)
    if (w !== undefined) {
      updateData.rank = w
    }
  }
  if ('seo_keywords' in b || 'seoMetaKeywords' in b) {
    updateData.seoMetaKeywords = normalizeStringArray(b.seoMetaKeywords ?? b.seo_keywords)
  }
  if ('pros' in b && Array.isArray(b.pros)) {
    updateData.pros = b.pros
  }
  if ('cons' in b && Array.isArray(b.cons)) {
    updateData.cons = b.cons
  }
  if ('pricing' in b && Array.isArray(b.pricing)) {
    updateData.pricing = b.pricing
  }
  if ('faq' in b) {
    updateData.faq = b.faq
  }

  const categoryIds = Array.isArray(b.categoryIds)
    ? b.categoryIds.map((x) => Number(x)).filter((x) => !Number.isNaN(x))
    : null

  if (Object.keys(updateData).length === 0 && categoryIds === null) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  try {
    const tool = await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length) {
        await tx.aiTool.update({
          where: { id },
          data: updateData,
        })
      }
      if (categoryIds !== null) {
        await tx.aiToolCategory.deleteMany({ where: { aiToolId: id } })
        if (categoryIds.length) {
          await tx.aiToolCategory.createMany({
            data: categoryIds.map((categoryId) => ({ aiToolId: id, categoryId })),
            skipDuplicates: true,
          })
        }
      }
      return tx.aiTool.findUnique({
        where: { id },
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
      throw createError({ statusCode: 404, statusMessage: 'Not found' })
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
