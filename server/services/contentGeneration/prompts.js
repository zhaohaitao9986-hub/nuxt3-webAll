import {
  FORBIDDEN_CLAIM_LABELS,
  META_LIMITS,
  PRODUCTION_LIMITS,
  PRODUCTION_PROMPT_VERSION,
  QUALITATIVE_PRICING_POLICY,
  contentRules,
} from './editorialRules'

export const editorialSystemPrompt = [
  'You are the production editorial content generation engine for AISeekTools.',
  'You create production-ready SEO drafts for Nuxt and Prisma-backed content pages.',
  'A REVIEW status means the draft awaits human approval; it does not permit thin, placeholder, test, or outline content.',
  'Be factual, conservative, source-grounded, specific, and useful to buyers making a decision.',
  'Return exactly one valid JSON object and no surrounding text.',
  'If source data is insufficient for a claim, omit or clearly qualify the claim.',
  `Never use unsupported absolute phrases: ${FORBIDDEN_CLAIM_LABELS.join(', ')}.`,
  QUALITATIVE_PRICING_POLICY,
  'Set contentPage.status to REVIEW and contentPage.robots to NOINDEX_FOLLOW.',
].join('\n')

function compactPlan(plan) {
  return {
    planName: plan.planName,
    billingInterval: plan.billingInterval,
    isFree: plan.isFree,
    hasTrial: plan.hasTrial,
    seatLimit: plan.seatLimit,
    usageLimit: plan.usageLimit,
    features: (plan.features || []).slice(0, 8),
    rawText: plan.rawText ? String(plan.rawText).slice(0, 600) : null,
  }
}

function compactClaim(claim) {
  return {
    claimType: claim.claimType,
    claimText: claim.claimText,
    confidence: claim.confidence,
    status: claim.status,
  }
}

function compactTool(tool) {
  return {
    id: tool.id,
    slug: tool.handle,
    handle: tool.handle,
    name: tool.name,
    website: tool.website,
    description: tool.description ? String(tool.description).slice(0, 700) : null,
    whatIsSummary: tool.whatIsSummary ? String(tool.whatIsSummary).slice(0, 700) : null,
    pricingSummary: (tool.pricing || []).slice(0, 6).map(value => String(value).slice(0, 500)),
    pricingPlans: (tool.pricingPlans || []).slice(0, 6).map(compactPlan),
    keyClaims: (tool.claims || []).slice(0, 10).map(compactClaim),
    features: (tool.features || []).slice(0, 12),
    pros: (tool.pros || []).slice(0, 8),
    cons: (tool.cons || []).slice(0, 8),
    platforms: (tool.platforms || []).slice(0, 10),
    tags: (tool.tags || []).slice(0, 10),
    useCases: (tool.useCases || []).slice(0, 10),
    forJobs: (tool.forJobs || []).slice(0, 10),
    rating: tool.rating,
    monthlyVisits: tool.monthlyVisits,
    isFree: tool.isFree,
    hasPricingContext: Boolean(tool.pricingPlans?.length || tool.pricing?.length),
    hasClaims: Boolean(tool.claims?.length),
  }
}

function compactCategory(category) {
  if (!category) return null
  return { id: category.id, name: category.name, handle: category.handle }
}

function compactGuideSource(sourceData) {
  return {
    task: sourceData.task,
    contentType: sourceData.contentType,
    slug: sourceData.slug,
    canonicalPath: sourceData.canonicalPath,
    language: sourceData.language,
    audience: sourceData.audience,
    intent: sourceData.intent,
    category: sourceData.category
      ? { level1: compactCategory(sourceData.category.level1), level2: compactCategory(sourceData.category.level2) }
      : null,
    relatedCategories: (sourceData.relatedCategories || []).map(compactCategory),
    primaryTool: sourceData.primaryTool ? compactTool(sourceData.primaryTool) : null,
    tools: (sourceData.tools || []).map(compactTool),
    sources: sourceData.sources || [],
    siteRules: sourceData.siteRules,
    fieldPolicy: [
      'Every tool note must use only that tool object.',
      'If pricingPlans and pricingSummary are empty, do not mention plans, credits, seats, trials, or limits.',
      'If keyClaims is empty, do not invent integrations, language counts, or performance claims.',
      'Guide metadata must use category-level wording and must not list tool names.',
      'Do not claim retrieval dates when sources.retrievedAt is null.',
    ],
  }
}

