import {
  COMPARE_REQUIRED_BLOCK_TYPES,
  COMPARE_REQUIRED_TOPICS,
  FAQ_RANKING_QUESTION_PATTERN,
  FORBIDDEN_CLAIM_PATTERNS,
  HIGH_RISK_EXPRESSION_PATTERNS,
  GUIDE_REQUIRED_BLOCK_TYPES,
  GUIDE_REQUIRED_TOPICS,
  META_LIMITS,
  PRODUCTION_LIMITS,
} from './editorialRules.js'
import { responseShapeForContentType } from './responseSchemas.js'
import { validateInputContractPayload } from './inputContracts.js'

const GUIDE_TYPES = new Set(['BUYER_GUIDE', 'CATEGORY_GUIDE', 'TUTORIAL'])
const COMPARE_TYPES = new Set(['COMPARISON', 'ALTERNATIVE'])
const ROBOTS = new Set(['INDEX_FOLLOW', 'NOINDEX_FOLLOW', 'NOINDEX_NOFOLLOW'])
const PRICING_DETAIL_PATTERNS = [
  /\b\d[\d,]*\s*(?:credits?|words?|articles?|audits?|generations?)\b/i,
  /\b\d+\s*(?:seats?|users?)\b/i,
  /\bfree\s+trial\b/i,
  /\b(?:starter|basic|lite|standard|professional|premium|enterprise|growth|scale|team|pro)\s+plan\b/i,
]
const FEATURE_ASSERTION_PATTERNS = [
  /\b\d+\+?\s*languages?\b/i,
  /\brank\s+tracking\b/i,
  /\bkeyword\s+research\b/i,
  /\bsemrush\b/i,
  /\bsurfer(?:\s*seo)?\b/i,
  /\bzapier\b/i,
  /\bwordpress\b/i,
  /\bintegrates?\s+with\b/i,
  /\bplagiarism[- ]free\b/i,
]

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isSlug(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function countEnglishWords(value) {
  const text = stripHtml(value)
  return text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)?.length || 0
}

function check(passed, actual, expected, options = {}) {
  return {
    passed: Boolean(passed),
    actual,
    expected,
    expandable: options.expandable !== false,
  }
}

function result(errors, warnings = [], extra = {}) {
  return {
    ok: errors.length === 0,
    passed: errors.length === 0,
    errors,
    warnings,
    ...extra,
  }
}

function validateCanonical(slug, canonicalPath, prefix, errors) {
  if (!String(canonicalPath || '').startsWith(prefix)) errors.push(`canonicalPath must start with ${prefix}`)
  if (canonicalPath !== `${prefix}${slug}`) errors.push('canonicalPath must match the generated slug')
}

export function validateSourceData(data) {
  return data?.task === 'generate_compare' ? validateCompareSourceData(data) : validateGuideSourceData(data)
}

function validateInputContract(data, errors, warnings) {
  const validation = data?.aiInput ? validateInputContractPayload(data.aiInput) : {
    inputContractType: data?.contentType || null,
    selectedTools: [],
    missingRequiredFields: ['aiInput'],
    forbiddenFieldsRemoved: [],
    sourceMapCount: 0,
    inputWarnings: [],
    passed: false,
  }
  const merged = { ...validation, ...(data?.inputValidation || {}) }
  for (const field of merged.missingRequiredFields || []) {
    errors.push(field === 'missingSecondaryTool' ? 'missingSecondaryTool' : `inputContract missing required field: ${field}`)
  }
  warnings.push(...(merged.inputWarnings || []))
  if (!merged.passed && !(merged.missingRequiredFields || []).length) errors.push('inputContract validation failed')
  return merged
}

export function validateGuideSourceData(data) {
  const errors = []
  const warnings = []
  if (data.task !== 'generate_guide') errors.push('task must be generate_guide')
  if (!GUIDE_TYPES.has(data.contentType)) errors.push('contentType must be a guide-compatible type')
  if (!isSlug(data.slug)) errors.push('slug must be lowercase kebab-case')
  validateCanonical(data.slug || '', data.canonicalPath || '', '/guides/', errors)
  if (!Array.isArray(data.tools)) errors.push('tools must be an array')
  if (!Array.isArray(data.sources)) errors.push('sources must be an array')
  if (data.contentType === 'BUYER_GUIDE' && (data.tools?.length || 0) < PRODUCTION_LIMITS.guide.minRecommendedTools) {
    errors.push(`BUYER_GUIDE requires at least ${PRODUCTION_LIMITS.guide.minRecommendedTools} source tools`)
  }
  if (data.contentType === 'BUYER_GUIDE' && !data.category?.level2?.id) errors.push('BUYER_GUIDE requires category.level2')
  if (data.contentType === 'TUTORIAL' && !data.primaryTool) {
    errors.push('TUTORIAL requires a primaryTool')
  }
  const inputContract = validateInputContract(data, errors, warnings)
  return result(errors, warnings, {
    missingToolFields: collectMissingToolFields(data.tools || []),
    inputContract,
    ...inputContract,
  })
}

