import assert from 'node:assert/strict'
import { validateGeneratedContentPage, validateSourceData } from '../server/services/contentGeneration/validators.js'
import { PRODUCTION_LIMITS } from '../server/services/contentGeneration/editorialRules.js'
import { enforceInputContract } from '../server/services/contentGeneration/inputContracts.js'
import { applyPromptTemplate } from '../server/services/contentGeneration/prompts.js'
import { buildSourceMap, compactToolFacts } from '../server/services/contentGeneration/sourceSelectors.js'
import { promptJsonWithBrief } from '../server/services/contentGeneration/taskStore.js'
import {
  buildContentGenerationBrief,
  contentGenerationTargetType,
  createContentGenerationBriefForm,
  validateContentGenerationBrief,
} from '../utils/contentGeneration.js'

function words(count, prefix = 'Editorial guidance') {
  const sentence = `${prefix} explains practical evaluation details, grounded trade-offs, buyer context, implementation choices, and verification steps for a careful software decision.`
  return Array.from({ length: Math.ceil(count / 18) }, () => sentence).join(' ')
}

function exactWords(count) {
  return Array.from({ length: count }, (_, index) => `detail${index + 1}`).join(' ')
}

function tool(id) {
  return {
    id,
    handle: `tool-${id}`,
    name: `Tool ${id}`,
    website: `https://tool-${id}.example.com`,
    description: words(40, `Tool ${id}`),
    whatIsSummary: words(30, `Tool ${id} summary`),
    pricing: ['Paid tiers with billing terms documented on the official website.'],
    pricingPlans: [{ planName: 'Professional', billingInterval: 'MONTHLY', features: ['Team workflow'] }],
    claims: [{ claimType: 'FEATURE', claimText: 'Supports a documented team workflow.' }],
    features: ['Team workflow', 'Content editing'],
    pros: ['Structured workflow'],
    cons: ['Plan limits require verification'],
    useCases: ['Editorial workflow'],
  }
}

const tools = [1, 2, 3, 4, 5, 6].map(tool)
const sources = tools.map((row, index) => ({
  url: row.website,
  domain: `tool-${row.id}.example.com`,
  title: row.name,
  sourceType: 'OFFICIAL_SITE',
  sort: index + 1,
}))

function section(heading) {
  return { type: 'section', heading, level: 2, html: `<p>${words(150, heading)}</p>` }
}

function compareSection(heading) {
  return { type: 'section', heading, level: 2, html: `<p>${exactWords(125)}</p>` }
}

const guideSource = {
  task: 'generate_guide',
  contentType: 'BUYER_GUIDE',
  slug: 'production-guide-test',
  canonicalPath: '/guides/production-guide-test',
  category: { level1: { id: 10 }, level2: { id: 20 } },
  tools,
  topTools: tools,
  sources,
}

const guide = {
  contentPage: {
    type: 'BUYER_GUIDE',
    slug: guideSource.slug,
    canonicalPath: guideSource.canonicalPath,
    title: 'Production Guide Test',
    metaTitle: 'How to Evaluate AI Software for Your Workflow',
    metaDescription: 'A detailed framework for evaluating AI software, comparing practical criteria, planning implementation, and choosing a suitable option.',
    summary: 'A source-grounded buyer guide with detailed criteria and implementation advice.',
    status: 'REVIEW',
    robots: 'NOINDEX_FOLLOW',
  },
  bodyJson: {
    version: 1,
    tools: tools.map(row => row.handle),
    blocks: [
      { type: 'key_takeaways', items: [exactWords(70), exactWords(70), exactWords(70)] },
      { type: 'problem_frame', text: exactWords(150) },
      { type: 'section', heading: 'Introduction: Who This Guide Is For', level: 2, html: `<p>${exactWords(145)}</p>` },
      { type: 'framework', criteria: Array.from({ length: 6 }, (_, index) => ({ name: `Criterion ${index + 1}`, weight: 1, description: exactWords(70) })) },
      ...tools.slice(0, 5).map(row => ({ type: 'tool_callout', toolHandle: row.handle, verdict: exactWords(115) })),
      { type: 'decision_tree', branches: [{ if: exactWords(35), then: exactWords(55), toolHandles: [tools[0].handle] }] },
      { type: 'section', heading: 'Workflow and Implementation Steps', level: 2, html: `<p>${exactWords(145)}</p>` },
      { type: 'section', heading: 'Common Mistakes and Use Cases', level: 2, html: `<p>${exactWords(145)}</p>` },
      { type: 'section', heading: 'Final Recommendation, Pricing, and How to Choose', level: 2, html: `<p>${exactWords(145)}</p>` },
      { type: 'methodology', text: `Methodology based on official sources ${exactWords(80)}` },
      { type: 'faq', items: Array.from({ length: 5 }, (_, index) => ({ question: `How should buyers evaluate factor ${index + 1}?`, answer: exactWords(65) })) },
    ],
  },
  categoryContentPage: { level1Id: 10, level2Id: 20 },
  tutorialPage: null,
  sources,
}

