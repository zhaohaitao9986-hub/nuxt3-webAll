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
    website_logo: typeof b.website_logo === 'string' ? b.website_logo : null,
    website_name: typeof b.website_name === 'string' ? b.website_name : null,
    what_is_summary: typeof b.what_is_summary === 'string' ? b.what_is_summary : null,
    status: parseOptionalInt(b.status) ?? 1,
    is_free: Boolean(b.is_free),
    is_ad: Boolean(b.is_ad),
    seo_title: typeof b.seo_title === 'string' ? b.seo_title : null,
    seo_keywords: typeof b.seo_keywords === 'string' ? b.seo_keywords : null,
    pros: Array.isArray(b.pros) ? b.pros : [],
    cons: Array.isArray(b.cons) ? b.cons : [],
    pricing: Array.isArray(b.pricing) ? b.pricing : [],
    faq: b.faq ?? null,
    views: parseOptionalInt(b.views) ?? 0,
    sort_weight: parseOptionalInt(b.sort_weight) ?? 0,
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

    return {
      ...tool,
      month_visited_count: String(tool.month_visited_count),
      tool_info_review: tool.tool_info_review != null ? tool.tool_info_review.toString() : null,
    }
  }
  catch (e) {
    const err = e
    if (err && err.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'handle already exists' })
    }
    throw e
  }
})
