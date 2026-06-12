import { createError } from 'h3'
import prisma from '../../utils/prisma.js'

const BASE_CRITERIA = ['Ease of use', 'Output quality', 'Workflow fit', 'Integrations', 'Pricing', 'Support and reliability', 'Team adoption', 'Best-fit use case']

function unique(values, max) {
  return [...new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))].slice(0, max)
}

function toolSelect() {
  return {
    id: true, name: true, handle: true, website: true, description: true, whatIsSummary: true,
    monthVisitedCount: true, pricing: true, feature: true, pros: true, cons: true, useCases: true,
    forJobs: true, tags: true, rank: true,
    pricingPlans: { select: { id: true }, take: 1 },
    claims: { where: { status: 'ACTIVE', sourceId: { not: null }, confidence: { gte: 0.7 } }, select: { id: true }, take: 1 },
    toolCategories: { select: { categoryId: true, category: { select: { id: true, name: true, handle: true } } } },
  }
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
  return unique([...(category?.feature || []), ...BASE_CRITERIA], count)
}

function categoryAudience(category) {
  return category?.whoIsUse || `${category?.name || 'AI tool'} beginners, practitioners, and small teams`
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
    const tools = diversifiedTools(candidates, type === 'BUYER_GUIDE' ? Math.min(10, Math.max(5, task.limit || 5)) : 5)
    if (tools.length < (type === 'BUYER_GUIDE' ? 5 : 3)) throw createError({ statusCode: 422, statusMessage: 'prepareBriefInsufficientCategoryTools' })
    const common = {
      targetKeyword: type === 'BUYER_GUIDE' ? `best ${category.name.toLowerCase()} tools` : `${category.name.toLowerCase()} guide`,
      pageGoal: type === 'BUYER_GUIDE'
        ? `Help readers compare and choose the ${category.name} tools that best fit their workflow, budget, and experience level.`
        : `Explain what ${category.name} tools are, who they are for, how they work, and how to choose one.`,
      searchIntent: type === 'BUYER_GUIDE' ? 'buyer_guide' : 'informational',
      audience: categoryAudience(category),
    }
    if (type === 'BUYER_GUIDE') return { ...common, selectedToolIds: tools.map(tool => tool.id), decisionCriteria: criteria(category, 8) }
    return {
      ...common,
      representativeToolIds: tools.slice(0, 5).map(tool => tool.id),
      categoryContext: {
        whatIsSummary: category.whatIsSummary || '', feature: category.feature || [], whoIsUse: category.whoIsUse || '',
        howDoWork: category.howDoWork || '', advantages: category.advantages || '', faq: category.faq || [],
      },
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

  if (type === 'COMPARISON') {
    const secondaryToolId = task.promptJson?.brief?.secondaryToolId
    const secondary = secondaryToolId
      ? await explicitComparisonTool(secondaryToolId, task.categoryId, primary.id)
      : diversifiedTools(candidates, 1, [primary.id])[0]
    if (!secondary) throw createError({ statusCode: 422, statusMessage: 'prepareBriefMissingSecondaryTool' })
    const dimensions = criteria(category, 8)
    const sharedUseCases = unique((primary.useCases || []).filter(value => (secondary.useCases || []).map(item => item.toLowerCase()).includes(value.toLowerCase())), 6)
    return {
      primaryToolId: primary.id, secondaryToolId: secondary.id,
      comparisonIntent: `Help readers choose between ${primary.name} and ${secondary.name} for overlapping ${category?.name || 'AI'} workflows.`,
      targetAudience: `${categoryAudience(category)} comparing a two-tool shortlist`,
      decisionCriteria: dimensions.slice(0, 8),
      sharedUseCases: sharedUseCases.length ? sharedUseCases : unique([useCase(primary, category), useCase(secondary, category), category?.name], 3),
      featureComparisonFacts: featureFacts([primary, secondary], dimensions),
      pricingComparisonFacts: pricingFacts([primary, secondary]),
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