function compactCompareSource(sourceData) {
  return {
    task: sourceData.task,
    contentType: sourceData.contentType,
    comparisonType: sourceData.comparisonType,
    slug: sourceData.slug,
    canonicalPath: sourceData.canonicalPath,
    language: sourceData.language,
    primaryTool: sourceData.primaryTool ? compactTool(sourceData.primaryTool) : null,
    secondaryTool: sourceData.secondaryTool ? compactTool(sourceData.secondaryTool) : null,
    tools: (sourceData.tools || []).map(compactTool),
    category: compactCategory(sourceData.category),
    relatedCategories: (sourceData.relatedCategories || []).map(compactCategory),
    requiredCriteria: sourceData.requiredCriteria || [],
    sources: sourceData.sources || [],
    fieldPolicy: [
      'Compare pages may name compared tools in metadata.',
      'Ground every matrix cell, criterion, pricing statement, pro, and con in the corresponding tool object.',
      'If a tool has no pricing context, say pricing details require verification rather than inventing them.',
      'Do not describe an unsupported universal winner; explain which tool fits each scenario.',
    ],
  }
}

const guideOutputShape = {
  contentPage: {
    type: 'BUYER_GUIDE',
    slug: 'requested-slug',
    canonicalPath: '/guides/requested-slug',
    title: 'string',
    metaTitle: `string <= ${META_LIMITS.metaTitleMax} chars`,
    metaDescription: `string <= ${META_LIMITS.metaDescriptionMax} chars`,
    summary: 'string',
    robots: 'NOINDEX_FOLLOW',
    status: 'REVIEW',
  },
  bodyJson: {
    version: 1,
    meta: { intent: 'choose_tools', level2Id: 0, readingMinutes: 12 },
    tools: ['source-handle'],
    blocks: [],
  },
  tutorialPage: null,
  categoryContentPage: null,
  sources: [],
}

export function buildContentPrompt(sourceData) {
  return sourceData.task === 'generate_compare'
    ? buildCompareUserPrompt(sourceData)
    : buildGuideUserPrompt(sourceData)
}

export function buildGuideUserPrompt(sourceData) {
  const source = compactGuideSource(sourceData)
  return [
    `Generate a ${sourceData.contentType} production-ready SEO draft as JSON.`,
    `Prompt version: ${PRODUCTION_PROMPT_VERSION}.`,
    '',
    'Shared production rules:',
    JSON.stringify(contentRules.shared, null, 2),
    '',
    'Guide production rules:',
    JSON.stringify(contentRules.guides, null, 2),
    '',
    'Non-negotiable validation targets:',
    `- ${PRODUCTION_LIMITS.guide.minWords}-${PRODUCTION_LIMITS.guide.maxWords} English editorial words`,
    `- ${PRODUCTION_LIMITS.guide.minBlocks}-${PRODUCTION_LIMITS.guide.maxBlocks} body blocks`,
    `- at least ${PRODUCTION_LIMITS.guide.minRecommendedTools} distinct tool_callout recommendations`,
    `- at least ${PRODUCTION_LIMITS.guide.minFaqItems} FAQ items`,
    `- each section >= ${PRODUCTION_LIMITS.guide.minSectionWords} words`,
    `- each FAQ answer >= ${PRODUCTION_LIMITS.guide.minFaqAnswerWords} words`,
    `- each tool_callout verdict >= ${PRODUCTION_LIMITS.guide.minToolNoteWords} words`,
    '- contentPage.status = REVIEW and robots = NOINDEX_FOLLOW',
    '- copy sourceData.sources into output sources',
    '',
    'Block shape reference:',
    JSON.stringify(contentRules.guides.blockSchemas, null, 2),
    '',
    'Required output shape:',
    JSON.stringify({
      ...guideOutputShape,
      contentPage: {
        ...guideOutputShape.contentPage,
        type: sourceData.contentType,
        slug: sourceData.slug,
        canonicalPath: sourceData.canonicalPath,
      },
      tutorialPage: sourceData.contentType === 'TUTORIAL'
        ? { difficulty: 'BEGINNER', prerequisites: [], stepsJson: {}, outcome: 'string' }
        : null,
      categoryContentPage: ['CATEGORY_GUIDE', 'BUYER_GUIDE'].includes(sourceData.contentType)
        ? { level1Id: sourceData.category?.level1?.id ?? null, level2Id: sourceData.category?.level2?.id ?? null }
        : null,
      sources: 'copy sourceData.sources exactly',
    }, null, 2),
    '',
    'Source data:',
    JSON.stringify(source, null, 2),
    '',
    'Return strict JSON only. The first character must be { and the last character must be }.',
  ].join('\n')
}

