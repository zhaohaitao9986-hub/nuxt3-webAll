import prisma from '~/server/utils/prisma'

function parseOptionalInt(v) {
  if (v === undefined || v === null || v === '') {
    return undefined
  }
  const n = Number(v)
  return Number.isNaN(n) ? undefined : n
}

export default defineEventHandler(async (event) => {
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

  const assignString = (key, optional = true) => {
    if (!(key in b)) {
      return
    }
    const v = b[key]
    if (v === '' || v === null) {
      if (optional) {
        updateData[key] = null
      }
      return
    }
    if (typeof v === 'string') {
      updateData[key] = v
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
  assignString('website_logo')
  assignString('website_name')
  assignString('what_is_summary')
  assignString('seo_title')
  assignString('seo_keywords')
  assignString('company_info')
  assignString('add_time')

  if ('status' in b) {
    const s = parseOptionalInt(b.status)
    if (s === undefined) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
    }
    updateData.status = s
  }
  if ('is_free' in b) {
    updateData.is_free = Boolean(b.is_free)
  }
  if ('is_ad' in b) {
    updateData.is_ad = Boolean(b.is_ad)
  }
  if ('views' in b) {
    const v = parseOptionalInt(b.views)
    if (v !== undefined) {
      updateData.views = v
    }
  }
  if ('sort_weight' in b) {
    const w = parseOptionalInt(b.sort_weight)
    if (w !== undefined) {
      updateData.sort_weight = w
    }
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
