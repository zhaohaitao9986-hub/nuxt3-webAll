import { createError } from 'h3'
import prisma from '../../utils/prisma.js'
import { buildContentSourceData } from './sourceBuilder.js'
import { resolveCompareCriteriaTemplate } from './compareCriteriaTemplates.js'
import { slugify } from './slugUtils.js'
import {
  logCompareCategorySelection,
  resolveCompareCategorySelection,
} from './compareCategorySelection.js'

const BASE_CRITERIA = ['Ease of use', 'Output quality', 'Workflow fit', 'Integrations', 'Pricing', 'Support and reliability', 'Team adoption', 'Best-fit use case']
const CATEGORY_KEYWORD_OPTIONS = {
  'ai-writing-assistants': [
    'Best AI Writing Assistants',
    'AI Writing Assistant Software',
    'Best AI Writing Tools',
    'AI Writing Tools for Content Creation',
  ],
  'ai-summarizer': [
    'Best AI Summarizer Tools',
    'AI Summary Tools',
    'Best AI Tools for Summarizing Content',
    'AI Summarization Software',
  ],
}
const CATEGORY_DECISION_CRITERIA = {
  'ai-writing-assistants': [
    'Writing Quality',
    'Long-form Content',
    'SEO Features',
    'Templates',
    'Ease of Use',
    'Integrations',
    'Pricing',
    'Collaboration',
  ],
  'ai-summarizer': [
    'Summary Accuracy',
    'Supported Formats',
    'Speed',
    'Export Options',
    'Pricing',
  ],
}
const CATEGORY_AUDIENCES = {
  'ai-writing-assistants': {
    primaryAudience: 'Content marketers, freelance writers, and editorial teams comparing AI writing assistants for recurring content creation.',
    secondaryAudience: 'Founders, students, and small business operators who need faster drafting, rewriting, and editing workflows.',
  },
  'ai-summarizer': {
    primaryAudience: 'Researchers, students, analysts, and knowledge workers comparing tools for summarizing articles, PDFs, videos, and meeting content.',
    secondaryAudience: 'Content teams and operators who need quick summaries for review, documentation, and internal sharing.',
  },
}

function unique(values, max) {
  return [...new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))].slice(0, max)
}

function sentence(value, max = 240) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function toolSelect() {
  return {
    id: true, name: true, handle: true, website: true, description: true, whatIsSummary: true,
    monthVisitedCount: true, pricing: true, feature: true, pros: true, cons: true, useCases: true,
    forJobs: true, tags: true, rank: true,
    pricingPlans: { select: { id: true }, take: 1 },
    claims: { where: { status: 'ACTIVE', sourceId: { not: null }, confidence: { gte: 0.7 } }, select: { id: true }, take: 1 },
    toolCategories: { select: { categoryId: true, category: { select: { id: true, name: true, handle: true, toolCount: true } } } },
  }
}

async function loadComparisonTool(toolId) {
  const normalizedToolId = Number(toolId) || null
  if (!normalizedToolId) return null
  return prisma.aiTool.findFirst({
    where: { id: normalizedToolId, toolStatus: { in: ['ONLINE', 'ACTIVE'] } },
    select: toolSelect(),
  })
}

function factScore(tool) {
  return Number(Boolean(tool.website)) * 20
    + Number(Boolean(tool.description || tool.whatIsSummary)) * 15
    + Number(Boolean(tool.pricing?.length || tool.pricingPlans?.length)) * 12
    + Math.min(18, (tool.feature?.length || 0) * 2)
    + Math.min(12, (tool.pros?.length || 0) + (tool.cons?.length || 0))
    + Math.min(12, (tool.useCases?.length || 0) * 2)
    + Number(Boolean(tool.claims?.length)) * 5
    + Math.log10(Number(tool.monthVisitedCount || 0) + 1) * 4
}

