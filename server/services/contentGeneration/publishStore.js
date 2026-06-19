import prisma from '~/server/utils/prisma'
import { ALTERNATIVE_RESPONSE_SHAPE, COMPARE_RESPONSE_SHAPE } from './responseSchemas'

const CONTENT_TYPES = new Set([
  'TUTORIAL',
  'COMPARISON',
  'ALTERNATIVE',
  'CATEGORY_GUIDE',
  'BUYER_GUIDE',
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

function requireContentType(value) {
  const normalized = String(value || '').trim().toUpperCase()
  if (!CONTENT_TYPES.has(normalized)) throw new Error(`unsupportedContentType: ${value || '(empty)'}`)
  return normalized
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

function cleanComparisonSlug(value) {
  return String(value || '').trim().replace(/-comparison$/i, '')
}

function contentPageData(task, content) {
  const meta = content.contentPage || {}
  const type = requireContentType(meta.type || task.contentType)
  const slug = type === 'COMPARISON'
    ? cleanComparisonSlug(task.slug || meta.slug)
    : meta.slug || task.slug
  const canonicalPath = type === 'COMPARISON'
    ? `/compare/${slug}`
    : meta.canonicalPath || `/${task.targetType || 'content'}/${slug}`
  return {
    type,
    slug,
    canonicalPath,
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
  const type = requireContentType(meta.type)
  const typedWriteStatus = { status: 'written', contentType: type, tables: [], counts: {} }

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
    typedWriteStatus.tables.push('categoryContentPage')
    typedWriteStatus.counts.categoryContentPage = 1
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
    typedWriteStatus.tables.push('tutorialPage')
    typedWriteStatus.counts.tutorialPage = 1
  }

  if (type === 'COMPARISON') {
    const pageKey = COMPARE_RESPONSE_SHAPE.typedFields[0]
    const toolsKey = COMPARE_RESPONSE_SHAPE.typedFields[1]
    const child = content[pageKey]
    const tools = Array.isArray(content[toolsKey]) ? content[toolsKey] : []
    if (!child || tools.length < 2) throw new Error('COMPARISON requires comparisonPage and at least two comparisonTools')

    await tx.comparisonPage.upsert({
      where: { contentPageId },
      create: {
        contentPageId,
        comparisonType: normalizeEnum(child.comparisonType, new Set(['TOOL_VS_TOOL', 'MULTI_TOOL', 'TOOL_VS_CATEGORY', 'ALTERNATIVES']), 'TOOL_VS_TOOL'),
        primaryToolId: child.primaryToolId ?? null,
        secondaryToolId: child.secondaryToolId ?? null,
        categoryId: child.categoryId ?? null,
        verdict: child.verdict || null,
        criteriaJson: child.criteriaJson || null,
        matrixJson: child.matrixJson || null,
        pricingSummary: child.pricingSummary || null,
      },
      update: {
        comparisonType: normalizeEnum(child.comparisonType, new Set(['TOOL_VS_TOOL', 'MULTI_TOOL', 'TOOL_VS_CATEGORY', 'ALTERNATIVES']), 'TOOL_VS_TOOL'),
        primaryToolId: child.primaryToolId ?? null,
        secondaryToolId: child.secondaryToolId ?? null,
        categoryId: child.categoryId ?? null,
        verdict: child.verdict || null,
        criteriaJson: child.criteriaJson || null,
        matrixJson: child.matrixJson || null,
        pricingSummary: child.pricingSummary || null,
      },
    })
    await tx.comparisonTool.deleteMany({ where: { comparisonPageId: contentPageId } })
    await tx.comparisonTool.createMany({
      data: tools.map((tool, index) => ({
        comparisonPageId: contentPageId,
        toolId: Number(tool.toolId),
        position: Number(tool.position) || index + 1,
        label: tool.label || null,
        bestFor: tool.bestFor || null,
        summary: tool.summary || null,
      })),
    })
    typedWriteStatus.tables.push(pageKey, toolsKey)
    typedWriteStatus.counts[pageKey] = 1
    typedWriteStatus.counts[toolsKey] = tools.length
  }

  if (type === 'ALTERNATIVE') {
    const pageKey = ALTERNATIVE_RESPONSE_SHAPE.typedFields[0]
    const toolsKey = ALTERNATIVE_RESPONSE_SHAPE.typedFields[1]
    const child = content[pageKey]
    const tools = Array.isArray(content[toolsKey]) ? content[toolsKey] : []
    if (!child?.primaryToolId || !tools.length) throw new Error('ALTERNATIVE requires alternativePage.primaryToolId and alternativeTools')

    await tx.alternativePage.upsert({
      where: { contentPageId },
      create: {
        contentPageId,
        primaryToolId: Number(child.primaryToolId),
        categoryId: child.categoryId ?? null,
        reasonToSwitch: child.reasonToSwitch || null,
        selectionCriteriaJson: child.selectionCriteriaJson || null,
      },
      update: {
        primaryToolId: Number(child.primaryToolId),
        categoryId: child.categoryId ?? null,
        reasonToSwitch: child.reasonToSwitch || null,
        selectionCriteriaJson: child.selectionCriteriaJson || null,
      },
    })
    await tx.alternativeTool.deleteMany({ where: { alternativePageId: contentPageId } })
    await tx.alternativeTool.createMany({
      data: tools.map((tool, index) => ({
        alternativePageId: contentPageId,
        toolId: Number(tool.toolId),
        position: Number(tool.position) || index + 1,
        reason: tool.reason || null,
        bestFor: tool.bestFor || null,
        tradeoff: tool.tradeoff || null,
      })),
    })
    typedWriteStatus.tables.push(pageKey, toolsKey)
    typedWriteStatus.counts[pageKey] = 1
    typedWriteStatus.counts[toolsKey] = tools.length
  }

  return typedWriteStatus
}

async function writePublishedContentFromTask(tx, task, content, { failIfExists = false } = {}) {
  const data = contentPageData(task, content)
  const existing = await tx.contentPage.findFirst({
    where: {
      OR: [
        { canonicalPath: data.canonicalPath },
        { type: data.type, slug: data.slug },
      ],
    },
    select: { id: true },
  })

  if (existing && failIfExists) {
    const error = new Error(`页面路径或 slug 已存在：${data.canonicalPath}`)
    error.code = 'CONTENT_PAGE_EXISTS'
    throw error
  }

  const page = existing
    ? await tx.contentPage.update({
        where: { id: existing.id },
        data,
      })
    : await tx.contentPage.create({ data })

  const typedWriteStatus = await upsertTypedChild(tx, page.id, content)
  await replaceSources(tx, page.id, content.sources || [])

  return { page, typedWriteStatus }
}

export async function upsertPublishedContentFromTask(task, content, options = {}) {
  if (options.tx) {
    return writePublishedContentFromTask(options.tx, task, content, options)
  }

  return prisma.$transaction(async (tx) => {
    return writePublishedContentFromTask(tx, task, content, options)
  }, { maxWait: 10000, timeout: 30000 })
}