function guideSourceTool(id, name, summary, category = { id: 52, handle: 'ai-writing-assistants', name: 'AI Writing Assistants' }, options = {}) {
  return {
    id,
    name,
    handle: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    summary,
    description: summary,
    whatIsSummary: summary,
    website: `https://tool-${id}.example.com`,
    relevanceLabel: options.relevanceLabel || 'STRONG',
    matchedCategories: options.matchedCategories || [category],
    pricing: ['Pricing requires verification on the official website.'],
    pricingPlans: [{ planName: 'Professional', billingInterval: 'MONTHLY', features: ['Team workflow'] }],
    claims: [{ claimType: 'FEATURE', claimText: summary }],
    features: [summary],
    pros: ['Useful workflow fit'],
    cons: ['Requires verification'],
    useCases: [summary],
  }
}

function sourceDataForToolCheck(category, firstTool) {
  const filler = [
    guideSourceTool(902, 'Grammarly', 'AI grammar checker and writing editor', category),
    guideSourceTool(903, 'QuillBot', 'Paraphraser and rewriting tool', category),
    guideSourceTool(904, 'Wordtune', 'AI writing assistant', category),
    guideSourceTool(905, 'Smodin', 'AI writer for writing workflows', category),
  ]
  const selectedTools = [firstTool, ...filler]
  return {
    task: 'generate_guide',
    contentType: 'BUYER_GUIDE',
    slug: category.handle,
    canonicalPath: `/guides/${category.handle}`,
    category: { level1: { id: 1, handle: 'writing-editing', name: 'Writing & Editing' }, level2: category },
    tools: selectedTools,
    topTools: selectedTools,
    selectedTools,
    sources: selectedTools.map((tool, index) => ({
      url: tool.website,
      domain: new URL(tool.website).hostname,
      title: tool.name,
      sourceType: 'OFFICIAL_SITE',
      sort: index + 1,
    })),
    aiInput: {
      pageType: 'GUIDE',
      contentType: 'BUYER_GUIDE',
      targetKeyword: category.handle === 'ai-summarizer' ? 'Best AI Summarizer Tools' : 'Best AI Writing Assistants',
      pageGoal: 'Help readers compare relevant tools.',
      searchIntent: 'buyer_guide',
      audience: 'Software buyers',
      selectedTools: selectedTools.map(tool => ({
        id: tool.id,
        handle: tool.handle,
        name: tool.name,
        relevanceLabel: tool.relevanceLabel,
        matchedCategories: tool.matchedCategories,
      })),
      toolFacts: selectedTools.map(tool => ({ id: tool.id, handle: tool.handle, name: tool.name })),
      decisionCriteria: ['Quality', 'Workflow fit', 'Ease of use', 'Integrations', 'Pricing'].map(name => ({ name })),
      sourceMap: [],
      internalLinks: [],
    },
    inputValidation: { passed: true, missingRequiredFields: [], inputWarnings: [], selectedTools: selectedTools.map(({ id, handle, name }) => ({ id, handle, name })), sourceMapCount: 0 },
  }
}

const compareSource = {
  task: 'generate_compare',
  contentType: 'COMPARISON',
  comparisonType: 'TOOL_VS_TOOL',
  slug: 'tool-1-vs-tool-2',
  canonicalPath: '/compare/tool-1-vs-tool-2',
  primaryTool: tools[0],
  secondaryTool: tools[1],
  tools,
  sources,
}

