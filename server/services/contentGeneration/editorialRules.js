export const META_LIMITS = {
  metaTitleMax: 65,
  metaDescriptionMax: 180,
}

export const FAQ_MIN_ITEMS = 3
export const BODY_BLOCK_MIN_COUNT = 6

export const FORBIDDEN_CLAIM_LABELS = [
  'guaranteed',
  'best',
  '#1',
  'perfect',
  'risk-free',
  'always',
  'never',
]

export const FORBIDDEN_CLAIM_PATTERNS = FORBIDDEN_CLAIM_LABELS.map((label) => ({
  label,
  pattern: new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
}))

export const QUALITATIVE_PRICING_POLICY = [
  'Use qualitative pricing language only.',
  'Do not invent dollar amounts, plan names, seat limits, credits, trials, or usage limits.',
  'Only mention pricing specifics when they appear in source data.',
].join(' ')

export const GUIDE_REQUIRED_BLOCK_TYPES = [
  'key_takeaways',
  'problem_frame',
  'framework',
  'section',
  'methodology',
  'faq',
]

export const COMPARE_REQUIRED_BLOCK_TYPES = [
  'choose_if',
  'scenarios',
  'section',
  'methodology',
  'faq',
]

export const GUIDE_BLOCK_SCHEMA_HINT = {
  key_takeaways: { type: 'key_takeaways', items: ['string'] },
  problem_frame: { type: 'problem_frame', text: 'string' },
  framework: { type: 'framework', criteria: [{ name: 'string', weight: 1, description: 'string' }] },
  section: { type: 'section', heading: 'string', level: 2, html: '<p>string</p>' },
  tool_callout: { type: 'tool_callout', toolHandle: 'tool-handle', verdict: 'string' },
  methodology: { type: 'methodology', text: 'string' },
  faq: { type: 'faq', items: [{ question: 'string', answer: 'string' }] },
}

export const COMPARE_BLOCK_SCHEMA_HINT = {
  choose_if: { type: 'choose_if', primary: ['string'], secondary: ['string'] },
  scenarios: { type: 'scenarios', items: [{ title: 'string', text: 'string' }] },
  section: { type: 'section', heading: 'string', level: 2, html: '<p>string</p>' },
  methodology: { type: 'methodology', text: 'string' },
  faq: { type: 'faq', items: [{ question: 'string', answer: 'string' }] },
}

export const contentRules = {
  shared: {
    language: 'Write in clear, concise English for buyers evaluating AI tools.',
    factuality: [
      'Use only facts present in source data.',
      'Do not invent pricing, features, rankings, company details, integrations, or usage limits.',
      QUALITATIVE_PRICING_POLICY,
      'Use cautious wording when source data is incomplete.',
    ],
    output: [
      'Return valid JSON only.',
      'Do not wrap JSON in Markdown fences.',
      'Use bodyJson.blocks as the main content array.',
      'The generated status must be REVIEW.',
    ],
    seo: [
      `Keep metaTitle <= ${META_LIMITS.metaTitleMax} characters.`,
      `Keep metaDescription <= ${META_LIMITS.metaDescriptionMax} characters.`,
      'Keep summary distinct from metaDescription.',
    ],
    safety: [
      'Do not include scripts, iframes, inline event handlers, or unsafe HTML.',
      'Do not make legal, medical, financial, or guaranteed-performance claims.',
    ],
    forbiddenPhrases: [
      `Do not use: ${FORBIDDEN_CLAIM_LABELS.join(', ')}.`,
      'Prefer cautious wording: may, can, typically, depends on, varies by, often.',
    ],
  },
  guides: {
    allowedTypes: ['BUYER_GUIDE', 'CATEGORY_GUIDE', 'TUTORIAL'],
    routePrefix: '/guides/',
    supportedBlockTypes: Object.keys(GUIDE_BLOCK_SCHEMA_HINT),
    blockSchemas: GUIDE_BLOCK_SCHEMA_HINT,
    requirements: [
      `Include at least ${BODY_BLOCK_MIN_COUNT} bodyJson.blocks.`,
      `Include required block types: ${GUIDE_REQUIRED_BLOCK_TYPES.join(', ')}.`,
      `Include at least ${FAQ_MIN_ITEMS} FAQ items.`,
      'Use only tool handles from sourceData.tools.',
      'For BUYER_GUIDE and CATEGORY_GUIDE, include categoryContentPage.',
      'For TUTORIAL, include tutorialPage with stepsJson.',
    ],
  },
  compare: {
    allowedTypes: ['COMPARISON', 'ALTERNATIVE'],
    routePrefix: '/compare/',
    supportedComparisonTypes: ['TOOL_VS_TOOL', 'MULTI_TOOL', 'TOOL_VS_CATEGORY', 'ALTERNATIVES'],
    supportedBlockTypes: Object.keys(COMPARE_BLOCK_SCHEMA_HINT),
    blockSchemas: COMPARE_BLOCK_SCHEMA_HINT,
    requirements: [
      `Include required block types: ${COMPARE_REQUIRED_BLOCK_TYPES.join(', ')}.`,
      `Include at least ${FAQ_MIN_ITEMS} FAQ items.`,
      'Every compared or alternative tool id must exist in source data.',
      'Pricing comparisons must be qualitative only.',
    ],
  },
}
