import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // 获取原始参数（会是 category,ai-xxx 格式）
  let slug = getRouterParam(event, 'slug') as string

  console.log('原始 slug：', slug)

  // ✅ 核心修复：自动剥离掉前面的 category/ 前缀
  if (slug && slug.includes(',')) {
    const parts = slug.split(',')
    slug = parts[parts.length - 1] as string // 取最后一段，就是真实slug
  }

  console.log('✅ 处理后真实 slug：', slug)

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing category slug',
    })
  }

  // 查询（已去掉 is_active，用 findFirst）
  const category = await prisma.categoryLevel2.findFirst({
    where: {
      handle: slug,
    },
    include: {
      level1: {
        select: {
          id: true,
          name: true,
          handle: true,
        },
      },
      toolCategories: {
        include: {
          aiTool: true,
        },
      },
    },
  })

  if (!category) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Category not found',
    })
  }

  // 工具数据处理
  const tools = category.toolCategories
    .map(({ aiTool }) => aiTool)
    .filter(Boolean)
    .sort((a, b) => {
      const aCount = Number(a.month_visited_count || 0)
      const bCount = Number(b.month_visited_count || 0)
      return bCount - aCount
    })
    .slice(0, 30)
    .map((tool) => ({
      id: tool.id,
      handle: tool.handle,
      name: tool.name,
      description: tool.description,
      website: tool.website,
      website_logo: tool.website_logo,
      month_visited_count: Number(tool.month_visited_count || 0),
      is_free: tool.is_free,
      tool_info_review: tool.tool_info_review ? Number(tool.tool_info_review) : null,
      pricing: tool.pricing,
      pros: tool.pros,
      cons: tool.cons,
    }))

  const faq = category.faq || []

  return {
    category: {
      id: category.id,
      name: category.name,
      handle: category.handle,
      what_is_summary: category.what_is_summary,
      feature: category.feature,
      who_is_use: category.who_is_use,
      how_do_work: category.how_do_work,
      advantages: category.advantages,
      faq,
      parent: category.level1,
    },
    tools,
  }
})