export function validateCompareSourceData(data) {
  const errors = []
  const warnings = []
  if (data.task !== 'generate_compare') errors.push('task must be generate_compare')
  if (!COMPARE_TYPES.has(data.contentType)) errors.push('contentType must be COMPARISON or ALTERNATIVE')
  if (!isSlug(data.slug)) errors.push('slug must be lowercase kebab-case')
  validateCanonical(data.slug || '', data.canonicalPath || '', '/compare/', errors)
  if (!Array.isArray(data.tools)) errors.push('tools must be an array')
  if (!Array.isArray(data.sources)) errors.push('sources must be an array')
  if (!data.primaryTool) errors.push('primaryTool is required')
  if (data.contentType === 'COMPARISON' && !data.secondaryTool) {
    errors.push('missingSecondaryTool')
  }
  const inputContract = validateInputContract(data, errors, warnings)
  return result(errors, warnings, {
    missingToolFields: collectMissingToolFields(data.tools || []),
    inputContract,
    ...inputContract,
  })
}

export function collectMissingToolFields(tools) {
  return (tools || []).map((tool) => {
    const missing = []
    if (!isNonEmptyString(tool.name)) missing.push('name')
    if (!isNonEmptyString(tool.handle)) missing.push('slug')
    if (!isNonEmptyString(tool.website)) missing.push('website')
    if (!isNonEmptyString(tool.description) && !isNonEmptyString(tool.whatIsSummary)) missing.push('description/whatIsSummary')
    if (!(tool.pricingPlans?.length || tool.pricing?.length)) missing.push('pricingPlans/pricing')
    if (!(tool.claims?.length || tool.features?.length)) missing.push('claims/features')
    if (!tool.pros?.length) missing.push('pros')
    if (!tool.cons?.length) missing.push('cons')
    return missing.length ? { toolId: tool.id, handle: tool.handle, name: tool.name, fields: missing } : null
  }).filter(Boolean)
}