const compare = {
  contentPage: {
    type: 'COMPARISON',
    slug: compareSource.slug,
    canonicalPath: compareSource.canonicalPath,
    title: 'Tool 1 vs Tool 2',
    metaTitle: 'Tool 1 vs Tool 2: Detailed Comparison',
    metaDescription: 'Compare Tool 1 and Tool 2 across features, pricing context, workflows, use cases, strengths, limitations, and buyer fit.',
    summary: 'A detailed source-grounded comparison for buyers choosing between two tools.',
    status: 'REVIEW',
    robots: 'NOINDEX_FOLLOW',
  },
  bodyJson: {
    version: 1,
    blocks: [
      compareSection('Overview at a Glance'),
      compareSection('Quick Verdict'),
      compareSection('Feature Comparison Matrix'),
      compareSection('Criteria Analysis and How We Compare'),
      compareSection('Best for Tool A and Who Should Choose the First Tool'),
      compareSection('Best for Tool B and Who Should Choose the Second Tool'),
      compareSection('Pricing Comparison and Official Pricing Verification'),
      compareSection('Pros and Cons, Strengths and Limitations'),
      compareSection('Use-Case Scenarios'),
      compareSection('Alternatives and Final Recommendation'),
      { type: 'choose_if', primary: [exactWords(20)], secondary: [exactWords(20)] },
      { type: 'scenarios', items: [{ title: 'Team workflow', winner: 'tie', text: exactWords(40) }] },
      { type: 'methodology', text: `Methodology based on official sources ${exactWords(50)}` },
      { type: 'faq', items: Array.from({ length: 5 }, (_, index) => ({ question: `How should buyers compare factor ${index + 1}?`, answer: exactWords(65) })) },
    ],
  },
  comparisonPage: {
    comparisonType: 'TOOL_VS_TOOL',
    primaryToolId: 1,
    secondaryToolId: 2,
    verdict: exactWords(85),
    criteriaJson: Array.from({ length: 6 }, (_, index) => ({ name: `Criterion ${index + 1}`, analysis: exactWords(12) })),
    matrixJson: Array.from({ length: 8 }, (_, index) => ({ criterion: `Matrix row ${index + 1}`, primary: exactWords(8), secondary: exactWords(8) })),
  },
  comparisonTools: [
    { toolId: 1, position: 1, label: 'Primary', bestFor: 'Structured teams', summary: 'A grounded primary-tool summary.' },
    { toolId: 2, position: 2, label: 'Secondary', bestFor: 'Flexible teams', summary: 'A grounded secondary-tool summary.' },
  ],
  alternativePage: null,
  alternativeTools: [],
  sources,
}

const guideValidation = validateGeneratedContentPage(guide, guideSource)
const compareValidation = validateGeneratedContentPage(compare, compareSource)
assert.equal(guideValidation.ok, true, guideValidation.errors.join('\n'))
assert.equal(compareValidation.ok, true, compareValidation.errors.join('\n'))
assert.equal(guideValidation.score >= 85, true)
assert.equal(compareValidation.score >= 85, true)
assert.equal(guideValidation.normalizedSources.length, 6)
assert.equal(compareValidation.normalizedSources.length, 2)
assert.equal(compareValidation.warnings.filter(message => message.startsWith('Unused source:')).length, 4)
assert.deepEqual(PRODUCTION_LIMITS.comparison, { minWords: 1800, maxWords: 3000 })
assert.equal(PRODUCTION_LIMITS.compare.minWords, 1500)
assert.equal(PRODUCTION_LIMITS.compare.maxWords, 2500)

const comparisonWithinNewWordRange = structuredClone(compare)
comparisonWithinNewWordRange.bodyJson.blocks.find(block => block.type === 'methodology').text += ` ${exactWords(2725 - compareValidation.metrics.wordCount)}`
const comparisonWithinNewWordRangeValidation = validateGeneratedContentPage(comparisonWithinNewWordRange, compareSource)
assert.equal(comparisonWithinNewWordRangeValidation.metrics.wordCount, 2725)
assert.equal(comparisonWithinNewWordRangeValidation.checks.wordCount.passed, true)

const comparisonOverNewWordRange = structuredClone(comparisonWithinNewWordRange)
comparisonOverNewWordRange.bodyJson.blocks.find(block => block.type === 'methodology').text += ` ${exactWords(276)}`
const comparisonOverNewWordRangeValidation = validateGeneratedContentPage(comparisonOverNewWordRange, compareSource)
assert.equal(comparisonOverNewWordRangeValidation.metrics.wordCount, 3001)
assert.equal(comparisonOverNewWordRangeValidation.checks.wordCount.passed, false)
assert.equal(comparisonOverNewWordRangeValidation.checks.wordCount.expected, '1800-3000')

