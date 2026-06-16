export const GENERAL_COMPARE_CRITERIA_TEMPLATE_KEY = 'GENERAL_AI_TOOL'

export const compareCriteriaTemplates = [
  {
    key: 'AI_IMAGE_GENERATOR',
    keywords: ['image', 'art', 'illustration', 'photo', 'avatar', 'character', 'texture', 'design'],
    criteria: ['Image Quality', 'Prompt Accuracy', 'Style Consistency', 'Editing Tools', 'Generation Speed', 'Commercial Usage', 'Pricing', 'Ease of Use'],
  },
  {
    key: 'AI_WRITING',
    keywords: ['writing', 'grammar', 'paraphraser', 'rewriter', 'copywriting', 'text', 'essay', 'summarizer'],
    criteria: ['Writing Quality', 'Long-form Content Support', 'Templates', 'Grammar and Style Accuracy', 'Integrations', 'Collaboration', 'Pricing', 'Ease of Use'],
  },
  {
    key: 'AI_VIDEO',
    keywords: ['video', 'animation', 'avatar video', 'text to video'],
    criteria: ['Video Quality', 'Render Speed', 'Editing Features', 'Avatar and Voice Support', 'Template Library', 'Export Options', 'Pricing', 'Ease of Use'],
  },
  {
    key: 'AI_CODING',
    keywords: ['coding', 'developer', 'code', 'programming', 'no-code', 'app builder'],
    criteria: ['Code Quality', 'IDE Integration', 'Debugging Support', 'Framework Support', 'Collaboration', 'Security Controls', 'Pricing', 'Ease of Use'],
  },
  {
    key: 'AI_CHATBOT',
    keywords: ['chatbot', 'assistant', 'customer support', 'conversation'],
    criteria: ['Answer Quality', 'Context Handling', 'Workflow Automation', 'Integrations', 'Customization', 'Team Collaboration', 'Pricing', 'Ease of Use'],
  },
  {
    key: 'AI_SEO_MARKETING',
    keywords: ['seo', 'marketing', 'ads', 'social media', 'email marketing', 'content marketing'],
    criteria: ['Campaign Quality', 'SEO and Keyword Features', 'Content Templates', 'Analytics', 'Integrations', 'Automation', 'Pricing', 'Ease of Use'],
  },
  {
    key: 'AI_AUDIO',
    keywords: ['audio', 'voice', 'music', 'speech', 'transcription', 'text to speech'],
    criteria: ['Audio Quality', 'Voice Realism', 'Language Support', 'Editing Controls', 'Export Options', 'Commercial Usage', 'Pricing', 'Ease of Use'],
  },
  {
    key: 'AI_PRODUCTIVITY',
    keywords: ['productivity', 'meeting', 'notes', 'document', 'spreadsheet', 'presentation', 'workflow'],
    criteria: ['Workflow Fit', 'Automation Features', 'Collaboration', 'Integrations', 'Accuracy', 'Templates', 'Pricing', 'Ease of Use'],
  },
  {
    key: GENERAL_COMPARE_CRITERIA_TEMPLATE_KEY,
    keywords: [],
    criteria: ['Output Quality', 'Ease of Use', 'Feature Depth', 'Integrations', 'Customization', 'Pricing', 'Collaboration', 'Best-fit Use Cases'],
  },
]

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function wordCount(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length
}

function normalizedCriteria(criteria) {
  return (criteria || [])
    .map(value => String(value || '').trim())
    .filter(value => value && wordCount(value) <= 5)
    .slice(0, 8)
}

function categoryText(category) {
  return normalizeText([
    category?.handle,
    category?.name,
    category?.category?.handle,
    category?.category?.name,
  ].filter(Boolean).join(' '))
}

function matchTemplateForText(text) {
  const normalized = normalizeText(text)
  if (!normalized) return null
  return compareCriteriaTemplates
    .filter(template => template.key !== GENERAL_COMPARE_CRITERIA_TEMPLATE_KEY)
    .find(template => template.keywords.some(keyword => normalized.includes(normalizeText(keyword)))) || null
}

function selectedCategoryFrom(selection) {
  return selection?.selectedCategory || null
}

function candidateGroups(selection, context = {}) {
  const selectedCategory = selectedCategoryFrom(selection)
  return [
    {
      matchedBy: 'selectedCategory.handle',
      text: selectedCategory?.handle,
    },
    {
      matchedBy: 'selectedCategory.name',
      text: selectedCategory?.name,
    },
    {
      matchedBy: 'commonCategories',
      text: (selection?.commonCategories || []).map(categoryText).join(' '),
    },
    {
      matchedBy: 'primarySecondaryCategories',
      text: [
        ...(selection?.primaryCategories || []),
        ...(selection?.secondaryCategories || []),
      ].map(categoryText).join(' '),
    },
    {
      matchedBy: 'sharedUseCases',
      text: (context.sharedUseCases || []).join(' '),
    },
    {
      matchedBy: 'titleSlug',
      text: [context.title, context.slug].filter(Boolean).join(' '),
    },
  ]
}

export function resolveCompareCriteriaTemplate(selection, context = {}) {
  for (const group of candidateGroups(selection, context)) {
    const template = matchTemplateForText(group.text)
    if (template) {
      return {
        key: template.key,
        criteria: normalizedCriteria(template.criteria),
        matchedBy: group.matchedBy,
        fallbackUsed: false,
      }
    }
  }

  const fallback = compareCriteriaTemplates.find(template => template.key === GENERAL_COMPARE_CRITERIA_TEMPLATE_KEY)
  return {
    key: fallback.key,
    criteria: normalizedCriteria(fallback.criteria),
    matchedBy: 'fallback',
    fallbackUsed: true,
  }
}