export function validateGeneratedContentPage(page, sourceData = null) {
  const errors = []
  const warnings = []
  const checks = {}

  if (!isObject(page)) return result(['generated output must be an object'], [], { checks, metrics: {} })
  const meta = page.contentPage
  const blocks = Array.isArray(page.bodyJson?.blocks) ? page.bodyJson.blocks : []
  const pageType = meta?.type
  const isGuide = GUIDE_TYPES.has(pageType)
  const isCompare = COMPARE_TYPES.has(pageType)
  const limits = isCompare ? PRODUCTION_LIMITS.compare : PRODUCTION_LIMITS.guide

  validateSchema(page, sourceData, errors)

  const editorialText = collectEditorialText(page)
  const wordCount = countEnglishWords(editorialText)
  const faqItems = blocks.filter(block => block?.type === 'faq').flatMap(block => Array.isArray(block.items) ? block.items : [])
  const sectionBlocks = blocks.filter(block => block?.type === 'section')
  const sectionWordCounts = sectionBlocks.map((block, index) => ({
    index,
    heading: block.heading || '',
    words: countEnglishWords(block.html || block.text || ''),
  }))
  const faqAnswerWordCounts = faqItems.map((item, index) => ({ index, words: countEnglishWords(item?.answer || '') }))
  const matrixRows = extractRows(page.comparisonPage?.matrixJson || page.alternativePage?.matrixJson)
  const criteria = extractRows(page.comparisonPage?.criteriaJson || page.alternativePage?.selectionCriteriaJson)
  const toolCallouts = blocks.filter(block => block?.type === 'tool_callout')
  const recommendedHandles = new Set(toolCallouts.map(block => String(block.toolHandle || '').trim()).filter(Boolean))
  const toolNoteWordCounts = toolCallouts.map(block => ({
    handle: block.toolHandle || '',
    words: countEnglishWords(block.verdict || block.note || block.text || ''),
  }))
  const headingsText = blocks.map(block => `${block?.heading || ''} ${block?.title || ''} ${block?.type || ''}`).join('\n')
  const fullBodyText = `${headingsText}\n${editorialText}`
  const topics = isCompare
    ? COMPARE_REQUIRED_TOPICS
    : pageType === 'CATEGORY_GUIDE'
      ? GUIDE_REQUIRED_TOPICS.filter(topic => !['recommendedTools', 'workflow'].includes(topic.key))
      : pageType === 'TUTORIAL'
        ? GUIDE_REQUIRED_TOPICS.filter(topic => !['howToChoose', 'keyCriteria', 'recommendedTools', 'decisionGuidance'].includes(topic.key))
        : GUIDE_REQUIRED_TOPICS
  const missingTopics = topics.filter(topic => !topic.pattern.test(fullBodyText)).map(topic => topic.key)
  const hasMethodology = blocks.some(block => block?.type === 'methodology' && countEnglishWords(block.text || '') >= 40)
  const hasPricingContext = /pricing|paid tier|free tier|trial|billing|plan|official pricing|verify current pricing/i.test(fullBodyText)
  const hasDecisionGuidance = /decision|choose|right fit|suitable for|recommendation|bottom line/i.test(fullBodyText)
  const hasUseCases = /use case|scenario|workflow|when to use/i.test(fullBodyText)
  const sourceTypes = [...(sourceData?.sources || []), ...(page.sources || [])].map(source => String(source?.sourceType || ''))
  const hasOfficialOrInternalSources = sourceTypes.some(type => /OFFICIAL|INTERNAL/i.test(type))
  const sourceConsistency = sourceData
    ? validateSourceConsistency(page, sourceData, errors, warnings)
    : { normalizedSources: page.sources || [], usedTools: [], sourceCount: page.sources?.length || 0 }

  const schemaErrorCount = errors.length
  checks.schemaValid = check(schemaErrorCount === 0, schemaErrorCount, 0, { expandable: false })
  checks.wordCount = check(wordCount >= limits.minWords && wordCount <= limits.maxWords, wordCount, `${limits.minWords}-${limits.maxWords}`)
  checks.blockCount = check(blocks.length >= limits.minBlocks && blocks.length <= limits.maxBlocks, blocks.length, `${limits.minBlocks}-${limits.maxBlocks}`)
  checks.faqCount = check(faqItems.length >= limits.minFaqItems, faqItems.length, `>= ${limits.minFaqItems}`)
  checks.minSectionWordCount = check(
    sectionWordCounts.length > 0 && sectionWordCounts.every(row => row.words >= limits.minSectionWords),
    sectionWordCounts,
    `every section >= ${limits.minSectionWords} words`,
  )
  checks.minFaqAnswerWordCount = check(
    faqAnswerWordCounts.length >= limits.minFaqItems && faqAnswerWordCounts.every(row => row.words >= limits.minFaqAnswerWords),
    faqAnswerWordCounts,
    `every FAQ answer >= ${limits.minFaqAnswerWords} words`,
  )
  if (pageType === 'BUYER_GUIDE' || isCompare) checks.hasPricingContext = check(hasPricingContext, hasPricingContext, true)
  checks.hasDecisionGuidance = check(hasDecisionGuidance && !missingTopics.includes('decisionGuidance'), hasDecisionGuidance, true)
  checks.hasUseCases = check(hasUseCases && !missingTopics.includes('useCases'), hasUseCases, true)
  checks.hasMethodology = check(hasMethodology, hasMethodology, true)
  checks.hasOfficialOrInternalSources = check(hasOfficialOrInternalSources, hasOfficialOrInternalSources, true, { expandable: false })
  checks.seoTitleValid = check(
    isNonEmptyString(meta?.metaTitle) && meta.metaTitle.length <= META_LIMITS.metaTitleMax,
    meta?.metaTitle?.length || 0,
    `1-${META_LIMITS.metaTitleMax} chars`,
    { expandable: false },
  )
  checks.metaDescriptionValid = check(
    isNonEmptyString(meta?.metaDescription) && meta.metaDescription.length <= META_LIMITS.metaDescriptionMax,
    meta?.metaDescription?.length || 0,
    `1-${META_LIMITS.metaDescriptionMax} chars`,
    { expandable: false },
  )
  checks.requiredTopics = check(missingTopics.length === 0, { missing: missingTopics }, 'all required topics')

  if (pageType === 'BUYER_GUIDE') {
    checks.recommendedToolsCount = check(recommendedHandles.size >= limits.minRecommendedTools, recommendedHandles.size, `>= ${limits.minRecommendedTools}`)
    checks.toolCalloutCount = check(toolCallouts.length >= limits.minRecommendedTools, toolCallouts.length, `>= ${limits.minRecommendedTools}`)
    checks.minRecommendedToolWordCount = check(
      toolNoteWordCounts.length >= limits.minRecommendedTools && toolNoteWordCounts.every(row => row.words >= limits.minToolNoteWords),
      toolNoteWordCounts,
      `at least ${limits.minRecommendedTools} notes; each >= ${limits.minToolNoteWords} words`,
    )
    checks.criteriaCount = check(extractGuideCriteria(blocks).length >= limits.minCriteria, extractGuideCriteria(blocks).length, `>= ${limits.minCriteria}`)
    checks.sourceCount = check(
      sourceConsistency.sourceCount >= recommendedHandles.size,
      sourceConsistency.sourceCount,
      `>= recommended tool count (${recommendedHandles.size})`,
      { expandable: false },
    )
    checks.sourceToolCoverage = check(
      sourceConsistency.missingToolSources.length === 0,
      { missing: sourceConsistency.missingToolSources },
      'official source for every used tool',
      { expandable: false },
    )
  }

  if (isCompare) {
    if (pageType === 'COMPARISON') {
      checks.matrixRowCount = check(matrixRows.length >= limits.minMatrixRows, matrixRows.length, `>= ${limits.minMatrixRows}`)
    }
    checks.criteriaCount = check(criteria.length >= limits.minCriteria, criteria.length, `>= ${limits.minCriteria}`)
    const verdictWords = countEnglishWords(page.comparisonPage?.verdict || page.alternativePage?.reasonToSwitch || '')
    checks.verdictSpecific = check(verdictWords >= limits.minVerdictWords, verdictWords, `>= ${limits.minVerdictWords} words`)
  }

  for (const [name, row] of Object.entries(checks)) {
    if (!row.passed) errors.push(`${name} failed: expected ${formatValue(row.expected)}, got ${formatValue(row.actual)}`)
  }

  const requiredBlockTypes = isCompare
    ? COMPARE_REQUIRED_BLOCK_TYPES
    : pageType === 'BUYER_GUIDE' ? GUIDE_REQUIRED_BLOCK_TYPES : GUIDE_REQUIRED_BLOCK_TYPES.filter(type => type !== 'tool_callout')
  validateRequiredBlockTypes(blocks, requiredBlockTypes, errors)
  validateForbiddenClaims(page, errors)
  validateHighRiskExpressions(page, errors, warnings)
  validateFaqQuestions(faqItems, errors)
  if (sourceData) validateAgainstSource(page, sourceData, errors, warnings)
  if (sourceData) validateToolGrounding(page, sourceData, errors)

  const score = calculateScore(checks, isCompare ? 'compare' : 'guide')
  checks.productionScore = check(score >= 85, score, '>= 85')
  if (!checks.productionScore.passed) errors.push(`productionScore failed: expected >= 85, got ${score}`)
  const failedChecks = Object.entries(checks).filter(([, row]) => !row.passed).map(([name]) => name)

  return result(errors, warnings, {
    checks,
    score,
    failedChecks,
    metrics: {
      wordCount,
      blockCount: blocks.length,
      faqCount: faqItems.length,
      matrixRowCount: matrixRows.length,
      criteriaCount: isGuide ? extractGuideCriteria(blocks).length : criteria.length,
      recommendedToolsCount: recommendedHandles.size,
      toolCalloutCount: toolCallouts.length,
      sourceCount: sourceConsistency.sourceCount,
      sectionWordCounts,
      faqAnswerWordCounts,
      toolNoteWordCounts,
    },
    missingToolFields: collectMissingToolFields(sourceData?.tools || []),
    normalizedSources: sourceConsistency.normalizedSources,
    inputContract: sourceData?.inputValidation || null,
    inputContractType: sourceData?.inputValidation?.inputContractType || null,
    selectedTools: sourceData?.inputValidation?.selectedTools || [],
    missingRequiredFields: sourceData?.inputValidation?.missingRequiredFields || [],
    forbiddenFieldsRemoved: sourceData?.inputValidation?.forbiddenFieldsRemoved || [],
    sourceMapCount: sourceData?.inputValidation?.sourceMapCount || 0,
    selectedToolStrategy: sourceData?.inputValidation?.selectedToolStrategy || sourceData?.selectedToolStrategy || null,
    inputWarnings: sourceData?.inputValidation?.inputWarnings || [],
  })
}

