export const COMMON_CONTENT_PAGE_FIELDS = [
  'type',
  'slug',
  'canonicalPath',
  'title',
  'metaTitle',
  'metaDescription',
  'summary',
  'robots',
  'status',
]

export const GUIDE_RESPONSE_SHAPE = {
  requiredTopLevel: ['contentPage', 'bodyJson', 'sources'],
  contentPageFields: COMMON_CONTENT_PAGE_FIELDS,
  typedFields: ['tutorialPage', 'categoryContentPage'],
  example: {
    contentPage: {
      type: 'BUYER_GUIDE',
      slug: 'requested-slug',
      canonicalPath: '/guides/requested-slug',
      title: 'string',
      metaTitle: 'string <= 65 chars',
      metaDescription: 'string <= 180 chars',
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
  },
}

export const COMPARE_RESPONSE_SHAPE = {
  requiredTopLevel: ['contentPage', 'bodyJson', 'comparisonPage', 'comparisonTools', 'sources'],
  contentPageFields: COMMON_CONTENT_PAGE_FIELDS,
  typedFields: ['comparisonPage', 'comparisonTools'],
  comparisonPageFields: [
    'comparisonType',
    'primaryToolId',
    'secondaryToolId',
    'verdict',
    'criteriaJson',
    'matrixJson',
  ],
  comparisonToolFields: ['toolId', 'position', 'label', 'bestFor', 'summary'],
  example: {
    contentPage: {
      type: 'COMPARISON',
      slug: 'tool-a-vs-tool-b',
      canonicalPath: '/compare/tool-a-vs-tool-b',
      title: 'string',
      metaTitle: 'string',
      metaDescription: 'string',
      summary: 'string',
      robots: 'NOINDEX_FOLLOW',
      status: 'REVIEW',
    },
    bodyJson: { version: 1, blocks: [] },
    comparisonPage: {
      comparisonType: 'TOOL_VS_TOOL',
      primaryToolId: 0,
      secondaryToolId: 0,
      verdict: 'specific 80+ word verdict',
      criteriaJson: [{ name: 'criterion', analysis: 'meaningful analysis' }],
      matrixJson: [{ criterion: 'row label', primary: 'grounded value', secondary: 'grounded value' }],
    },
    comparisonTools: [
      { toolId: 0, position: 1, label: 'Primary', bestFor: 'string', summary: 'string' },
      { toolId: 0, position: 2, label: 'Secondary', bestFor: 'string', summary: 'string' },
    ],
    sources: [],
  },
}

export const ALTERNATIVE_RESPONSE_SHAPE = {
  requiredTopLevel: ['contentPage', 'bodyJson', 'alternativePage', 'alternativeTools', 'sources'],
  contentPageFields: COMMON_CONTENT_PAGE_FIELDS,
  typedFields: ['alternativePage', 'alternativeTools'],
  alternativePageFields: ['primaryToolId', 'reasonToSwitch', 'selectionCriteriaJson'],
  alternativeToolFields: ['toolId', 'position', 'reason', 'bestFor', 'tradeoff'],
  example: {
    contentPage: {
      type: 'ALTERNATIVE',
      slug: 'tool-a-alternatives',
      canonicalPath: '/compare/tool-a-alternatives',
      title: 'string',
      metaTitle: 'string',
      metaDescription: 'string',
      summary: 'string',
      robots: 'NOINDEX_FOLLOW',
      status: 'REVIEW',
    },
    bodyJson: { version: 1, blocks: [] },
    alternativePage: {
      primaryToolId: 0,
      reasonToSwitch: 'specific explanation',
      selectionCriteriaJson: [{ name: 'criterion', description: 'meaningful criterion' }],
    },
    alternativeTools: [
      { toolId: 0, position: 1, reason: 'grounded reason', bestFor: 'string', tradeoff: 'string' },
    ],
    sources: [],
  },
}

export function responseShapeForContentType(contentType) {
  if (contentType === 'COMPARISON') return COMPARE_RESPONSE_SHAPE
  if (contentType === 'ALTERNATIVE') return ALTERNATIVE_RESPONSE_SHAPE
  if (['BUYER_GUIDE', 'CATEGORY_GUIDE', 'TUTORIAL'].includes(contentType)) return GUIDE_RESPONSE_SHAPE
  return null
}
