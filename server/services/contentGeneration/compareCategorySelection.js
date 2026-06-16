const GENERIC_CATEGORY_HANDLES = new Set([
  'ai-chatbot',
  'ai-assistant',
  'ai-productivity',
  'productivity',
  'workspace',
  'ai-workspace',
  'ai-tools',
])

const GENERIC_CATEGORY_PRIORITY = [
  'ai-chatbot',
  'ai-assistant',
  'ai-productivity',
  'productivity',
  'workspace',
  'ai-workspace',
  'ai-tools',
]

const LLM_CATEGORY_HANDLES = new Set([
  'large-language-models-llms',
])

const SPECIFIC_CATEGORY_HANDLES = new Set([
  'ai-writing-assistants',
  'ai-summarizer',
  'ai-paraphraser',
  'ai-grammar-checker',
  'ai-email-generator',
  'ai-image-generator',
  'ai-video-generator',
  'ai-code-assistant',
  'ai-seo',
  'ai-marketing',
  'ai-presentation',
  'ai-transcription',
  'ai-pdf',
  'ai-meeting-assistant',
  'ai-note-taker',
  'ai-research',
  'ai-design',
  'ai-social-media',
])

export function compareCategorySelectionTier(handle) {
  const normalized = String(handle || '').toLowerCase()
  if (GENERIC_CATEGORY_HANDLES.has(normalized)) return 1
  if (LLM_CATEGORY_HANDLES.has(normalized)) return 2
  if (SPECIFIC_CATEGORY_HANDLES.has(normalized)) return 3
  return 4
}

export function getCompareCategoryTierConfig() {
  return {
    tier1Generic: [...GENERIC_CATEGORY_PRIORITY],
    tier2Llm: [...LLM_CATEGORY_HANDLES],
    tier3SpecificSample: [...SPECIFIC_CATEGORY_HANDLES].slice(0, 8),
    aiCodeAssistantTier: compareCategorySelectionTier('ai-code-assistant'),
    aiChatbotTier: compareCategorySelectionTier('ai-chatbot'),
    aiAssistantTier: compareCategorySelectionTier('ai-assistant'),
  }
}

function categoryHandleFromRow(row, fallbackById, categoryId) {
  return String(
    row?.category?.handle
    || fallbackById.get(categoryId)?.category?.handle
    || '',
  ).toLowerCase()
}

function categoryNameFromRow(row, fallbackById, categoryId) {
  return String(
    row?.category?.name
    || fallbackById.get(categoryId)?.category?.name
    || '',
  )
}

function categoryToolCountFromRow(row, fallbackById, categoryId) {
  const raw = row?.category?.toolCount ?? fallbackById.get(categoryId)?.category?.toolCount ?? 0
  const count = Number(raw)
  return Number.isFinite(count) ? count : 0
}

function genericCategoryPriority(handle) {
  const normalized = String(handle || '').toLowerCase()
  const index = GENERIC_CATEGORY_PRIORITY.indexOf(normalized)
  return index >= 0 ? index : GENERIC_CATEGORY_PRIORITY.length
}

export function mapToolCategoriesForCompare(tool) {
  return (tool?.toolCategories || []).map(row => ({
    categoryId: Number(row.categoryId),
    handle: String(row.category?.handle || '').toLowerCase(),
    name: row.category?.name || '',
    toolCount: Number(row.category?.toolCount || 0),
    tier: compareCategorySelectionTier(row.category?.handle),
  }))
}

export function collectSharedCategories(primary, secondary) {
  const secondaryRows = secondary?.toolCategories || []
  const secondaryByCategoryId = new Map(
    secondaryRows.map(row => [Number(row.categoryId), row]),
  )
  const seen = new Set()
  const shared = []

  for (const row of primary?.toolCategories || []) {
    const categoryId = Number(row.categoryId)
    if (!categoryId || !secondaryByCategoryId.has(categoryId) || seen.has(categoryId)) continue
    seen.add(categoryId)
    const handle = categoryHandleFromRow(row, secondaryByCategoryId, categoryId)
    shared.push({
      categoryId,
      handle,
      name: categoryNameFromRow(row, secondaryByCategoryId, categoryId),
      toolCount: categoryToolCountFromRow(row, secondaryByCategoryId, categoryId),
      tier: compareCategorySelectionTier(handle),
    })
  }

  return shared
}