const dynamicBestFor = structuredClone(compare)
dynamicBestFor.bodyJson.blocks[4].heading = 'Best For Tool 1'
dynamicBestFor.bodyJson.blocks[5].heading = 'Best For Tool 2'
dynamicBestFor.comparisonTools[0].label = 'A'
dynamicBestFor.comparisonTools[0].bestFor = ''
dynamicBestFor.comparisonTools[1].label = 'B'
dynamicBestFor.comparisonTools[1].bestFor = ''
const dynamicBestForValidation = validateGeneratedContentPage(dynamicBestFor, compareSource)
assert.equal(dynamicBestForValidation.checks.requiredTopics.passed, true, dynamicBestForValidation.errors.join('\n'))

const structuralBestFor = structuredClone(compare)
structuralBestFor.bodyJson.blocks[4].heading = 'Primary Buyer Fit'
structuralBestFor.bodyJson.blocks[5].heading = 'Secondary Buyer Fit'
const structuralBestForValidation = validateGeneratedContentPage(structuralBestFor, compareSource)
assert.equal(structuralBestForValidation.checks.requiredTopics.passed, true, structuralBestForValidation.errors.join('\n'))

const shortCompareSection = structuredClone(compare)
shortCompareSection.bodyJson.blocks[0].html = `<p>${exactWords(100)}</p>`
const shortCompareSectionValidation = validateGeneratedContentPage(shortCompareSection, compareSource)
assert.equal(shortCompareSectionValidation.ok, true, shortCompareSectionValidation.errors.join('\n'))
assert.equal(shortCompareSectionValidation.checks.minSectionWordCount.severity, 'warning')

const longCompareSection = structuredClone(compare)
longCompareSection.bodyJson.blocks[0].html = `<p>${exactWords(221)}</p>`
const longCompareSectionValidation = validateGeneratedContentPage(longCompareSection, compareSource)
assert.equal(longCompareSectionValidation.ok, false)
assert.equal(longCompareSectionValidation.checks.minSectionWordCount.passed, false)

const longCompareFaq = structuredClone(compare)
longCompareFaq.bodyJson.blocks.find(block => block.type === 'faq').items[0].answer = exactWords(101)
const longCompareFaqValidation = validateGeneratedContentPage(longCompareFaq, compareSource)
assert.equal(longCompareFaqValidation.ok, false)
assert.equal(longCompareFaqValidation.checks.minFaqAnswerWordCount.passed, false)

const thinGuide = structuredClone(guide)
thinGuide.bodyJson.blocks = thinGuide.bodyJson.blocks.slice(0, 6)
const thinValidation = validateGeneratedContentPage(thinGuide, guideSource)
assert.equal(thinValidation.ok, false)
assert.equal(thinValidation.checks.blockCount.passed, false)
assert.equal(thinValidation.checks.wordCount.passed, false)

const riskyGuide = structuredClone(guide)
riskyGuide.bodyJson.blocks[3].html += '<p>This workflow can bypass AI detectors.</p>'
const riskyValidation = validateGeneratedContentPage(riskyGuide, guideSource)
assert.equal(riskyValidation.ok, false)
assert.match(riskyValidation.errors.join('\n'), /High-risk expression/)

const buyerLimits = structuredClone(guide)
buyerLimits.bodyJson.blocks.find(block => block.type === 'tool_callout').verdict = exactWords(131)
buyerLimits.bodyJson.blocks.find(block => block.type === 'section').html = `<p>${exactWords(171)}</p>`
buyerLimits.bodyJson.blocks.find(block => block.type === 'faq').items[0].answer = exactWords(86)
const buyerLimitsValidation = validateGeneratedContentPage(buyerLimits, guideSource)
assert.equal(buyerLimitsValidation.ok, false)
assert.equal(buyerLimitsValidation.checks.minRecommendedToolWordCount.passed, false)
assert.equal(buyerLimitsValidation.checks.minSectionWordCount.passed, false)
assert.equal(buyerLimitsValidation.checks.minFaqAnswerWordCount.passed, false)

const absoluteClaims = structuredClone(guide)
absoluteClaims.bodyJson.blocks[0].items.push('This is the best ever, fully autonomous choice with no editing needed.')
const absoluteValidation = validateGeneratedContentPage(absoluteClaims, guideSource)
assert.equal(absoluteValidation.checks.forbiddenClaims.passed, false)
assert.match(absoluteValidation.errors.join('\n'), /best ever/)
assert.match(absoluteValidation.errors.join('\n'), /fully autonomous/)
assert.match(absoluteValidation.errors.join('\n'), /no editing needed/)

