import assert from 'node:assert/strict'
import {
  bestCommonCategoryId,
  compareCategorySelectionTier,
} from '../server/services/contentGeneration/compareCategorySelection.js'

function category(id, handle, toolCount = 100) {
  return { categoryId: id, category: { id, handle, toolCount } }
}

const chatgpt = {
  toolCategories: [
    category(10, 'ai-code-assistant', 664),
    category(20, 'ai-chatbot', 4847),
    category(30, 'ai-assistant', 6501),
    category(40, 'ai-writing-assistants', 2627),
    category(50, 'large-language-models-llms', 2717),
  ],
}

const claude = {
  toolCategories: [
    category(30, 'ai-assistant', 6501),
    category(20, 'ai-chatbot', 4847),
    category(60, 'ai-api', 1955),
  ],
}

const gemini = {
  toolCategories: [
    category(10, 'ai-code-assistant', 664),
    category(20, 'ai-chatbot', 4847),
    category(30, 'ai-assistant', 6501),
    category(50, 'large-language-models-llms', 2717),
  ],
}

assert.equal(compareCategorySelectionTier('ai-chatbot'), 1)
assert.equal(compareCategorySelectionTier('ai-code-assistant'), 3)
assert.equal(compareCategorySelectionTier('large-language-models-llms'), 2)

assert.equal(bestCommonCategoryId(chatgpt, claude), 20)
assert.equal(bestCommonCategoryId(chatgpt, gemini), 20)
assert.equal(bestCommonCategoryId(claude, gemini), 20)

const writingOnly = {
  toolCategories: [category(40, 'ai-writing-assistants', 2627)],
}
assert.equal(bestCommonCategoryId(chatgpt, writingOnly), 40)

const noOverlap = {
  toolCategories: [category(99, 'ai-transcription', 100)],
}
assert.equal(bestCommonCategoryId(chatgpt, noOverlap), null)

const llmOnlyPair = {
  toolCategories: [
    category(50, 'large-language-models-llms', 2717),
    category(70, 'ai-models', 823),
  ],
}
assert.equal(bestCommonCategoryId(chatgpt, llmOnlyPair), 50)

console.log('compare category selection: ok')
