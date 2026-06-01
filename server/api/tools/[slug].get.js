import prisma from '~/server/utils/prisma'

const RELATED_TAKE = 6
const SIMILAR_CATS_TAKE = 8

// 工具字段白名单 —— 严禁 SELECT *
const TOOL_DETAIL_SELECT = {
  id: true,
  handle: true,
  name: true,
  website: true,
  websiteName: true,
  websiteLogo: true,
  image: true,
  description: true,
  whatIsSummary: true,
  isFree: true,
  isAd: true,
  toolInfoReview: true,
  monthVisitedCount: true,
  collectedCount: true,
  pricing: true,
  feature: true,
  pros: true,
  cons: true,
  tags: true,
  websiteType: true,
  socialEmail: true,
  forJobs: true,
  useCases: true,
  companyInfo: true,
  recommendLearn: true,
  addTime: true,
  createdAt: true,
  updatedAt: true,
  faq: true,
}

const RELATED_SELECT = {
  id: true,
  handle: true,
  name: true,
  description: true,
  website: true,
  websiteLogo: true,
  isFree: true,
  toolInfoReview: true,
  monthVisitedCount: true,
  pricing: true,
  tags: true,
}

/**
 * 工具详情页 API
 * 性能红线：
 * 1. select 白名单，不走 SELECT *
 * 2. 先获取 tool + categoryIds（1 次查询），再并行查 related + similarCategories（2 次并行）
 * 3. 相关工具按 monthly_visits 降序，仅取前 6
 * 4. 同级分类最多 8 个
 * 5. Cache-Control: public, max-age=3600（详情页变动低频）
 */
export default defineEventHandler(async (event) => {
  // ---------- 1. slug 规范化 ----------
  let slug = getRouterParam(event, 'slug')
  if (slug && slug.includes(',')) {
    const parts = slug.split(',')
    slug = parts[parts.length - 1]
  }
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing tool slug' })
  }

  // ---------- 2. 查询工具详情 + 关联分类 ----------
  const tool = await prisma.aiTool.findUnique({
    where: { handle: slug },
    select: {
      ...TOOL_DETAIL_SELECT,
      toolCategories: {
        select: {
          category: {
            select: {
              id: true,
              name: true,
              handle: true,
              level1Id: true,
              level1: {
                select: { id: true, name: true, handle: true },
              },
            },
          },
        },
        take: 5,
      },
    },
  })

  if (!tool) {
    throw createError({ statusCode: 404, statusMessage: 'Tool not found' })
  }

  // 拿出所属的 L2 和 L1 id 以便并行查询
  const subCategories = tool.toolCategories
    .map((tc) => tc.category)
    .filter(Boolean)
  const subCategoryIds = subCategories.map((c) => c.id)
  const parentId = subCategories[0]?.level1Id || null
  const primarySubCategoryId = subCategories[0]?.id || null

  // ---------- 3. 并行查询：related tools + similar categories ----------
  const [relatedRaw, similarCategories] = await Promise.all([
    // Related tools: 同 L2 分类下，排除自身，按 traffic 降序
    subCategoryIds.length
      ? prisma.aiTool.findMany({
          where: {
            id: { not: tool.id },
            toolCategories: {
              some: { categoryId: { in: subCategoryIds } },
            },
          },
          orderBy: [
            { monthVisitedCount: 'desc' },
            { collectedCount: 'desc' },
          ],
          take: RELATED_TAKE,
          select: RELATED_SELECT,
        })
      : Promise.resolve([]),

    // Similar categories: 同父 L1 下的其他 L2
    parentId
      ? prisma.categoryLevel2.findMany({
          where: {
            isActive: true,
            level1Id: parentId,
            NOT: primarySubCategoryId ? { id: primarySubCategoryId } : undefined,
          },
          orderBy: [{ toolCount: 'desc' }, { sort: 'desc' }],
          take: SIMILAR_CATS_TAKE,
          select: {
            id: true,
            name: true,
            handle: true,
            toolCount: true,
          },
        })
      : Promise.resolve([]),
  ])

  // ---------- 4. FAQ 规范化 ----------
  const faqRaw = Array.isArray(tool.faq) ? tool.faq : []
  const faq = faqRaw
    .map((item) => {
      if (!item) return null
      const question = item.title || item.question || ''
      const answer = item.desc || item.answer || ''
      if (!question || !answer) return null
      return { question: String(question), answer: String(answer) }
    })
    .filter(Boolean)

  // ---------- 5. 响应 + Cache-Control ----------
  setHeader(event, 'Cache-Control', 'public, max-age=600, stale-while-revalidate=3600')
  setHeader(event, 'CDN-Cache-Control', 'public, max-age=3600')

  return {
    tool: {
      id: tool.id,
      handle: tool.handle,
      name: tool.name,
      website: tool.website || null,
      websiteName: tool.websiteName || null,
      logoUrl: tool.websiteLogo || null,
      imageUrl: tool.image || null,
      shortDesc: tool.description || '',
      longDesc: tool.whatIsSummary || '',
      isFree: Boolean(tool.isFree),
      isAd: Boolean(tool.isAd),
      rating: tool.toolInfoReview ? Number(tool.toolInfoReview) : null,
      monthlyVisits: Number(tool.monthVisitedCount || 0),
      collected: Number(tool.collectedCount || 0),
      // 价格字段是富文本（字符串数组） —— 原样下发
      pricing: Array.isArray(tool.pricing) ? tool.pricing : [],
      features: Array.isArray(tool.feature) ? tool.feature : [],
      pros: Array.isArray(tool.pros) ? tool.pros : [],
      cons: Array.isArray(tool.cons) ? tool.cons : [],
      tags: Array.isArray(tool.tags) ? tool.tags : [],
      websiteType: Array.isArray(tool.websiteType) ? tool.websiteType : [],
      socialEmail: Array.isArray(tool.socialEmail) ? tool.socialEmail : [],
      forJobs: Array.isArray(tool.forJobs) ? tool.forJobs : [],
      useCases: Array.isArray(tool.useCases) ? tool.useCases : [],
      recommendLearn: Array.isArray(tool.recommendLearn) ? tool.recommendLearn : [],
      companyInfo: tool.companyInfo || null,
      addTime: tool.addTime || null,
      createdAt: tool.createdAt,
      updatedAt: tool.updatedAt,
      faq,
      categories: subCategories.map((c) => ({
        id: c.id,
        name: c.name,
        handle: c.handle,
        parentHandle: c.level1?.handle || '',
      })),
      parentCategory: subCategories[0]?.level1
        ? {
            id: subCategories[0].level1.id,
            name: subCategories[0].level1.name,
            handle: subCategories[0].level1.handle,
          }
        : null,
    },
    relatedTools: relatedRaw.map((t) => ({
      id: t.id,
      handle: t.handle,
      name: t.name,
      shortDesc: t.description || '',
      iconUrl: t.websiteLogo || null,
      website: t.website || null,
      isFree: Boolean(t.isFree),
      rating: t.toolInfoReview ? Number(t.toolInfoReview) : null,
      monthlyVisits: Number(t.monthVisitedCount || 0),
      pricing: Array.isArray(t.pricing) ? t.pricing : [],
      tags: Array.isArray(t.tags) ? t.tags.slice(0, 3) : [],
      isAd: false,
    })),
    similarCategories: similarCategories.map((c) => ({
      id: c.id,
      name: c.name,
      handle: c.handle,
      toolCount: c.toolCount || 0,
      parentHandle: subCategories[0]?.level1?.handle || '',
    })),
  }
})