const rankingFaq = structuredClone(guide)
rankingFaq.bodyJson.blocks.find(block => block.type === 'faq').items[0].question = 'Which is the best AI workflow tool?'
const rankingFaqValidation = validateGeneratedContentPage(rankingFaq, guideSource)
assert.equal(rankingFaqValidation.checks.faqQuestionStyle.passed, false)

const groundedUseCase = structuredClone(guide)
groundedUseCase.bodyJson.blocks.find(block => block.type === 'tool_callout').verdict = `${exactWords(105)} Keyword research supports the editorial workflow.`
groundedUseCase.bodyJson.blocks.find(block => block.type === 'tool_callout').toolHandle = tools[0].handle
const groundedUseCaseSource = structuredClone(guideSource)
groundedUseCaseSource.tools[0].useCases = ['Keyword research']
groundedUseCaseSource.topTools[0].useCases = ['Keyword research']
const groundedUseCaseValidation = validateGeneratedContentPage(groundedUseCase, groundedUseCaseSource)
assert.equal(groundedUseCaseValidation.checks.toolGrounding.passed, true)

const categoryGuide = structuredClone(guide)
categoryGuide.contentPage.type = 'CATEGORY_GUIDE'
categoryGuide.bodyJson.blocks = categoryGuide.bodyJson.blocks.filter(block => block.type !== 'tool_callout')
const categoryGuideValidation = validateGeneratedContentPage(categoryGuide, { ...guideSource, contentType: 'CATEGORY_GUIDE' })
assert.equal(categoryGuideValidation.ok, true, categoryGuideValidation.errors.join('\n'))
assert.equal(categoryGuideValidation.metrics.toolCalloutCount, 0)

const unsupported = structuredClone(guide)
unsupported.contentPage.type = 'TOOL_REVIEW'
const unsupportedValidation = validateGeneratedContentPage(unsupported, null)
assert.equal(unsupportedValidation.ok, false)
assert.match(unsupportedValidation.errors.join('\n'), /unsupportedContentType/)

const identity = id => ({ id, handle: `tool-${id}`, name: `Tool ${id}` })
const sourceMap = id => ({ url: `https://tool-${id}.example.com`, toolId: id, factType: 'official' })
const commonGuide = {
  pageType: 'GUIDE',
  targetKeyword: 'AI workflow tools',
  pageGoal: 'Help readers make a grounded decision.',
  searchIntent: 'Evaluate suitable tools.',
  audience: 'Small teams',
  sourceMap: [1, 2, 3, 4, 5].map(sourceMap),
  internalLinks: [{ path: '/ai-tools/workflow', anchor: 'AI workflow tools' }],
}

const buyerInput = enforceInputContract('BUYER_GUIDE', {
  ...commonGuide,
  contentType: 'BUYER_GUIDE',
  categoryContext: { id: 1, name: 'Workflow' },
  selectedTools: [1, 2, 3, 4, 5].map(identity),
  toolFacts: [1, 2, 3, 4, 5].map(identity),
  decisionCriteria: ['Workflow fit', 'Output quality', 'Ease of use', 'Pricing', 'Integrations'].map(name => ({ name })),
  socialLinks: [{ url: 'https://social.example.com' }],
})
assert.equal(buyerInput.validation.passed, true)
assert.deepEqual(buyerInput.validation.forbiddenFieldsRemoved, ['socialLinks'])
assert.equal('socialLinks' in buyerInput.input, false)

const factLevelTool = {
  ...tools[0],
  feature: ['Keyword research'],
  pricingPlans: [{ planName: 'Professional', features: ['Team workflow'], source: { id: 11, url: 'https://tool-1.example.com/pricing', sourceType: 'OFFICIAL_PRICING' } }],
  claims: [{
    claimType: 'FEATURE',
    claimText: 'Supports editorial briefs.',
    status: 'ACTIVE',
    confidence: 0.9,
    expiresAt: null,
    source: { id: 12, url: 'https://tool-1.example.com/features', sourceType: 'OFFICIAL_DOCS' },
  }],
}
const compactFacts = compactToolFacts(factLevelTool)
const factLevelSources = buildSourceMap([factLevelTool], { includePlatforms: true })
assert.equal(compactFacts.allowedFeatures.includes('Keyword research'), true)
assert.equal(factLevelSources.some(row => row.factType === 'official'), true)
assert.equal(factLevelSources.some(row => row.factType === 'features' && row.supportedFacts.includes('Keyword research')), true)
assert.equal(factLevelSources.some(row => row.factType === 'pricing'), true)
assert.equal(factLevelSources.some(row => row.factType === 'claim'), true)

