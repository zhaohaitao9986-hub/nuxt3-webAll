import prisma from '~/server/utils/prisma'

const CONTENT_TYPES = new Set([
  'COLLECTION',
  'TOOL_REVIEW',
  'TUTORIAL',
  'COMPARISON',
  'ALTERNATIVE',
  'INDUSTRY_USE_CASE',
  'WORKFLOW_USE_CASE',
  'CATEGORY_GUIDE',
  'BUYER_GUIDE',
  'PRICING_GUIDE',
  'METHODOLOGY',
])

const ROBOTS_POLICIES = new Set(['INDEX_FOLLOW', 'NOINDEX_FOLLOW', 'NOINDEX_NOFOLLOW'])
const SOURCE_TYPES = new Set([
  'OFFICIAL_SITE',
  'PRICING_PAGE',
  'DOCUMENTATION',
  'HELP_CENTER',
  'PRESS_RELEASE',
  'THIRD_PARTY_REVIEW',
  'INTERNAL_TEST',
  'OTHER',
])

function normalizeEnum(value, allowed, fallback) {
  const normalized = String(value || '').trim().toUpperCase()
  return allowed.has(normalized) ? normalized : fallback
}

function toDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function safeDomain(url) {
  try {
    return new URL(url).hostname
  }
  catch {
    return ''
  }
}

function contentPageData(task, content) {
  const meta = content.contentPage || {}
  const slug = meta.slug || task.slug
  const type = normalizeEnum(meta.type || task.contentType, CONTENT_TYPES, 'BUYER_GUIDE')
  return {
    type,
    slug,
    canonicalPath: meta.canonicalPath || `/${task.targetType || 'content'}/${slug}`,
    title: meta.title || task.title,
    metaTitle: meta.metaTitle || meta.meta_title || null,
    metaDescription: meta.metaDescription || meta.meta_description || null,
    summary: meta.summary || null,
    bodyJson: content.bodyJson || content.body_json || null,
    seoJson: content.seoJson || content.seo_json || null,
    schemaJson: content.schemaJson || content.schema_json || null,
    status: 'PUBLISHED',
    robots: normalizeEnum(meta.robots, ROBOTS_POLICIES, 'INDEX_FOLLOW'),
    publishedAt: new Date(),
    reviewedAt: new Date(),
    updatedAt: new Date(),
  }
}

async function replaceSources(tx, contentPageId, sources = []) {
  await tx.contentSource.deleteMany({ where: { contentPageId } })

  for (const [index, source] of sources.entries()) {
    if (!source?.url) continue
    const row = await tx.source.upsert({
      where: { url: source.url },
      create: {
        url: source.url,
        domain: source.domain || safeDomain(source.url),
        title: source.title || null,
        sourceType: normalizeEnum(source.sourceType || source.source_type, SOURCE_TYPES, 'OTHER'),
        retrievedAt: toDate(source.retrievedAt || source.retrieved_at),
        lastCheckedAt: new Date(),
        status: 'ACTIVE',
      },
      update: {
        domain: source.domain || safeDomain(source.url),
        title: source.title || null,
        sourceType: normalizeEnum(source.sourceType || source.source_type, SOURCE_TYPES, 'OTHER'),
        retrievedAt: toDate(source.retrievedAt || source.retrieved_at),
        lastCheckedAt: new Date(),
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    })

    await tx.contentSource.create({
      data: {
        contentPageId,
        sourceId: row.id,
        context: source.context || null,
        sort: Number(source.sort) || index + 1,
      },
    })
  }
}

async function upsertTypedChild(tx, contentPageId, content) {
  const meta = content.contentPage || {}
  const type = normalizeEnum(meta.type, CONTENT_TYPES, 'BUYER_GUIDE')

  if (type === 'BUYER_GUIDE' || type === 'CATEGORY_GUIDE') {
    const child = content.categoryContentPage || content.category_content_page || {}
    await tx.categoryContentPage.upsert({
      where: { contentPageId },
      create: {
        contentPageId,
        level1Id: child.level1Id ?? child.level1_id ?? null,
        level2Id: child.level2Id ?? child.level2_id ?? null,
      },
      update: {
        level1Id: child.level1Id ?? child.level1_id ?? null,
        level2Id: child.level2Id ?? child.level2_id ?? null,
      },
    })
  }

  if (type === 'TUTORIAL' && content.tutorialPage) {
    const child = content.tutorialPage
    await tx.tutorialPage.upsert({
      where: { contentPageId },
      create: {
        contentPageId,
        toolId: child.toolId ?? child.tool_id ?? null,
        categoryId: child.categoryId ?? child.category_id ?? null,
        difficulty: normalizeEnum(child.difficulty, new Set(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']), 'BEGINNER'),
        durationMinutes: child.durationMinutes ?? child.duration_minutes ?? null,
        outcome: child.outcome || null,
        prerequisites: Array.isArray(child.prerequisites) ? child.prerequisites : [],
        stepsJson: child.stepsJson || child.steps_json || {},
        faqJson: child.faqJson || child.faq_json || null,
      },
      update: {
        toolId: child.toolId ?? child.tool_id ?? null,
        categoryId: child.categoryId ?? child.category_id ?? null,
        difficulty: normalizeEnum(child.difficulty, new Set(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']), 'BEGINNER'),
        durationMinutes: child.durationMinutes ?? child.duration_minutes ?? null,
        outcome: child.outcome || null,
        prerequisites: Array.isArray(child.prerequisites) ? child.prerequisites : [],
        stepsJson: child.stepsJson || child.steps_json || {},
        faqJson: child.faqJson || child.faq_json || null,
      },
    })
  }
}

export async function upsertPublishedContentFromTask(task, content) {
  return prisma.$transaction(async (tx) => {
    const data = contentPageData(task, content)
    const existing = await tx.contentPage.findUnique({
      where: { canonicalPath: data.canonicalPath },
      select: { id: true },
    })

    const page = existing
      ? await tx.contentPage.update({
          where: { id: existing.id },
          data,
        })
      : await tx.contentPage.create({ data })

    await upsertTypedChild(tx, page.id, content)
    await replaceSources(tx, page.id, content.sources || [])

    return page
  })
}
