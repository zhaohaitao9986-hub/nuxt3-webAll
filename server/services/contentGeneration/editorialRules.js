export const PRODUCTION_PROMPT_VERSION = 2

export const META_LIMITS = {
  metaTitleMax: 65,
  metaDescriptionMax: 180,
}

export const PRODUCTION_LIMITS = {
  guide: {
    minWords: 1800,
    maxWords: 3000,
    minBlocks: 10,
    maxBlocks: 16,
    minFaqItems: 5,
    minRecommendedTools: 5,
    minSectionWords: 120,
    minFaqAnswerWords: 60,
    minToolNoteWords: 80,
    minCriteria: 6,
  },
  compare: {
    minWords: 1500,
    maxWords: 2500,
    minBlocks: 10,
    maxBlocks: 16,
    minFaqItems: 5,
    minMatrixRows: 8,
    minCriteria: 6,
    minSectionWords: 120,
    minFaqAnswerWords: 60,
    minVerdictWords: 80,
  },
}

export const FORBIDDEN_CLAIM_LABELS = [
  'guarantee',
  'guaranteed',
  'perfect',
  'best overall',
  '#1',
  'top ranked',
]

export const FORBIDDEN_CLAIM_PATTERNS = [
  { label: 'guarantee', pattern: /\bguarantee(?:d|s)?\b/i },
  { label: 'perfect', pattern: /\bperfect\b/i },
  { label: 'best overall', pattern: /\bbest\s+overall\b/i },
  { label: '#1', pattern: /#\s*1\b/i },
  { label: 'top ranked', pattern: /\btop\s+ranked\b/i },
]

export const FAQ_RANKING_QUESTION_PATTERN
  = /^\s*(?:what|which|who)\b[\s\S]{0,160}\b(?:best|top\s*\d*|#\s*1|number\s*one|ranked\s*#?\s*1)\b/i

export const QUALITATIVE_PRICING_POLICY = [
  'Do not write dollar amounts, numeric per-month prices, or "starts at" prices.',
  'Use qualitative wording such as free tier, trial, paid tiers, monthly or annual billing, and limits vary by plan.',
  'Only mention plan names, billing details, credits, seats, trials, or usage limits when present in that tool source.',
  'Direct readers to the official pricing source for current details.',
].join(' ')

export const GUIDE_REQUIRED_BLOCK_TYPES = [
  'key_takeaways',
  'problem_frame',
  'framework',
  'section',
  'tool_callout',
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

export const GUIDE_REQUIRED_TOPICS = [
  { key: 'introduction', pattern: /introduction|overview|why this guide/i },
  { key: 'whoItIsFor', pattern: /who (?:this|it) is for|intended audience|who should use/i },
  { key: 'howToChoose', pattern: /how to choose|choosing the right|selection process/i },
  { key: 'keyCriteria', pattern: /key criteria|evaluation criteria|what to look for/i },
  { key: 'recommendedTools', pattern: /recommended tools|tools to consider|tool recommendations/i },
  { key: 'workflow', pattern: /workflow|implementation steps|getting started/i },
  { key: 'useCases', pattern: /use cases|common scenarios|when to use/i },
  { key: 'commonMistakes', pattern: /common mistakes|pitfalls|what to avoid/i },
  { key: 'decisionGuidance', pattern: /decision guidance|decision framework|decision tree|how to decide/i },
  { key: 'finalRecommendation', pattern: /final recommendation|final guidance|bottom line/i },
]

export const COMPARE_REQUIRED_TOPICS = [
  { key: 'overview', pattern: /overview|at a glance/i },
  { key: 'quickVerdict', pattern: /quick verdict|short verdict/i },
  { key: 'featureMatrix', pattern: /feature comparison matrix|comparison matrix|feature matrix/i },
  { key: 'criteriaAnalysis', pattern: /criteria analysis|evaluation criteria|how we compare/i },
  { key: 'bestForPrimary', pattern: /best for tool a|best for the first tool|who should choose the first|choose .+ if/i },
  { key: 'bestForSecondary', pattern: /best for tool b|best for the second tool|who should choose the second|choose .+ when/i },
  { key: 'pricingComparison', pattern: /pricing comparison|plans and pricing|cost comparison/i },
  { key: 'prosCons', pattern: /pros and cons|strengths and limitations|trade-offs/i },
  { key: 'useCases', pattern: /use-case scenarios|use cases|scenario comparison/i },
  { key: 'alternatives', pattern: /alternatives|other tools to consider/i },
  { key: 'finalRecommendation', pattern: /final recommendation|final verdict|bottom line/i },
]

export const GUIDE_BLOCK_SCHEMA_HINT = {
  key_takeaways: { type: 'key_takeaways', items: ['string bullet'] },
  problem_frame: { type: 'problem_frame', text: 'substantive string' },
  framework: {
    type: 'framework',
    criteria: [{ name: 'string', weight: 1, description: 'substantive string' }],
  },
  section: { type: 'section', heading: 'required topic heading', level: 2, html: '<p>120+ English words</p>' },
  tool_callout: {
    type: 'tool_callout',
    toolHandle: 'handle from source only',
    verdict: '80+ English words grounded only in that tool source',
  },
  decision_tree: {
    type: 'decision_tree',
    branches: [{ if: 'buyer condition', then: 'decision guidance', toolHandles: ['source handle'] }],
  },
  methodology: { type: 'methodology', text: 'source-grounded methodology' },
  faq: { type: 'faq', items: [{ question: 'evaluation question', answer: '60+ English words' }] },
}

export const COMPARE_BLOCK_SCHEMA_HINT = {
  choose_if: { type: 'choose_if', primary: ['specific reason'], secondary: ['specific reason'] },
  scenarios: {
    type: 'scenarios',
    items: [{ title: 'use case', winner: 'primary|secondary|tie', text: 'grounded explanation' }],
  },
  section: { type: 'section', heading: 'required topic heading', level: 2, html: '<p>120+ English words</p>' },
  methodology: { type: 'methodology', text: 'source-grounded methodology' },
  faq: { type: 'faq', items: [{ question: 'evaluation question', answer: '60+ English words' }] },
}

export const sharedContentRules = {
  language: 'Write clear, specific English for buyers evaluating AI tools.',
  quality: [
    'Produce a production-ready SEO draft for human review, never a test stub, outline, or abbreviated sample.',
    'Cover search intent completely and add decision-useful information rather than repeating generic descriptions.',
    'Use concrete distinctions, trade-offs, workflows, use cases, and buyer guidance grounded in source data.',
    'Keep summary distinct from metaDescription and avoid keyword stuffing.',
  ],
  factuality: [
    'Use only facts present in source data or its listed sources.',
    'Do not invent pricing, features, rankings, company details, integrations, language counts, limits, or test results.',
    QUALITATIVE_PRICING_POLICY,
    'Use cautious wording when source data is incomplete or may be stale.',
    'Never claim hands-on testing unless source data explicitly contains internal testing evidence.',
  ],
  output: [
    'Return exactly one valid JSON object with no Markdown fences or surrounding explanation.',
    'Use only supported enum values and block types.',
    'Use bodyJson.blocks as the main content array.',
    'Set contentPage.status to REVIEW and contentPage.robots to NOINDEX_FOLLOW.',
    'Copy sourceData.sources into top-level sources when present.',
  ],
  seo: [
    `Keep metaTitle at or under ${META_LIMITS.metaTitleMax} characters.`,
    `Keep metaDescription at or under ${META_LIMITS.metaDescriptionMax} characters.`,
    'Match the primary search intent in title, summary, introduction, headings, and final recommendation naturally.',
    'Use descriptive H2 headings and provide enough topical coverage for a production SEO draft.',
    'Keep canonicalPath identical to the requested route.',
  ],
  safety: [
    'Do not include script, iframe, inline event handlers, or unsafe HTML.',
    'Do not make legal, medical, financial, or guaranteed-performance claims.',
  ],
  forbiddenPhrases: [
    `Do not use unsupported absolute claims: ${FORBIDDEN_CLAIM_LABELS.join(', ')}.`,
    'Prefer may, can, typically, depends on, varies by, often, suitable for, or right fit.',
  ],
}

export const guideContentRules = {
  allowedTypes: ['BUYER_GUIDE', 'CATEGORY_GUIDE', 'TUTORIAL'],
  routePrefix: '/guides/',
  supportedBlockTypes: Object.keys(GUIDE_BLOCK_SCHEMA_HINT),
  blockSchemas: GUIDE_BLOCK_SCHEMA_HINT,
  depth: PRODUCTION_LIMITS.guide,
  requirements: [
    'Write 1,800-3,000 English editorial words.',
    'Create 10-16 bodyJson.blocks and include every required guide block type.',
    'Cover Introduction, Who it is for, How to choose, Key criteria, Recommended tools, Workflow or implementation steps, Use cases, Common mistakes, Decision guidance, Final recommendation, FAQ, and Methodology.',
    'Include at least 6 meaningful framework criteria.',
    'Recommend at least 5 source tools using distinct tool_callout blocks; each verdict must be at least 80 words.',
    'Each normal section must contain at least 120 words and each FAQ answer at least 60 words.',
    'Include at least 5 evaluation-style FAQ items.',
    'Set bodyJson.meta.intent from source intent and bodyJson.meta.level2Id from source category when available.',
    'Set bodyJson.tools using source handles only.',
    'For BUYER_GUIDE and CATEGORY_GUIDE include categoryContentPage with source level1Id and level2Id.',
    'For TUTORIAL include tutorialPage with difficulty, outcome, prerequisites, and meaningful stepsJson.',
    'Do not name individual tools in guide metaTitle or metaDescription.',
    'Do not attach one tool feature, claim, plan, or integration to another tool.',
    'Methodology must describe source review honestly and must not imply hands-on testing.',
  ],
}

export const compareContentRules = {
  allowedTypes: ['COMPARISON', 'ALTERNATIVE'],
  routePrefix: '/compare/',
  supportedComparisonTypes: ['TOOL_VS_TOOL', 'MULTI_TOOL', 'TOOL_VS_CATEGORY', 'ALTERNATIVES'],
  supportedBlockTypes: Object.keys(COMPARE_BLOCK_SCHEMA_HINT),
  blockSchemas: COMPARE_BLOCK_SCHEMA_HINT,
  depth: PRODUCTION_LIMITS.compare,
  requirements: [
    'Write 1,500-2,500 English editorial words.',
    'Create 10-16 bodyJson.blocks and include every required compare block type.',
    'Cover Overview, Quick verdict, Feature comparison matrix, Criteria analysis, buyer fit for each primary tool, Pricing comparison, Pros and cons, Use-case scenarios, Alternatives, Final recommendation, FAQ, and Methodology.',
    'comparisonPage.criteriaJson must contain at least 6 meaningful criteria.',
    'comparisonPage.matrixJson must contain at least 8 substantive comparison rows.',
    'comparisonPage.verdict must be specific and at least 80 words.',
    'Each normal section must contain at least 120 words and each FAQ answer at least 60 words.',
    'Include at least 5 FAQ items.',
    'Include comparisonTools or alternativeTools using source tool IDs only.',
    'Use requiredCriteria from source and analyze meaningful trade-offs rather than declaring an unsupported universal winner.',
    'Pricing comparisons must be qualitative and grounded in each tool pricing context.',
  ],
}

export const contentRules = {
  shared: sharedContentRules,
  guides: guideContentRules,
  compare: compareContentRules,
}