function diversifiedTools(rows, count, excludeIds = []) {
  const excluded = new Set(excludeIds.map(Number))
  const ranked = rows.filter(tool => !excluded.has(tool.id)).sort((a, b) => factScore(b) - factScore(a) || a.rank - b.rank)
  const selected = []
  const signatures = new Set()
  for (const tool of ranked) {
    const signature = String(tool.useCases?.[0] || tool.forJobs?.[0] || tool.tags?.[0] || 'general').toLowerCase()
    if (!signatures.has(signature) || selected.length + (ranked.length - ranked.indexOf(tool)) <= count) {
      selected.push(tool)
      signatures.add(signature)
    }
    if (selected.length >= count) break
  }
  for (const tool of ranked) {
    if (selected.length >= count) break
    if (!selected.some(item => item.id === tool.id)) selected.push(tool)
  }
  return selected
}

async function categoryWithTools(categoryId) {
  if (!categoryId) return null
  return prisma.categoryLevel2.findUnique({
    where: { id: Number(categoryId) },
    include: {
      level1: { select: { id: true, name: true, handle: true } },
      toolCategories: {
        where: { aiTool: { toolStatus: { in: ['ONLINE', 'ACTIVE'] }, website: { not: null }, OR: [{ description: { not: null } }, { whatIsSummary: { not: null } }] } },
        select: { aiTool: { select: toolSelect() } },
        take: 50,
      },
    },
  })
}

async function primaryContext(toolId, preferredCategoryId = null) {
  if (!toolId) return null
  const tool = await prisma.aiTool.findFirst({
    where: { id: Number(toolId), toolStatus: { in: ['ONLINE', 'ACTIVE'] } },
    select: toolSelect(),
  })
  if (!tool) return null
  const requestedCategoryId = Number(preferredCategoryId) || null
  const categoryId = requestedCategoryId || tool.toolCategories[0]?.categoryId || null
  const category = categoryId ? await categoryWithTools(categoryId) : null
  return { tool, category }
}

async function explicitComparisonTool(toolId, categoryId, primaryToolId) {
  const normalizedToolId = Number(toolId) || null
  if (!normalizedToolId) return null
  if (normalizedToolId === Number(primaryToolId)) {
    throw createError({ statusCode: 422, statusMessage: 'prepareBriefDuplicateComparisonTools' })
  }
  const tool = await prisma.aiTool.findFirst({
    where: { id: normalizedToolId, toolStatus: { in: ['ONLINE', 'ACTIVE'] } },
    select: toolSelect(),
  })
  if (!tool) throw createError({ statusCode: 422, statusMessage: 'prepareBriefSecondaryToolNotFound' })
  if (categoryId && !tool.toolCategories.some(row => row.categoryId === Number(categoryId))) {
    throw createError({ statusCode: 422, statusMessage: 'prepareBriefSecondaryToolOutsideCategory' })
  }
  return tool
}

function criteria(category, count) {
  return unique([...(CATEGORY_DECISION_CRITERIA[category?.handle] || []), ...(category?.feature || []), ...BASE_CRITERIA], count)
}

function categoryAudience(category) {
  return category?.whoIsUse || `${category?.name || 'AI tool'} beginners, practitioners, and small teams`
}

function categoryAudienceProfile(category) {
  const configured = CATEGORY_AUDIENCES[category?.handle]
  if (configured) return configured
  return {
    primaryAudience: categoryAudience(category),
    secondaryAudience: `Teams and individual practitioners evaluating ${category?.name || 'AI tools'} for workflow fit, pricing, and ease of adoption.`,
  }
}

function targetKeyword(category, type) {
  if (type !== 'BUYER_GUIDE') return `${category.name} Guide`
  const options = CATEGORY_KEYWORD_OPTIONS[category.handle]
  if (options?.length) return options[0]
  return `Best ${category.name}`
}