const categoryInput = enforceInputContract('CATEGORY_GUIDE', {
  ...commonGuide,
  contentType: 'CATEGORY_GUIDE',
  categoryContext: { id: 1, name: 'Workflow', whatIsSummary: 'Category definition' },
  relatedCategories: [{ id: 2, name: 'Automation' }],
  representativeTools: [1, 2, 3].map(identity),
})
assert.equal(categoryInput.validation.passed, true)

const tutorialInput = enforceInputContract('TUTORIAL', {
  ...commonGuide,
  contentType: 'TUTORIAL',
  tutorialGoal: 'Create a reviewed workflow draft.',
  prerequisiteKnowledge: ['Basic prompting'],
  primaryTool: identity(1),
  workflowContext: [{ step: 1, instruction: 'Create a project.' }],
  commonMistakes: ['Skipping review'],
  outputChecklist: ['Draft reviewed'],
  relatedTools: [],
  sourceMap: [sourceMap(1)],
})
assert.equal(tutorialInput.validation.passed, true)

const comparisonInput = enforceInputContract('COMPARISON', {
  pageType: 'COMPARE',
  contentType: 'COMPARISON',
  comparisonIntent: 'Choose between two workflow tools.',
  targetAudience: 'Small teams',
  primaryTool: identity(1),
  secondaryTool: identity(2),
  sharedUseCases: ['Editorial workflow'],
  decisionCriteria: ['Workflow fit', 'Output quality', 'Ease of use', 'Pricing', 'Integrations', 'Team adoption'].map(name => ({ name })),
  featureComparisonFacts: [{ dimension: 'Workflow fit' }],
  pricingComparisonFacts: [{ toolId: 1 }, { toolId: 2 }],
  sourceMap: [sourceMap(1), sourceMap(2)],
  internalLinks: [{ path: '/tool/tool-1', anchor: 'Tool 1' }],
})
assert.equal(comparisonInput.validation.passed, true)

const missingSecondary = enforceInputContract('COMPARISON', { ...comparisonInput.input, secondaryTool: null })
assert.equal(missingSecondary.validation.passed, false)
assert.equal(missingSecondary.validation.missingRequiredFields.includes('secondaryTool'), true)

const alternativeInput = enforceInputContract('ALTERNATIVE', {
  pageType: 'COMPARE',
  contentType: 'ALTERNATIVE',
  primaryTool: identity(1),
  alternativeTools: [identity(2), identity(3)],
  reasonToSwitch: 'The current workflow lacks needed controls.',
  selectionCriteria: ['Workflow controls', 'Output quality', 'Ease of use', 'Pricing', 'Integrations'].map(name => ({ name })),
  comparisonDimensions: ['Workflow controls'],
  pricingSummary: [{ toolId: 1 }, { toolId: 2 }, { toolId: 3 }],
  sourceMap: [sourceMap(1), sourceMap(2), sourceMap(3)],
  internalLinks: [{ path: '/tool/tool-1', anchor: 'Tool 1' }],
})
assert.equal(alternativeInput.validation.passed, true)

const protectedPrompt = applyPromptTemplate('Contract: {{SOURCE_DATA_JSON}}', 'base prompt', {
  aiInput: buyerInput.input,
  secretFullSourceData: 'must-not-leak',
})
assert.equal(protectedPrompt.includes('must-not-leak'), false)
assert.equal(protectedPrompt.includes('selectedTools'), true)

const apiPromptJson = promptJsonWithBrief({
  promptJson: { promptVersion: 'existing@1', input: { targetKeyword: 'legacy keyword' }, brief: { targetKeyword: 'old keyword' } },
  targetKeyword: 'new keyword',
  selectedToolIds: [1, 2, 3, 4, 5],
  decisionCriteria: ['Fit', 'Price'],
})
assert.equal(apiPromptJson.promptVersion, 'existing@1')
assert.equal(apiPromptJson.brief.targetKeyword, 'new keyword')
assert.deepEqual(apiPromptJson.brief.selectedToolIds, [1, 2, 3, 4, 5])
assert.equal(apiPromptJson.input, undefined)

