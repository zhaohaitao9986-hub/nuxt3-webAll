import {
  FAQ_MIN_ITEMS,
  FORBIDDEN_CLAIM_LABELS,
  META_LIMITS,
  QUALITATIVE_PRICING_POLICY,
  contentRules,
} from './editorialRules'

export const editorialSystemPrompt = [
  'You are an editorial content generation engine for AISeekTools.',
  'You produce structured JSON for Nuxt and Prisma-backed content pages.',
  'You must be factual, conservative, and source-grounded.',
  'You must return exactly one valid JSON object and no surrounding text.',
  'If source data is insufficient for a claim, omit the claim or qualify it clearly.',
  `Never use forbidden phrases: ${FORBIDDEN_CLAIM_LABELS.join(', ')}.`,
  QUALITATIVE_PRICING_POLICY,
  'Generated content must enter human review and must not be published directly.',
].join('\n')

function compactTool(tool) {
  return {
    id: tool.id,
    handle: tool.handle,
    name: tool.name,
    description: tool.description,
    website: tool.website,
    pricing: tool.pricing || [],
    hasPricingPlans: Boolean(tool.pricingPlans?.length),
    hasClaims: Boolean(tool.claims?.length),
    pros: tool.pros || [],
    cons: tool.cons || [],
    features: tool.features || [],
    rating: tool.rating,
    monthlyVisits: tool.monthlyVisits,
    platforms: tool.platforms || [],
    tags: tool.tags || [],
    useCases: tool.useCases || [],
  }
}

function compactGuideSource(sourceData) {
  return {
    ...sourceData,
    primaryTool: sourceData.primaryTool ? compactTool(sourceData.primaryTool) : null,
    topTools: (sourceData.topTools || []).map(compactTool),
    tools: (sourceData.tools || []).map(compactTool),
  }
}

function compactCompareSource(sourceData) {
  return {
    ...sourceData,
    primaryTool: sourceData.primaryTool ? compactTool(sourceData.primaryTool) : null,
    secondaryTool: sourceData.secondaryTool ? compactTool(sourceData.secondaryTool) : null,
    tools: (sourceData.tools || []).map(compactTool),
    categoryTopTools: (sourceData.categoryTopTools || []).map(compactTool),
  }
}

const guideOutputShapeExample = {
  contentPage: {
    type: 'BUYER_GUIDE',
    slug: 'example-slug',
    canonicalPath: '/guides/example-slug',
    title: 'string',
    metaTitle: 'string (<=65 chars)',
    metaDescription: 'string (<=180 chars)',
    summary: 'string',
    robots: 'INDEX_FOLLOW',
    status: 'REVIEW',
  },
  bodyJson: {
    version: 1,
    meta: { intent: 'choose_tools', level2Id: 0, readingMinutes: 12 },
    tools: ['tool-handle-a', 'tool-handle-b'],
    blocks: [
      { type: 'key_takeaways', items: ['...'] },
      { type: 'problem_frame', text: '...' },
      { type: 'section', heading: 'Quick answer', level: 2, html: '<p>...</p>' },
      { type: 'framework', criteria: [{ name: 'Ease of use', weight: 1, description: '...' }] },
      { type: 'section', heading: 'Workflow', level: 2, html: '<p>...</p>' },
      { type: 'tool_callout', toolHandle: 'tool-handle-a', verdict: '...' },
      { type: 'methodology', text: '...' },
      { type: 'faq', items: [{ question: '...', answer: '...' }] },
    ],
  },
  tutorialPage: null,
  categoryContentPage: null,
  sources: [],
}

export function buildContentPrompt(sourceData) {
  if (sourceData.task === 'generate_compare') {
    return buildCompareUserPrompt(sourceData)
  }
  return buildGuideUserPrompt(sourceData)
}