function compareSharedCategory(a, b) {
  const tierDiff = compareCategorySelectionTier(a.handle) - compareCategorySelectionTier(b.handle)
  if (tierDiff !== 0) return tierDiff

  if (compareCategorySelectionTier(a.handle) === 1) {
    const genericDiff = genericCategoryPriority(a.handle) - genericCategoryPriority(b.handle)
    if (genericDiff !== 0) return genericDiff
  }

  const toolCountDiff = (b.toolCount || 0) - (a.toolCount || 0)
  if (toolCountDiff !== 0) return toolCountDiff

  return a.categoryId - b.categoryId
}

function buildSelectionReason(selected, manualCategoryId) {
  if (!selected) return 'no shared category'
  if (manualCategoryId) return 'manualCategoryId override'
  return `auto tier-${selected.tier} handle-${selected.handle || 'unknown'} genericPriority-${genericCategoryPriority(selected.handle)}`
}

export function resolveCompareCategorySelection(primary, secondary, options = {}) {
  const manualCategoryId = Number(options.manualCategoryId) || null
  const shared = collectSharedCategories(primary, secondary)
  const sortedCommonCategories = [...shared].sort(compareSharedCategory)

  let selectedCategory = null
  if (manualCategoryId) {
    selectedCategory = sortedCommonCategories.find(row => row.categoryId === manualCategoryId)
      || shared.find(row => row.categoryId === manualCategoryId)
      || {
        categoryId: manualCategoryId,
        handle: '',
        name: '',
        toolCount: 0,
        tier: 4,
      }
  }
  else if (sortedCommonCategories.length) {
    selectedCategory = sortedCommonCategories[0]
  }

  if (selectedCategory) {
    selectedCategory = {
      ...selectedCategory,
      tier: compareCategorySelectionTier(selectedCategory.handle),
      reason: buildSelectionReason(selectedCategory, manualCategoryId),
    }
  }

  return {
    categoryId: selectedCategory?.categoryId || null,
    selectedCategory,
    primaryTool: {
      id: primary?.id || null,
      name: primary?.name || '',
      handle: primary?.handle || '',
    },
    secondaryTool: {
      id: secondary?.id || null,
      name: secondary?.name || '',
      handle: secondary?.handle || '',
    },
    primaryCategories: mapToolCategoriesForCompare(primary),
    secondaryCategories: mapToolCategoriesForCompare(secondary),
    commonCategories: shared,
    sortedCommonCategories,
  }
}

export function logCompareCategorySelection(payload) {
  console.info('[compare-category-selection]', JSON.stringify({
    primaryTool: payload.primaryTool,
    secondaryTool: payload.secondaryTool,
    primaryCategories: payload.primaryCategories,
    secondaryCategories: payload.secondaryCategories,
    commonCategories: payload.commonCategories,
    sortedCommonCategories: payload.sortedCommonCategories,
    selectedCategory: payload.selectedCategory,
    taskCategoryIdBefore: payload.taskCategoryIdBefore ?? null,
    taskCategoryIdAfter: payload.selectedCategory?.categoryId ?? payload.categoryId ?? null,
    tierConfig: getCompareCategoryTierConfig(),
  }, null, 2))
}

export function bestCommonCategoryId(primary, secondary, options = {}) {
  return resolveCompareCategorySelection(primary, secondary, options).categoryId
}

export const toolCategoryIncludeForCompare = {
  toolCategories: {
    select: {
      categoryId: true,
      category: { select: { id: true, handle: true, name: true, toolCount: true } },
    },
  },
}