const formBrief = { ...createContentGenerationBriefForm(), contentType: 'comparison' }
formBrief.categoryId = 10
formBrief.primaryToolId = 1
formBrief.secondaryToolId = 2
formBrief.comparisonIntent = 'Choose one tool.'
formBrief.targetAudience = 'Small teams'
formBrief.decisionCriteriaText = 'Fit\nPrice\nQuality\nIntegrations\nAdoption\nSupport'
formBrief.sharedUseCasesText = 'Editorial workflow'
const builtFormBrief = buildContentGenerationBrief(formBrief)
assert.deepEqual(builtFormBrief.decisionCriteria, ['Fit', 'Price', 'Quality', 'Integrations', 'Adoption', 'Support'])
assert.equal(validateContentGenerationBrief(formBrief).ok, true)
assert.equal(contentGenerationTargetType('COMPARISON'), 'compare')
assert.equal(contentGenerationTargetType('ALTERNATIVE'), 'compare')
assert.equal(contentGenerationTargetType('BUYER_GUIDE'), 'guides')
assert.equal(contentGenerationTargetType('TUTORIAL'), 'guides')

const writingCategory = { id: 52, handle: 'ai-writing-assistants', name: 'AI Writing Assistants' }
const summarizerCategory = { id: 45, handle: 'ai-summarizer', name: 'AI Summarizer' }
const blogCategory = { id: 53, handle: 'ai-blog-generator', name: 'AI Blog Generator' }
const hixValidation = validateSourceData(sourceDataForToolCheck(
  writingCategory,
  guideSourceTool(901, 'HIX.AI', 'AI writing copilot, AI writer, content writer, email writer, blog writer, and long-form article writer.', writingCategory),
))
assert.equal(hixValidation.ok, true, hixValidation.errors.join('\n'))
const aiSummarizerValidation = validateSourceData(sourceDataForToolCheck(
  summarizerCategory,
  guideSourceTool(906, 'AI Summarizer', 'AI summarizer for turning long documents, articles, and notes into concise summaries.', summarizerCategory),
))
assert.equal(aiSummarizerValidation.ok, true, aiSummarizerValidation.errors.join('\n'))
const screenAppValidation = validateSourceData(sourceDataForToolCheck(
  summarizerCategory,
  guideSourceTool(907, 'ScreenApp', 'Video summarizer and transcript summary tool for meetings, recordings, and notes.', summarizerCategory),
))
assert.equal(screenAppValidation.ok, true, screenAppValidation.errors.join('\n'))
const komeValidation = validateSourceData(sourceDataForToolCheck(
  summarizerCategory,
  guideSourceTool(908, 'Kome AI', 'AI summary assistant for webpages, articles, videos, and research notes.', summarizerCategory),
))
assert.equal(komeValidation.ok, true, komeValidation.errors.join('\n'))
const slideSpeakValidation = validateSourceData(sourceDataForToolCheck(
  summarizerCategory,
  guideSourceTool(909, 'SlideSpeak', 'AI presentation and document summarizer for slides, PDFs, and meeting material.', summarizerCategory),
))
assert.equal(slideSpeakValidation.ok, true, slideSpeakValidation.errors.join('\n'))
const gizmoValidation = validateSourceData(sourceDataForToolCheck(
  summarizerCategory,
  guideSourceTool(910, 'Gizmo', 'Study flashcard and learning workflow tool with limited summary support.', summarizerCategory, { relevanceLabel: 'WEAK' }),
))
assert.equal(gizmoValidation.ok, true, gizmoValidation.errors.join('\n'))
assert.equal(gizmoValidation.warnings.some(item => item.rule === 'categoryRelevanceReview' && item.categoryRisk === 'HIGH'), true)
const designrrValidation = validateSourceData(sourceDataForToolCheck(
  blogCategory,
  guideSourceTool(911, 'Designrr', 'Content repurposing and ebook creation workflow with limited blog generation fit.', blogCategory, { relevanceLabel: 'WEAK' }),
))
assert.equal(designrrValidation.ok, true, designrrValidation.errors.join('\n'))
assert.equal(designrrValidation.warnings.some(item => item.rule === 'categoryRelevanceReview' && item.categoryRisk === 'HIGH'), true)
const contaminatedPageGoalSource = sourceDataForToolCheck(
  writingCategory,
  guideSourceTool(912, 'WriterFit', 'AI writing assistant for drafting, editing, and rewriting workflows.', writingCategory),
)
contaminatedPageGoalSource.aiInput.pageGoal = 'Help Best For: Students rewriting essays compare tools. Summary: polluted audience text.'
const contaminatedPageGoalValidation = validateSourceData(contaminatedPageGoalSource)
assert.equal(contaminatedPageGoalValidation.ok, true, contaminatedPageGoalValidation.errors.join('\n'))
assert.equal(contaminatedPageGoalValidation.warnings.some(item => item.rule === 'buyerGuidePageGoalContamination'), true)
const notionValidation = validateSourceData(sourceDataForToolCheck(
  writingCategory,
  guideSourceTool(901, 'Notion', 'Workspace database and project management tool.', writingCategory),
))
assert.equal(notionValidation.errors.some(error => /categoryRelevanceBlocked/.test(error) && /Notion/.test(error)), true)
const deeplValidation = validateSourceData(sourceDataForToolCheck(
  writingCategory,
  guideSourceTool(901, 'DeepL', 'Translation-only translate text workflow.', writingCategory),
))
assert.equal(deeplValidation.errors.some(error => /categoryRelevanceBlocked/.test(error) && /DeepL/.test(error)), true)
const bitbucketValidation = validateSourceData(sourceDataForToolCheck(
  summarizerCategory,
  guideSourceTool(901, 'Bitbucket', 'Git repository, code hosting, and version control platform.', summarizerCategory),
))
assert.equal(bitbucketValidation.errors.some(error => /categoryRelevanceBlocked/.test(error) && /Bitbucket/.test(error)), true)
const zerogptValidation = validateSourceData(sourceDataForToolCheck(
  summarizerCategory,
  guideSourceTool(901, 'ZeroGPT', 'AI content detector and plagiarism detector.', summarizerCategory),
))
assert.equal(zerogptValidation.errors.some(error => /categoryRelevanceBlocked/.test(error) && /ZeroGPT/.test(error)), true)