function businessPageGoal(category) {
  if (category?.handle === 'ai-paraphraser') {
    return 'Help readers compare AI paraphrasing tools, evaluate rewriting quality and workflow fit, and choose a solution that matches their budget and content needs.'
  }
  if (category?.handle === 'ai-writing-assistants') {
    return 'Help readers compare AI writing assistants and choose the best tool for drafting, editing, collaboration, and content production workflows.'
  }
  if (category?.handle === 'ai-summarizer') {
    return 'Help readers compare AI summarizer tools and identify the best option for document, article, meeting, and research summarization workflows.'
  }
  return `Help readers compare ${category.name} tools, evaluate workflow fit, pricing, and practical trade-offs, and choose a solution that matches their content and business needs.`
}

function buyerGuideTitle(keyword) {
  const normalized = sentence(keyword, 120)
  if (!normalized) return 'AI Tools Guide in 2026'
  return /\b(tools?|software|platforms?|apps?)\b/i.test(normalized)
    ? `${normalized} in 2026`
    : `${normalized} Tools in 2026`
}

function buyerGuideSlug(keyword, category) {
  return slugify(keyword) || slugify(category?.handle || category?.name) || 'ai-tools'
}

function comparisonTitle(primary, secondary) {
  return `${primary.name} vs ${secondary.name}: Detailed Comparison`
}

function comparisonSlug(primary, secondary) {
  return slugify(`${primary.name} vs ${secondary.name}`)
}

function briefContext(category, selectedTools) {
  return {
    categoryName: category?.name || '',
    categorySlug: category?.handle || '',
    parentCategory: category?.level1?.name || '',
    categorySummary: sentence(category?.whatIsSummary, 500),
    coreCapabilities: unique(category?.feature || [], 8),
    buyerQuestions: [
      `Which ${category?.name || 'AI tools'} are strongest for the primary workflow?`,
      'Which tools are broad platforms versus focused category specialists?',
      'What trade-offs matter for quality, workflow fit, pricing, and team adoption?',
    ],
    contentAngles: [
      'Compare tools by practical buyer criteria rather than generic popularity.',
      'Explain limitations when a selected tool is broader than the category.',
      'Prioritize tool-specific evidence, supported workflows, pricing context, and use cases.',
    ],
    selectedToolNames: selectedTools.map(tool => tool.name),
  }
}

function briefTool(tool) {
  return {
    id: tool.id,
    name: tool.name,
    summary: sentence(tool.whatIsSummary || tool.description, 280),
    selectionReason: tool.selectionReason || '',
    relevanceLabel: tool.relevanceLabel || null,
  }
}

async function selectedBuyerGuideTools(task, category, commonBrief) {
  const sourceData = await buildContentSourceData({
    ...task,
    contentType: 'BUYER_GUIDE',
    categoryId: category.id,
    promptJson: {
      ...(task.promptJson || {}),
      brief: commonBrief,
    },
  })
  return sourceData.selectedTools || []
}

function useCase(tool, category) {
  return tool.useCases?.[0] || category?.name?.toLowerCase() || 'a practical workflow'
}

function featureFacts(tools, dimensions) {
  return dimensions.map(dimension => ({
    dimension,
    tools: tools.map(tool => ({ toolId: tool.id, facts: unique([...(tool.feature || []), ...(tool.pros || []), ...(tool.cons || [])], 6) })),
  }))
}

function pricingFacts(tools) {
  return tools.map(tool => ({ toolId: tool.id, pricingSummary: unique(tool.pricing, 5), hasStructuredPricing: Boolean(tool.pricingPlans?.length) }))
}