function validateSchema(page, sourceData, errors) {
  const responseShape = responseShapeForContentType(page.contentPage?.type || sourceData?.contentType)
  if (!responseShape) {
    errors.push(`unsupportedContentType: ${page.contentPage?.type || sourceData?.contentType || '(empty)'}`)
    return
  }
  for (const field of responseShape.requiredTopLevel) {
    if (page[field] === undefined || page[field] === null) errors.push(`${field} is required by response schema`)
  }
  if (!isObject(page.contentPage)) errors.push('contentPage is required')
  if (!isObject(page.bodyJson)) errors.push('bodyJson is required')
  if (!Array.isArray(page.bodyJson?.blocks)) errors.push('bodyJson.blocks must be an array')
  if (!Array.isArray(page.sources)) errors.push('sources must be an array')
  const meta = page.contentPage || {}
  for (const field of responseShape.contentPageFields) {
    if (meta[field] === undefined || meta[field] === null || meta[field] === '') {
      errors.push(`contentPage.${field} is required by response schema`)
    }
  }
  if (!GUIDE_TYPES.has(meta.type) && !COMPARE_TYPES.has(meta.type)) errors.push('unsupported contentPage.type')
  if (!isSlug(meta.slug)) errors.push('contentPage.slug must be lowercase kebab-case')
  for (const field of ['title', 'metaTitle', 'metaDescription', 'summary']) {
    if (!isNonEmptyString(meta[field])) errors.push(`contentPage.${field} is required`)
  }
  if (meta.status !== 'REVIEW') errors.push('contentPage.status must be REVIEW')
  if (!ROBOTS.has(meta.robots) || meta.robots !== 'NOINDEX_FOLLOW') errors.push('contentPage.robots must be NOINDEX_FOLLOW')
  if (GUIDE_TYPES.has(meta.type)) {
    validateCanonical(meta.slug || '', meta.canonicalPath || '', '/guides/', errors)
    if (meta.type === 'TUTORIAL' && !page.tutorialPage) errors.push('TUTORIAL requires tutorialPage')
    if (['CATEGORY_GUIDE', 'BUYER_GUIDE'].includes(meta.type) && !page.categoryContentPage) {
      errors.push(`${meta.type} requires categoryContentPage`)
    }
  }
  if (COMPARE_TYPES.has(meta.type)) {
    validateCanonical(meta.slug || '', meta.canonicalPath || '', '/compare/', errors)
    if (meta.type === 'COMPARISON' && !isObject(page.comparisonPage)) errors.push('COMPARISON requires comparisonPage')
    if (meta.type === 'COMPARISON' && !Array.isArray(page.comparisonTools)) errors.push('COMPARISON requires comparisonTools')
    if (meta.type === 'ALTERNATIVE' && !isObject(page.alternativePage)) errors.push('ALTERNATIVE requires alternativePage')
    if (meta.type === 'ALTERNATIVE' && !Array.isArray(page.alternativeTools)) errors.push('ALTERNATIVE requires alternativeTools')
    if (meta.type === 'COMPARISON' && isObject(page.comparisonPage)) {
      for (const field of responseShape.comparisonPageFields || []) {
        if (page.comparisonPage[field] === undefined || page.comparisonPage[field] === null) {
          errors.push(`comparisonPage.${field} is required by response schema`)
        }
      }
      if ((page.comparisonTools || []).length < 2) errors.push('comparisonTools must include primary and secondary tools')
      for (const [index, tool] of (page.comparisonTools || []).entries()) {
        for (const field of responseShape.comparisonToolFields || []) {
          if (tool?.[field] === undefined || tool?.[field] === null) errors.push(`comparisonTools[${index}].${field} is required by response schema`)
        }
      }
      const comparisonToolIds = new Set((page.comparisonTools || []).map(tool => String(tool?.toolId)))
      for (const toolId of [page.comparisonPage.primaryToolId, page.comparisonPage.secondaryToolId]) {
        if (toolId != null && !comparisonToolIds.has(String(toolId))) errors.push(`comparisonTools must include comparisonPage tool id ${toolId}`)
      }
    }
    if (meta.type === 'ALTERNATIVE' && isObject(page.alternativePage)) {
      for (const field of responseShape.alternativePageFields || []) {
        if (page.alternativePage[field] === undefined || page.alternativePage[field] === null) {
          errors.push(`alternativePage.${field} is required by response schema`)
        }
      }
      for (const [index, tool] of (page.alternativeTools || []).entries()) {
        for (const field of responseShape.alternativeToolFields || []) {
          if (tool?.[field] === undefined || tool?.[field] === null) errors.push(`alternativeTools[${index}].${field} is required by response schema`)
        }
      }
      if (!(page.alternativeTools || []).length) errors.push('alternativeTools must include at least one alternative')
      if ((page.alternativeTools || []).some(tool => String(tool?.toolId) === String(page.alternativePage.primaryToolId))) {
        errors.push('alternativeTools must not repeat alternativePage.primaryToolId')
      }
    }
  }
  if (sourceData && meta.type !== sourceData.contentType) errors.push('contentPage.type must match sourceData.contentType')
  if (sourceData && meta.slug !== sourceData.slug) errors.push('contentPage.slug must match sourceData.slug')
}