console.log(JSON.stringify({
  guide: guideValidation.metrics,
  compare: compareValidation.metrics,
  guideScore: guideValidation.score,
  compareScore: compareValidation.score,
  thinGuideRejected: !thinValidation.ok,
  riskyGuideRejected: !riskyValidation.ok,
  buyerGuideUpperLimitsRejected: !buyerLimitsValidation.ok,
  absoluteClaimsRejected: !absoluteValidation.ok,
  rankingFaqRejected: !rankingFaqValidation.ok,
  useCaseGroundingAccepted: groundedUseCaseValidation.checks.toolGrounding.passed,
  factLevelSourceMap: factLevelSources.map(row => row.factType),
  categoryGuideWithoutToolCallouts: categoryGuideValidation.ok,
  unsupportedTypeRejected: !unsupportedValidation.ok,
  categoryRelevanceFixtures: {
    hixWritingAssistantAccepted: hixValidation.ok,
    aiSummarizerAccepted: aiSummarizerValidation.ok,
    screenAppSummarizerAccepted: screenAppValidation.ok,
    komeSummarizerAccepted: komeValidation.ok,
    slideSpeakSummarizerAccepted: slideSpeakValidation.ok,
    gizmoSummarizerWarned: gizmoValidation.ok && gizmoValidation.warnings.some(item => item.rule === 'categoryRelevanceReview'),
    designrrBlogGeneratorWarned: designrrValidation.ok && designrrValidation.warnings.some(item => item.rule === 'categoryRelevanceReview'),
    contaminatedPageGoalWarned: contaminatedPageGoalValidation.warnings.some(item => item.rule === 'buyerGuidePageGoalContamination'),
    notionWritingAssistantRejected: notionValidation.errors.some(error => /categoryRelevanceBlocked/.test(error)),
    deeplWritingAssistantRejected: deeplValidation.errors.some(error => /categoryRelevanceBlocked/.test(error)),
    bitbucketSummarizerRejected: bitbucketValidation.errors.some(error => /categoryRelevanceBlocked/.test(error)),
    zerogptSummarizerRejected: zerogptValidation.errors.some(error => /categoryRelevanceBlocked/.test(error)),
  },
  inputContracts: {
    buyerGuide: buyerInput.validation.passed,
    categoryGuide: categoryInput.validation.passed,
    tutorial: tutorialInput.validation.passed,
    comparison: comparisonInput.validation.passed,
    alternative: alternativeInput.validation.passed,
    missingSecondaryRejected: !missingSecondary.validation.passed,
    fullSourceDataProtected: !protectedPrompt.includes('must-not-leak'),
    apiBriefNormalization: apiPromptJson.brief.targetKeyword === 'new keyword',
    adminFormBriefValidation: validateContentGenerationBrief(formBrief).ok,
  },
}, null, 2))
