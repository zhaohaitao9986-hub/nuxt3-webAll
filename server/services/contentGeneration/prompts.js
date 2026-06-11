import {
  FORBIDDEN_CLAIM_LABELS,
  META_LIMITS,
  PRODUCTION_LIMITS,
  PRODUCTION_PROMPT_VERSION,
  QUALITATIVE_PRICING_POLICY,
  contentRules,
} from './editorialRules.js'
import {
  ALTERNATIVE_RESPONSE_SHAPE,
  COMPARE_RESPONSE_SHAPE,
  GUIDE_RESPONSE_SHAPE,
} from './responseSchemas.js'

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

const TASK_INSTRUCTIONS = {
  BUYER_GUIDE: [
    'Help the stated audience choose among selectedTools using the supplied decisionCriteria.',
    'Recommend only selectedTools and ground every recommendation in the matching toolFacts entry.',
  ],
  CATEGORY_GUIDE: [
    'Explain the category using categoryContext as the primary evidence.',
    'Use representativeTools only as concise examples; do not turn the page into a ranked buyer list.',
    'Tool callouts are optional and must not be forced to five items.',
  ],
  TUTORIAL: [
    'Teach the exact tutorialGoal using the supplied workflowContext in order.',
    'Do not invent product steps or substitute generic category guidance.',
    'The primaryTool is the workflow anchor; relatedTools are optional supporting references, not recommendations.',
  ],
  COMPARISON: [
    'Compare exactly primaryTool and secondaryTool for comparisonIntent and targetAudience.',
    'Do not introduce other tools as comparison subjects.',
  ],
  ALTERNATIVE: [
    'Explain alternatives to primaryTool for the supplied reasonToSwitch.',
    'Recommend only alternativeTools and use selectionCriteria and comparisonDimensions for trade-offs.',
    'Do not model the first alternative as a secondaryTool.',
  ],
}

function guideRulesFor(contentType) {
  if (contentType === 'BUYER_GUIDE') return contentRules.guides
  return {
    ...contentRules.guides,
    requirements: contentRules.guides.requirements.filter(rule => !/Recommend at least 5|tool_callout|How to choose|Recommended tools/i.test(rule)),
  }
}

export function buildContentPrompt(sourceData) {
  return sourceData.task === 'generate_compare'
    ? buildCompareUserPrompt(sourceData)
    : buildGuideUserPrompt(sourceData)
}