export function buildGuideUserPrompt(sourceData) {
  const compactSource = compactGuideSource(sourceData)
  return [
    `Generate a ${sourceData.contentType} page JSON using the provided source data.`,
    '',
    'Rules:',
    JSON.stringify(contentRules.shared, null, 2),
    JSON.stringify(contentRules.guides, null, 2),
    '',
    'Validation checklist (must pass automated checks):',
    `- metaTitle <= ${META_LIMITS.metaTitleMax} chars, metaDescription <= ${META_LIMITS.metaDescriptionMax} chars`,
    '- contentPage.status must be REVIEW',
    '- bodyJson.blocks length >= 6 with types: key_takeaways, problem_frame, framework, section, methodology, faq',
    '- At least one section heading contains "Quick answer" (skip for TUTORIAL only)',
    '- At least one section heading contains "Workflow" (skip for TUTORIAL only)',
    `- faq block has at least ${FAQ_MIN_ITEMS} items`,
    '- tool_callout.toolHandle and bodyJson.tools must only use handles from source tools',
    `- Forbidden words: ${FORBIDDEN_CLAIM_LABELS.join(', ')}`,
    `- Pricing: ${QUALITATIVE_PRICING_POLICY}`,
    '- Per tool: if hasPricingPlans is false, no plan/credit/seat/trial specifics; if hasClaims is false, no integration/language-count/feature assertions unless in other tool fields',
    '- metaTitle/metaDescription: no tool names (category-level wording only)',
    '- FAQ: no "best/top/#1" ranking questions; use evaluation-style questions',
    '',
    'Block shape reference:',
    JSON.stringify(contentRules.guides.blockSchemas, null, 2),
    '',
    'Required top-level output shape:',
    JSON.stringify(
      {
        ...guideOutputShapeExample,
        contentPage: {
          ...guideOutputShapeExample.contentPage,
          type: sourceData.contentType,
          slug: sourceData.slug,
          canonicalPath: sourceData.canonicalPath,
          status: 'REVIEW',
        },
        tutorialPage: sourceData.contentType === 'TUTORIAL'
          ? { difficulty: 'BEGINNER', prerequisites: [], stepsJson: {}, outcome: 'string' }
          : null,
        categoryContentPage:
          sourceData.contentType === 'CATEGORY_GUIDE' || sourceData.contentType === 'BUYER_GUIDE'
            ? { level1Id: sourceData.category?.level1?.id ?? null, level2Id: sourceData.category?.level2?.id ?? null }
            : null,
        sources: 'copy from sourceData.sources when present; never claim sourcing with an empty sources array',
      },
      null,
      2,
    ),
    '',
    'Source data (compact):',
    JSON.stringify(compactSource, null, 2),
  ].join('\n')
}

export function buildCompareUserPrompt(sourceData) {
  const compactSource = compactCompareSource(sourceData)
  return [
    `Generate a ${sourceData.contentType} compare page JSON using the provided source data.`,
    '',
    'Rules:',
    JSON.stringify(contentRules.shared, null, 2),
    JSON.stringify(contentRules.compare, null, 2),
    '',
    'Validation checklist:',
    `- metaTitle <= ${META_LIMITS.metaTitleMax}, metaDescription <= ${META_LIMITS.metaDescriptionMax}`,
    '- contentPage.status must be REVIEW',
    `- faq block with >= ${FAQ_MIN_ITEMS} items`,
    '- comparisonTools / alternativeTools toolId values must exist in source',
    `- Forbidden words: ${FORBIDDEN_CLAIM_LABELS.join(', ')}`,
    `- Pricing: ${QUALITATIVE_PRICING_POLICY}`,
    '',
    'Block shape reference:',
    JSON.stringify(contentRules.compare.blockSchemas, null, 2),
    '',
    'Required top-level output shape:',
    JSON.stringify(
      {
        contentPage: {
          type: sourceData.contentType,
          slug: sourceData.slug,
          canonicalPath: sourceData.canonicalPath,
          title: 'string',
          metaTitle: 'string',
          metaDescription: 'string',
          summary: 'string',
          robots: 'INDEX_FOLLOW',
          status: 'REVIEW',
        },
        bodyJson: { version: 1, blocks: [] },
        comparisonPage: sourceData.contentType === 'COMPARISON'
          ? { comparisonType: sourceData.comparisonType, verdict: 'string', criteriaJson: {}, matrixJson: {} }
          : null,
        comparisonTools: [],
        alternativePage: sourceData.contentType === 'ALTERNATIVE'
          ? { primaryToolId: sourceData.primaryTool?.id || 0, reasonToSwitch: 'string', selectionCriteriaJson: {} }
          : null,
        alternativeTools: [],
        sources: [],
      },
      null,
      2,
    ),
    '',
    'Source data (compact):',
    JSON.stringify(compactSource, null, 2),
  ].join('\n')
}