function collectEditorialText(page) {
  const chunks = []
  const blocks = page.bodyJson?.blocks || []
  for (const block of blocks) {
    for (const key of ['heading', 'title', 'html', 'text', 'verdict']) {
      if (typeof block?.[key] === 'string') chunks.push(block[key])
    }
    collectStrings(block?.items, chunks)
    collectStrings(block?.criteria, chunks)
    collectStrings(block?.branches, chunks)
    collectStrings(block?.primary, chunks)
    collectStrings(block?.secondary, chunks)
  }
  collectStrings(page.comparisonPage?.verdict, chunks)
  collectStrings(page.comparisonPage?.criteriaJson, chunks)
  collectStrings(page.comparisonPage?.matrixJson, chunks)
  collectStrings(page.alternativePage?.reasonToSwitch, chunks)
  collectStrings(page.alternativePage?.selectionCriteriaJson, chunks)
  collectStrings(page.comparisonTools, chunks)
  collectStrings(page.alternativeTools, chunks)
  return chunks.join('\n')
}

function collectStrings(value, chunks) {
  if (typeof value === 'string') {
    chunks.push(value)
    return
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectStrings(item, chunks))
    return
  }
  if (!isObject(value)) return
  Object.values(value).forEach(item => collectStrings(item, chunks))
}