export function buildGuideUserPrompt(sourceData) {
  const source = sourceData.aiInput
  const requiresRecommendations = sourceData.contentType === 'BUYER_GUIDE'
  return [
    `Generate a ${sourceData.contentType} production-ready SEO draft as JSON.`,
    `Prompt version: ${PRODUCTION_PROMPT_VERSION}.`,
    '',
    'Shared production rules:',
    JSON.stringify(contentRules.shared, null, 2),
    '',
    'Guide production rules:',
    JSON.stringify(guideRulesFor(sourceData.contentType), null, 2),
    '',
    'Content-type task instructions:',
    JSON.stringify(TASK_INSTRUCTIONS[sourceData.contentType], null, 2),
    '',
    'Non-negotiable validation targets:',
    `- ${PRODUCTION_LIMITS.guide.minWords}-${PRODUCTION_LIMITS.guide.maxWords} English editorial words`,
    `- ${PRODUCTION_LIMITS.guide.minBlocks}-${PRODUCTION_LIMITS.guide.maxBlocks} body blocks`,
    requiresRecommendations
      ? `- at least ${PRODUCTION_LIMITS.guide.minRecommendedTools} distinct tool_callout recommendations`
      : '- tool_callout blocks are optional; do not manufacture recommendations to meet a buyer-guide quota',
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
      ...GUIDE_RESPONSE_SHAPE.example,
      contentPage: {
        ...GUIDE_RESPONSE_SHAPE.example.contentPage,
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
    'Validated AI input contract:',
    JSON.stringify(source, null, 2),
    '',
    'Return strict JSON only. The first character must be { and the last character must be }.',
  ].join('\n')
}

export function buildCompareUserPrompt(sourceData) {
  const source = sourceData.aiInput
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
    'Content-type task instructions:',
    JSON.stringify(TASK_INSTRUCTIONS[sourceData.contentType], null, 2),
    '',
    'Non-negotiable validation targets:',
    `- ${PRODUCTION_LIMITS.compare.minWords}-${PRODUCTION_LIMITS.compare.maxWords} English editorial words`,
    `- ${PRODUCTION_LIMITS.compare.minBlocks}-${PRODUCTION_LIMITS.compare.maxBlocks} body blocks`,
    sourceData.contentType === 'COMPARISON'
      ? `- at least ${PRODUCTION_LIMITS.compare.minMatrixRows} matrix rows`
      : '- include at least one grounded alternative tool distinct from the primary tool',
    `- at least ${PRODUCTION_LIMITS.compare.minCriteria} meaningful criteria`,
    `- at least ${PRODUCTION_LIMITS.compare.minFaqItems} FAQ items`,
    `- each section >= ${PRODUCTION_LIMITS.compare.minSectionWords} words`,
    `- each FAQ answer >= ${PRODUCTION_LIMITS.compare.minFaqAnswerWords} words`,
    `- verdict >= ${PRODUCTION_LIMITS.compare.minVerdictWords} words and scenario-specific`,
    '- contentPage.status = REVIEW and robots = NOINDEX_FOLLOW',
    sourceData.contentType === 'COMPARISON'
      ? '- comparisonPage.matrixJson must be an array of rows or an object containing a rows array'
      : '- alternativePage.selectionCriteriaJson must be an array or an object containing a criteria array',
    '',
    'Block shape reference:',
    JSON.stringify(contentRules.compare.blockSchemas, null, 2),
    '',
    'Required output shape:',
    JSON.stringify(buildCompareShapeExample(sourceData), null, 2),
    '',
    'Validated AI input contract:',
    JSON.stringify(source, null, 2),
    '',
    'Return strict JSON only. The first character must be { and the last character must be }.',
  ].join('\n')
}

function buildCompareShapeExample(sourceData) {
  const base = structuredClone(
    sourceData.contentType === 'ALTERNATIVE'
      ? ALTERNATIVE_RESPONSE_SHAPE.example
      : COMPARE_RESPONSE_SHAPE.example,
  )
  base.contentPage.type = sourceData.contentType
  base.contentPage.slug = sourceData.slug
  base.contentPage.canonicalPath = sourceData.canonicalPath
  if (base.comparisonPage) {
    base.comparisonPage.comparisonType = sourceData.comparisonType
    base.comparisonPage.primaryToolId = sourceData.primaryTool?.id || 0
    base.comparisonPage.secondaryToolId = sourceData.secondaryTool?.id || 0
    base.comparisonTools[0].toolId = sourceData.primaryTool?.id || 0
    base.comparisonTools[1].toolId = sourceData.secondaryTool?.id || 0
  }
  if (base.alternativePage) {
    base.alternativePage.primaryToolId = sourceData.primaryTool?.id || 0
    base.alternativeTools[0].toolId = sourceData.aiInput?.alternativeTools?.[0]?.id || 0
  }
  base.sources = 'copy sourceData.sources exactly'
  return base
}

export function applyPromptTemplate(template, sourcePrompt, sourceData) {
  const value = String(template || '').trim()
  const contractJson = JSON.stringify(sourceData.aiInput, null, 2)
  if (!value || value === '{{SOURCE_PROMPT}}') return sourcePrompt
  if (value.includes('{{SOURCE_PROMPT}}')) {
    return value
      .replaceAll('{{SOURCE_PROMPT}}', sourcePrompt)
      .replaceAll('{{SOURCE_DATA_JSON}}', contractJson)
      .replaceAll('{{INPUT_CONTRACT_JSON}}', contractJson)
  }
  return [
    sourcePrompt,
    '',
    'Prompt-version-specific additional instructions:',
    value
      .replaceAll('{{SOURCE_DATA_JSON}}', contractJson)
      .replaceAll('{{INPUT_CONTRACT_JSON}}', contractJson),
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
