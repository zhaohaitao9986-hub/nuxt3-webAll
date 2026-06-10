import assert from 'node:assert/strict'
import { validateGeneratedContentPage } from '../server/services/contentGeneration/validators.js'

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
      { type: 'key_takeaways', items: [words(35), words(35), words(35)] },
      { type: 'problem_frame', text: words(90, 'The buyer problem') },
      { type: 'framework', criteria: Array.from({ length: 6 }, (_, index) => ({ name: `Criterion ${index + 1}`, weight: 1, description: words(35) })) },
      section('Introduction and Who This Is For'),
      section('How to Choose, Key Criteria, and Pricing Context'),
      section('Recommended Tools to Consider'),
      section('Workflow and Implementation Steps'),
      section('Use Cases and Common Mistakes'),
      section('Decision Guidance and Final Recommendation'),
      ...tools.slice(0, 5).map(row => ({ type: 'tool_callout', toolHandle: row.handle, verdict: words(95, row.name) })),
      { type: 'methodology', text: words(70, 'Methodology based on official sources') },
      { type: 'faq', items: Array.from({ length: 5 }, (_, index) => ({ question: `How should buyers evaluate factor ${index + 1}?`, answer: words(70) })) },
    ],
  },
  categoryContentPage: { level1Id: 10, level2Id: 20 },
  tutorialPage: null,
  sources,
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

const unsupported = structuredClone(guide)
unsupported.contentPage.type = 'TOOL_REVIEW'
const unsupportedValidation = validateGeneratedContentPage(unsupported, null)
assert.equal(unsupportedValidation.ok, false)
assert.match(unsupportedValidation.errors.join('\n'), /unsupportedContentType/)

console.log(JSON.stringify({
  guide: guideValidation.metrics,
  compare: compareValidation.metrics,
  guideScore: guideValidation.score,
  compareScore: compareValidation.score,
  thinGuideRejected: !thinValidation.ok,
  riskyGuideRejected: !riskyValidation.ok,
  unsupportedTypeRejected: !unsupportedValidation.ok,
}, null, 2))