function extractRows(value) {
  if (Array.isArray(value)) return value.filter(item => isObject(item) || isNonEmptyString(item))
  if (!isObject(value)) return []
  for (const key of ['rows', 'items', 'criteria', 'matrix', 'comparisons']) {
    if (Array.isArray(value[key])) return value[key].filter(item => isObject(item) || isNonEmptyString(item))
  }
  return Object.entries(value).filter(([, item]) => isObject(item) || isNonEmptyString(item)).map(([key, item]) => ({ key, item }))
}

function extractGuideCriteria(blocks) {
  return blocks.filter(block => block?.type === 'framework').flatMap(block => Array.isArray(block.criteria) ? block.criteria : [])
}

function validateRequiredBlockTypes(blocks, requiredTypes, errors) {
  for (const type of requiredTypes) {
    if (!blocks.some(block => block?.type === type)) errors.push(`bodyJson.blocks must include ${type}`)
  }
}

function validateForbiddenClaims(page, errors) {
  const text = []
  collectStrings(page, text)
  const haystack = text.join('\n')
  for (const claim of FORBIDDEN_CLAIM_PATTERNS) {
    if (claim.pattern.test(haystack)) errors.push(`Forbidden absolute claim found: ${claim.label}`)
  }
  if (/\$\s*[\d,]+(?:\.\d{1,2})?/.test(haystack)) errors.push('Editorial text must not contain dollar amounts')
  if (/<script\b|<iframe\b|\son\w+\s*=/i.test(haystack)) errors.push('Unsafe HTML is not allowed')
}

function validateHighRiskExpressions(page, errors, warnings) {
  const text = []
  collectStrings(page, text)
  const haystack = text.join('\n')
  for (const risk of HIGH_RISK_EXPRESSION_PATTERNS) {
    if (risk.pattern.test(haystack)) {
      errors.push(`High-risk expression found: ${risk.label}`)
      warnings.push(`Replace "${risk.label}" with readability, natural-draft, human-review, or claim-verification language`)
    }
  }
}

function validateFaqQuestions(items, errors) {
  items.forEach((item, index) => {
    if (FAQ_RANKING_QUESTION_PATTERN.test(String(item?.question || ''))) {
      errors.push(`FAQ question ${index + 1} uses ranking language; use an evaluation-style question`)
    }
  })
}