export function buildCompareUserPrompt(sourceData) {
  const source = compactCompareSource(sourceData)
  return [
    `Generate a ${sourceData.contentType} production-ready SEO comparison draft as JSON.`,
    `Prompt version: ${PRODUCTION_PROMPT_VERSION}.`,
    '',
    'Shared production rules:',
    JSON.stringify(contentRules.shared, null, 2),
    '',
    'Compare production rules:',
    JSON.stringify(contentRules.compare, null, 2),
    '',
    'Non-negotiable validation targets:',
    `- ${PRODUCTION_LIMITS.compare.minWords}-${PRODUCTION_LIMITS.compare.maxWords} English editorial words`,
    `- ${PRODUCTION_LIMITS.compare.minBlocks}-${PRODUCTION_LIMITS.compare.maxBlocks} body blocks`,
    `- at least ${PRODUCTION_LIMITS.compare.minMatrixRows} matrix rows`,
    `- at least ${PRODUCTION_LIMITS.compare.minCriteria} meaningful criteria`,
    `- at least ${PRODUCTION_LIMITS.compare.minFaqItems} FAQ items`,
    `- each section >= ${PRODUCTION_LIMITS.compare.minSectionWords} words`,
    `- each FAQ answer >= ${PRODUCTION_LIMITS.compare.minFaqAnswerWords} words`,
    `- verdict >= ${PRODUCTION_LIMITS.compare.minVerdictWords} words and scenario-specific`,
    '- contentPage.status = REVIEW and robots = NOINDEX_FOLLOW',
    '- comparisonPage.matrixJson must be an array of rows or an object containing a rows array',
    '- comparisonPage.criteriaJson must be an array or an object containing a criteria array',
    '',
    'Block shape reference:',
    JSON.stringify(contentRules.compare.blockSchemas, null, 2),
    '',
    'Required output shape:',
    JSON.stringify({
      contentPage: {
        type: sourceData.contentType,
        slug: sourceData.slug,
        canonicalPath: sourceData.canonicalPath,
        title: 'string',
        metaTitle: 'string',
        metaDescription: 'string',
        summary: 'string',
        robots: 'NOINDEX_FOLLOW',
        status: 'REVIEW',
      },
      bodyJson: { version: 1, blocks: [] },
      comparisonPage: sourceData.contentType === 'COMPARISON'
        ? {
            comparisonType: sourceData.comparisonType,
            primaryToolId: sourceData.primaryTool?.id || null,
            secondaryToolId: sourceData.secondaryTool?.id || null,
            verdict: 'specific 80+ word verdict',
            criteriaJson: [{ name: 'criterion', analysis: 'meaningful analysis' }],
            matrixJson: [{ criterion: 'row label', primary: 'grounded value', secondary: 'grounded value' }],
          }
        : null,
      comparisonTools: sourceData.contentType === 'COMPARISON'
        ? [{ toolId: sourceData.primaryTool?.id || 0, sort: 1 }]
        : [],
      alternativePage: sourceData.contentType === 'ALTERNATIVE'
        ? {
            primaryToolId: sourceData.primaryTool?.id || 0,
            reasonToSwitch: 'specific explanation',
            selectionCriteriaJson: [{ name: 'criterion', description: 'meaningful criterion' }],
            matrixJson: [{ criterion: 'row label', primary: 'current tool', alternative: 'alternative option' }],
          }
        : null,
      alternativeTools: sourceData.contentType === 'ALTERNATIVE'
        ? [{ toolId: sourceData.secondaryTool?.id || 0, rank: 1, reason: 'grounded reason' }]
        : [],
      sources: 'copy sourceData.sources exactly',
    }, null, 2),
    '',
    'Source data:',
    JSON.stringify(source, null, 2),
    '',
    'Return strict JSON only. The first character must be { and the last character must be }.',
  ].join('\n')
}

export function applyPromptTemplate(template, sourcePrompt, sourceData) {
  const value = String(template || '').trim()
  if (!value || value === '{{SOURCE_PROMPT}}') return sourcePrompt
  if (value.includes('{{SOURCE_PROMPT}}')) {
    return value
      .replaceAll('{{SOURCE_PROMPT}}', sourcePrompt)
      .replaceAll('{{SOURCE_DATA_JSON}}', JSON.stringify(sourceData, null, 2))
  }
  return [
    sourcePrompt,
    '',
    'Prompt-version-specific additional instructions:',
    value.replaceAll('{{SOURCE_DATA_JSON}}', JSON.stringify(sourceData, null, 2)),
  ].join('\n')
}

export function buildExpandFixPrompt(originalPrompt, rawOutput, validation) {
  const fixableChecks = Object.entries(validation?.checks || {})
    .filter(([, check]) => check && check.passed === false && check.expandable !== false)
    .map(([name, check]) => ({ name, actual: check.actual, expected: check.expected }))

  return [
    originalPrompt,
    '',
    'EXPAND/FIX PASS:',
    'The previous JSON was structurally parseable but failed production depth checks.',
    'Return one complete replacement JSON object. Preserve identifiers, source grounding, output shape, REVIEW status, and NOINDEX_FOLLOW.',
    'Expand the existing content; do not summarize it, delete valid sections, reduce detail, or switch to a shorter prompt.',
    'Fix these checks:',
    JSON.stringify(fixableChecks, null, 2),
    '',
    'Previous JSON:',
    rawOutput,
  ].join('\n')
}