export async function prepareDeterministicBrief(task) {
  const type = String(task.contentType || '').toUpperCase()
  if (type === 'BUYER_GUIDE' || type === 'CATEGORY_GUIDE') {
    const category = await categoryWithTools(task.categoryId)
    if (!category) throw createError({ statusCode: 400, statusMessage: 'prepareBriefMissingCategory' })
    const candidates = category.toolCategories.map(row => row.aiTool)
    const tools = type === 'BUYER_GUIDE'
      ? []
      : diversifiedTools(candidates, 5)
    if (type !== 'BUYER_GUIDE' && tools.length < 3) throw createError({ statusCode: 422, statusMessage: 'prepareBriefInsufficientCategoryTools' })
    const audienceProfile = categoryAudienceProfile(category)
    const common = {
      targetKeyword: targetKeyword(category, type),
      pageGoal: type === 'BUYER_GUIDE'
        ? businessPageGoal(category)
        : `Explain what ${category.name} tools are, who they are for, how they work, and how to choose one.`,
      searchIntent: type === 'BUYER_GUIDE' ? 'buyer_guide' : 'informational',
      audience: type === 'BUYER_GUIDE'
        ? `${audienceProfile.primaryAudience} Secondary audience: ${audienceProfile.secondaryAudience}`
        : categoryAudience(category),
      ...(type === 'BUYER_GUIDE' ? audienceProfile : {}),
    }
    if (type === 'BUYER_GUIDE') {
      const decisionCriteria = criteria(category, 8)
      const selectedTools = await selectedBuyerGuideTools(task, category, {
        ...common,
        decisionCriteria,
      })
      if (selectedTools.length < 5) throw createError({ statusCode: 422, statusMessage: 'prepareBriefInsufficientCategoryTools' })
      const briefTools = selectedTools.map(briefTool)
      return {
        title: buyerGuideTitle(common.targetKeyword),
        slug: buyerGuideSlug(common.targetKeyword, category),
        ...common,
        selectedToolIds: selectedTools.map(tool => tool.id),
        selectedTools: briefTools,
        decisionCriteria,
        contentContext: briefContext(category, briefTools),
      }
    }
    return {
      title: `${category.name} Guide`,
      slug: slugify(category.handle || category.name),
      ...common,
      representativeToolIds: tools.slice(0, 5).map(tool => tool.id),
      categoryContext: {
        whatIsSummary: category.whatIsSummary || '', feature: category.feature || [], whoIsUse: category.whoIsUse || '',
        howDoWork: category.howDoWork || '', advantages: category.advantages || '', faq: category.faq || [],
      },
    }
  }

  if (type === 'COMPARISON') {
    const primaryToolId = task.toolId || task.promptJson?.brief?.primaryToolId
    const primary = await loadComparisonTool(primaryToolId)
    if (!primary) throw createError({ statusCode: 400, statusMessage: 'prepareBriefMissingPrimaryTool' })

    const secondaryToolId = task.promptJson?.brief?.secondaryToolId
    const secondary = secondaryToolId
      ? await loadComparisonTool(secondaryToolId)
      : null
    if (!secondary) throw createError({ statusCode: 422, statusMessage: 'prepareBriefMissingSecondaryTool' })
    if (Number(primary.id) === Number(secondary.id)) {
      throw createError({ statusCode: 422, statusMessage: 'prepareBriefDuplicateComparisonTools' })
    }

    const manualCategoryId = Number(task.manualCategoryId) || null
    const selection = resolveCompareCategorySelection(primary, secondary, { manualCategoryId })
    logCompareCategorySelection({
      ...selection,
      taskCategoryIdBefore: task.categoryIdBefore ?? task.categoryId ?? null,
    })

    const resolvedCategoryId = selection.categoryId
    if (!resolvedCategoryId) {
      throw createError({ statusCode: 422, statusMessage: 'prepareBriefNoSharedCategory' })
    }

    const category = await categoryWithTools(resolvedCategoryId)
    if (!category) throw createError({ statusCode: 422, statusMessage: 'prepareBriefCategoryNotFound' })

    const primaryInCategory = primary.toolCategories.some(row => Number(row.categoryId) === resolvedCategoryId)
    const secondaryInCategory = secondary.toolCategories.some(row => Number(row.categoryId) === resolvedCategoryId)
    if (!primaryInCategory || !secondaryInCategory) {
      throw createError({ statusCode: 422, statusMessage: 'prepareBriefToolsOutsideResolvedCategory' })
    }

    const sharedUseCases = unique((primary.useCases || []).filter(value => (secondary.useCases || []).map(item => item.toLowerCase()).includes(value.toLowerCase())), 6)
    const title = comparisonTitle(primary, secondary)
    const slug = comparisonSlug(primary, secondary)
    const template = resolveCompareCriteriaTemplate(selection, { sharedUseCases, title, slug })
    const dimensions = template.criteria
    return {
      title,
      slug,
      primaryToolId: primary.id,
      secondaryToolId: secondary.id,
      comparisonIntent: `Help readers choose between ${primary.name} and ${secondary.name} for overlapping ${category?.name || 'AI'} workflows.`,
      targetAudience: `${categoryAudience(category)} comparing a two-tool shortlist`,
      decisionCriteria: dimensions.slice(0, 8),
      sharedUseCases: sharedUseCases.length ? sharedUseCases : unique([useCase(primary, category), useCase(secondary, category), category?.name], 3),
      featureComparisonFacts: featureFacts([primary, secondary], dimensions),
      pricingComparisonFacts: pricingFacts([primary, secondary]),
      resolvedCategoryId,
      categorySelection: selection,
      selectedCategory: selection.selectedCategory || null,
      commonCategories: selection.commonCategories || [],
      criteriaTemplateKey: template.key,
      criteriaTemplateMatchedBy: template.matchedBy,
      criteriaTemplateFallbackUsed: template.fallbackUsed,
    }
  }

  const context = await primaryContext(task.toolId || task.promptJson?.brief?.primaryToolId, task.categoryId)
  if (!context) throw createError({ statusCode: 400, statusMessage: 'prepareBriefMissingPrimaryTool' })
  const { tool: primary, category } = context
  const candidates = category?.toolCategories?.map(row => row.aiTool) || []
  const useCaseName = useCase(primary, category)

  if (type === 'TUTORIAL') {
    const related = diversifiedTools(candidates, 2, [primary.id])
    return {
      targetKeyword: `how to use ${primary.name} for ${useCaseName}`,
      pageGoal: `Teach new ${primary.name} users to complete a concrete ${useCaseName} workflow and verify the result.`,
      searchIntent: 'tutorial',
      audience: `${primary.name} beginners and ${categoryAudience(category)}`,
      primaryToolId: primary.id,
      tutorialGoal: `Create, review, and export a production-ready ${useCaseName} result with ${primary.name}.`,
      prerequisiteKnowledge: ['Access to the tool', 'A sample input or project brief', 'Clear success criteria'],
      workflowContext: [
        'Define the desired output and success criteria.', 'Prepare the source material and required inputs.',
        `Create or open the appropriate workflow in ${primary.name}.`, 'Configure the relevant options using verified tool capabilities.',
        'Run the workflow and inspect the first result.', 'Refine weak output without changing the original goal.',
        'Verify the final result against the checklist.', 'Export or hand off the completed result.',
      ].map((instruction, index) => ({ step: index + 1, instruction })),
      commonMistakes: ['Starting without measurable success criteria', 'Using unsupported assumptions instead of verified tool capabilities', 'Skipping final review'],
      outputChecklist: ['The result matches the original goal', 'Required inputs were used', 'The output was reviewed for accuracy', 'Weak sections were refined', 'The final artifact was exported or saved'],
      relatedToolIds: related.map(tool => tool.id),
    }
  }

  if (type === 'ALTERNATIVE') {
    const alternatives = diversifiedTools(candidates, Math.min(8, Math.max(3, task.limit || 5)), [primary.id])
    if (alternatives.length < 3) throw createError({ statusCode: 422, statusMessage: 'prepareBriefInsufficientAlternatives' })
    const dimensions = criteria(category, 8)
    return {
      primaryToolId: primary.id,
      alternativeToolIds: alternatives.map(tool => tool.id),
      reasonToSwitch: `Consider alternatives to ${primary.name} when pricing, workflow fit, output controls, integrations, or target use cases do not match the reader's needs.`,
      selectionCriteria: dimensions.slice(0, 8),
      comparisonDimensions: dimensions.slice(0, 8),
      pricingSummary: pricingFacts([primary, ...alternatives]),
    }
  }

  throw createError({ statusCode: 400, statusMessage: `unsupportedContentType: ${type}` })
}