function validateAgainstSource(page, sourceData, errors, warnings) {
  const tools = uniqueTools(sourceData)
  const allowedIds = new Set(tools.map(tool => String(tool.id)))
  const allowedHandles = new Set(tools.map(tool => String(tool.handle || '').toLowerCase()))
  const refs = []
  visit(page, (value, key) => {
    if (['toolId', 'primaryToolId', 'secondaryToolId'].includes(key) && value != null) refs.push({ type: 'id', value: String(value) })
    if (key === 'toolHandle' && value != null) refs.push({ type: 'handle', value: String(value).toLowerCase() })
  })
  refs.forEach(ref => {
    if (ref.type === 'id' && !allowedIds.has(ref.value)) errors.push(`Generated content references tool id not in sourceData: ${ref.value}`)
    if (ref.type === 'handle' && !allowedHandles.has(ref.value)) errors.push(`Generated content references tool handle not in sourceData: ${ref.value}`)
  })
  if (sourceData.sources?.length && !page.sources?.length) errors.push('sources must copy sourceData.sources')
  if (!page.sources?.length) warnings.push('sources array is empty')
  if (GUIDE_TYPES.has(page.contentPage?.type)) {
    for (const field of ['metaTitle', 'metaDescription']) {
      const text = String(page.contentPage?.[field] || '').toLowerCase()
      for (const tool of tools) {
        if (tool.name && text.includes(String(tool.name).toLowerCase())) {
          errors.push(`${field} must not name specific tools on guide pages`)
        }
      }
    }
    const expectedLevel2 = sourceData.category?.level2?.id
    if (expectedLevel2 && String(page.categoryContentPage?.level2Id) !== String(expectedLevel2)) {
      errors.push(`categoryContentPage.level2Id must match source category.level2.id (${expectedLevel2})`)
    }
  }
}

function validateSourceConsistency(page, sourceData, errors, warnings) {
  const tools = uniqueTools(sourceData)
  const used = collectUsedTools(page, tools)
  const candidates = dedupeSources([...(page.sources || []), ...(sourceData.sources || [])])
  const normalizedSources = []
  const missingToolSources = []

  for (const tool of used) {
    const matches = candidates.filter(source => sourceMatchesTool(source, tool))
    if (!matches.length) {
      missingToolSources.push(tool.handle || tool.name || String(tool.id))
      errors.push(`Missing source for used tool: ${tool.handle || tool.name || tool.id}`)
      continue
    }
    for (const source of matches) {
      if (!normalizedSources.some(row => normalizeUrl(row.url) === normalizeUrl(source.url))) normalizedSources.push(source)
    }
  }

  for (const source of page.sources || []) {
    if (!used.some(tool => sourceMatchesTool(source, tool))) {
      warnings.push(`Unused source: ${source.url || source.title || 'unknown source'}`)
    }
  }

  normalizedSources.forEach((source, index) => { source.sort = index + 1 })
  return {
    normalizedSources,
    usedTools: used.map(tool => ({ id: tool.id, handle: tool.handle, name: tool.name })),
    missingToolSources,
    sourceCount: normalizedSources.length,
  }
}

function collectUsedTools(page, tools) {
  const ids = new Set()
  const handles = new Set()
  const addValue = (value) => {
    if (typeof value === 'number') ids.add(String(value))
    if (typeof value === 'string') handles.add(value.trim().toLowerCase())
  }
  for (const value of page.bodyJson?.tools || []) addValue(value)
  visit(page.bodyJson?.blocks || [], (value, key) => {
    if (['toolId', 'primaryToolId', 'secondaryToolId'].includes(key)) addValue(value)
    if (key === 'toolHandle') addValue(value)
    if (key === 'toolHandles' && Array.isArray(value)) value.forEach(addValue)
  })
  for (const value of [page.comparisonPage?.primaryToolId, page.comparisonPage?.secondaryToolId, page.alternativePage?.primaryToolId]) addValue(value)
  for (const row of [...(page.comparisonTools || []), ...(page.alternativeTools || [])]) addValue(row?.toolId)
  return tools.filter(tool => ids.has(String(tool.id)) || handles.has(String(tool.handle || '').toLowerCase()))
}

function sourceMatchesTool(source, tool) {
  const sourceUrl = normalizeUrl(source?.url)
  const website = normalizeUrl(tool.website)
  if (sourceUrl && website && (sourceUrl === website || sourceUrl.startsWith(`${website}/`) || website.startsWith(`${sourceUrl}/`))) return true
  const text = `${source?.title || ''} ${source?.context || ''}`.toLowerCase()
  return Boolean(tool.name && text.includes(String(tool.name).toLowerCase()))
    || Boolean(tool.handle && text.includes(String(tool.handle).toLowerCase()))
}

function normalizeUrl(value) {
  try {
    const url = new URL(String(value || ''))
    return `${url.protocol}//${url.hostname}${url.pathname.replace(/\/$/, '')}`.toLowerCase()
  }
  catch {
    return String(value || '').trim().replace(/\/$/, '').toLowerCase()
  }
}

function dedupeSources(sources) {
  const rows = new Map()
  for (const source of sources) {
    if (!source?.url) continue
    const key = normalizeUrl(source.url)
    if (!rows.has(key)) rows.set(key, { ...source })
  }
  return Array.from(rows.values())
}

function calculateScore(checks, family) {
  const guideWeights = {
    wordCount: 12,
    blockCount: 8,
    faqCount: 8,
    recommendedToolsCount: 10,
    toolCalloutCount: 8,
    criteriaCount: 8,
    minRecommendedToolWordCount: 10,
    minFaqAnswerWordCount: 8,
    requiredTopics: 10,
    hasMethodology: 5,
    sourceCount: 5,
    sourceToolCoverage: 8,
  }
  const compareWeights = {
    wordCount: 15,
    blockCount: 10,
    faqCount: 8,
    matrixRowCount: 15,
    criteriaCount: 12,
    verdictSpecific: 10,
    minFaqAnswerWordCount: 8,
    requiredTopics: 7,
    hasMethodology: 5,
    hasOfficialOrInternalSources: 5,
    seoTitleValid: 3,
    metaDescriptionValid: 2,
  }
  const weights = family === 'compare' ? compareWeights : guideWeights
  const applicable = Object.entries(weights).filter(([name]) => checks[name])
  const total = applicable.reduce((sum, [, value]) => sum + value, 0)
  const earned = applicable.reduce((sum, [name, weight]) => sum + (checks[name].passed ? weight : 0), 0)
  if (!total) return 0
  return Math.round((earned / total) * 100)
}

function validateToolGrounding(page, sourceData, errors) {
  const tools = uniqueTools(sourceData)
  const blocks = page.bodyJson?.blocks || []
  for (const block of blocks) {
    if (block?.type !== 'tool_callout') continue
    const handle = String(block.toolHandle || '').toLowerCase()
    const tool = tools.find(row => String(row.handle || '').toLowerCase() === handle)
    if (!tool) continue
    const text = stripHtml(block.verdict || block.note || block.text || '')
    const corpus = buildToolCorpus(tool)
    if (!(tool.pricingPlans?.length || tool.pricing?.length)) {
      for (const pattern of PRICING_DETAIL_PATTERNS) {
        const match = text.match(pattern)?.[0]
        if (match && !corpus.includes(match.toLowerCase())) {
          errors.push(`tool_callout for ${handle} contains unsupported pricing detail: ${match}`)
        }
      }
    }
    for (const pattern of FEATURE_ASSERTION_PATTERNS) {
      const match = text.match(pattern)?.[0]
      if (match && !corpus.includes(match.toLowerCase())) {
        errors.push(`tool_callout for ${handle} contains unsupported feature claim: ${match}`)
      }
    }
  }

  const methodology = blocks.find(block => block?.type === 'methodology')
  const methodologyText = String(methodology?.text || '')
  const hasRetrievedAt = [...(sourceData.sources || []), ...(page.sources || [])].some(source => source?.retrievedAt)
  if (/\bas of (?:the )?(?:retrieval date|date of retrieval|our retrieval)\b/i.test(methodologyText) && !hasRetrievedAt) {
    errors.push('methodology must not reference retrieval date when sources have no retrievedAt value')
  }
  if (/\b(?:we tested|hands-on|in our testing)\b/i.test(methodologyText)) {
    errors.push('methodology must not claim hands-on testing without explicit internal test evidence')
  }
}

function buildToolCorpus(tool) {
  const chunks = [tool.description, tool.whatIsSummary, ...(tool.features || []), ...(tool.pros || []), ...(tool.cons || [])]
  for (const claim of tool.claims || []) chunks.push(claim.claimText)
  for (const plan of tool.pricingPlans || []) {
    chunks.push(plan.planName, plan.rawText, ...(plan.features || []))
  }
  chunks.push(...(tool.pricing || []))
  return chunks.filter(Boolean).join('\n').toLowerCase()
}

function uniqueTools(sourceData) {
  const rows = [
    ...(sourceData.tools || []),
    ...(sourceData.topTools || []),
    ...(sourceData.categoryTopTools || []),
    sourceData.primaryTool,
    sourceData.secondaryTool,
  ].filter(Boolean)
  return Array.from(new Map(rows.map(tool => [tool.id, tool])).values())
}

function visit(value, visitor, key = '') {
  visitor(value, key)
  if (Array.isArray(value)) return value.forEach((item, index) => visit(item, visitor, String(index)))
  if (!isObject(value)) return
  Object.entries(value).forEach(([childKey, child]) => visit(child, visitor, childKey))
}

function formatValue(value) {
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}
