import {
  BODY_BLOCK_MIN_COUNT,
  COMPARE_REQUIRED_BLOCK_TYPES,
  FAQ_MIN_ITEMS,
  FORBIDDEN_CLAIM_PATTERNS,
  GUIDE_REQUIRED_BLOCK_TYPES,
  META_LIMITS,
} from './editorialRules'

const GUIDE_TYPES = new Set(['BUYER_GUIDE', 'CATEGORY_GUIDE', 'TUTORIAL'])
const COMPARE_TYPES = new Set(['COMPARISON', 'ALTERNATIVE'])
const STATUSES = new Set(['DRAFT', 'REVIEW', 'PUBLISHED', 'NEEDS_UPDATE', 'ARCHIVED'])
const ROBOTS = new Set(['INDEX_FOLLOW', 'NOINDEX_FOLLOW', 'NOINDEX_NOFOLLOW'])

function result(errors, warnings = []) {
  return { ok: errors.length === 0, errors, warnings }
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isSlug(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

function validateCanonical(slug, canonicalPath, prefix, errors) {
  if (!canonicalPath.startsWith(prefix)) errors.push(`canonicalPath must start with ${prefix}`)
  if (canonicalPath !== `${prefix}${slug}`) errors.push('canonicalPath must match the generated slug')
}

export function validateSourceData(data) {
  return data?.task === 'generate_compare' ? validateCompareSourceData(data) : validateGuideSourceData(data)
}

export function validateGuideSourceData(data) {
  const errors = []
  if (data.task !== 'generate_guide') errors.push('task must be generate_guide')
  if (!GUIDE_TYPES.has(data.contentType)) errors.push('contentType must be a guide-compatible type')
  if (!isSlug(data.slug)) errors.push('slug must be lowercase kebab-case')
  validateCanonical(data.slug || '', data.canonicalPath || '', '/guides/', errors)
  if (!Array.isArray(data.tools)) errors.push('tools must be an array')
  if (!Array.isArray(data.sources)) errors.push('sources must be an array')
  if (data.contentType === 'BUYER_GUIDE' && !data.tools?.length) errors.push('BUYER_GUIDE requires tools')
  if (data.contentType === 'BUYER_GUIDE' && !data.category?.level2?.id) {
    errors.push('BUYER_GUIDE requires category.level2')
  }
  if (data.contentType === 'TUTORIAL' && !data.primaryTool && !data.category?.level2) {
    errors.push('TUTORIAL requires a primaryTool or level2 category')
  }
  return result(errors)
}

export function validateCompareSourceData(data) {
  const errors = []
  if (data.task !== 'generate_compare') errors.push('task must be generate_compare')
  if (!COMPARE_TYPES.has(data.contentType)) errors.push('contentType must be COMPARISON or ALTERNATIVE')
  if (!isSlug(data.slug)) errors.push('slug must be lowercase kebab-case')
  validateCanonical(data.slug || '', data.canonicalPath || '', '/compare/', errors)
  if (!Array.isArray(data.tools)) errors.push('tools must be an array')
  if (!Array.isArray(data.sources)) errors.push('sources must be an array')
  if (!data.primaryTool && !data.categoryTopTools?.length) errors.push('primaryTool or categoryTopTools is required')
  if (data.comparisonType === 'TOOL_VS_TOOL' && (!data.primaryTool || !data.secondaryTool)) {
    errors.push('TOOL_VS_TOOL requires primaryTool and secondaryTool')
  }
  return result(errors)
}

export function validateGeneratedContentPage(page, sourceData = null) {
  const errors = []
  const warnings = []

  if (!isObject(page)) return result(['generated output must be an object'])
  if (!isObject(page.contentPage)) errors.push('contentPage is required')
  if (!isObject(page.bodyJson)) errors.push('bodyJson is required')
  if (!Array.isArray(page.sources)) errors.push('sources must be an array')
  if (errors.length) return result(errors)

  const meta = page.contentPage
  if (!GUIDE_TYPES.has(meta.type) && !COMPARE_TYPES.has(meta.type)) errors.push('unsupported contentPage.type')
  if (!isSlug(meta.slug)) errors.push('contentPage.slug must be lowercase kebab-case')
  if (!isNonEmptyString(meta.title)) errors.push('contentPage.title is required')
  if (!isNonEmptyString(meta.metaTitle)) errors.push('contentPage.metaTitle is required')
  if (!isNonEmptyString(meta.metaDescription)) errors.push('contentPage.metaDescription is required')
  if (!isNonEmptyString(meta.summary)) errors.push('contentPage.summary is required')
  if (!STATUSES.has(meta.status)) errors.push('contentPage.status is invalid')
  if (!ROBOTS.has(meta.robots)) errors.push('contentPage.robots is invalid')
  if (meta.status === 'PUBLISHED') errors.push('generated content must not be PUBLISHED before review')

  if (GUIDE_TYPES.has(meta.type)) {
    validateCanonical(meta.slug || '', meta.canonicalPath || '', '/guides/', errors)
    validateGuideBlocks(page, errors)
    if (meta.type === 'TUTORIAL' && !page.tutorialPage) errors.push('TUTORIAL requires tutorialPage')
    if ((meta.type === 'CATEGORY_GUIDE' || meta.type === 'BUYER_GUIDE') && !page.categoryContentPage) {
      errors.push(`${meta.type} requires categoryContentPage`)
    }
  }

  if (COMPARE_TYPES.has(meta.type)) {
    validateCanonical(meta.slug || '', meta.canonicalPath || '', '/compare/', errors)
    validateCompareBlocks(page, errors)
    if (meta.type === 'COMPARISON' && !page.comparisonPage) errors.push('COMPARISON requires comparisonPage')
    if (meta.type === 'ALTERNATIVE' && !page.alternativePage) errors.push('ALTERNATIVE requires alternativePage')
  }

  if (meta.metaTitle?.length > META_LIMITS.metaTitleMax) {
    errors.push(`contentPage.metaTitle must be ${META_LIMITS.metaTitleMax} characters or fewer; got ${meta.metaTitle.length}`)
  }
  if (meta.metaDescription?.length > META_LIMITS.metaDescriptionMax) {
    errors.push(`contentPage.metaDescription must be ${META_LIMITS.metaDescriptionMax} characters or fewer; got ${meta.metaDescription.length}`)
  }

  validateForbiddenClaims(page, errors)
  if (sourceData) validateReferencesAgainstSource(page, sourceData, errors, warnings)
  if (page.sources.length < 1) warnings.push('sources array is empty')

  return result(errors, warnings)
}

function validateGuideBlocks(page, errors) {
  const blocks = page.bodyJson?.blocks
  if (!Array.isArray(blocks)) {
    errors.push('bodyJson.blocks must be an array')
    return
  }
  if (blocks.length < BODY_BLOCK_MIN_COUNT) errors.push(`bodyJson.blocks length must be >= ${BODY_BLOCK_MIN_COUNT}`)
  for (const type of GUIDE_REQUIRED_BLOCK_TYPES) {
    if (!blocks.some((block) => block?.type === type)) errors.push(`bodyJson.blocks must include ${type}`)
  }
  const faqCount = maxFaqCount(blocks)
  if (faqCount < FAQ_MIN_ITEMS) errors.push(`faq must contain at least ${FAQ_MIN_ITEMS} items; got ${faqCount}`)
}

function validateCompareBlocks(page, errors) {
  const blocks = page.bodyJson?.blocks
  if (!Array.isArray(blocks)) {
    errors.push('bodyJson.blocks must be an array')
    return
  }
  for (const type of COMPARE_REQUIRED_BLOCK_TYPES) {
    if (!blocks.some((block) => block?.type === type)) errors.push(`bodyJson.blocks must include ${type}`)
  }
  const faqCount = maxFaqCount(blocks)
  if (faqCount < FAQ_MIN_ITEMS) errors.push(`faq must contain at least ${FAQ_MIN_ITEMS} items; got ${faqCount}`)
}

function maxFaqCount(blocks) {
  return blocks
    .filter((block) => block?.type === 'faq')
    .reduce((max, block) => Math.max(max, Array.isArray(block.items) ? block.items.length : 0), 0)
}

function validateForbiddenClaims(page, errors) {
  const text = []
  visit(page, (value) => {
    if (typeof value === 'string') text.push(value)
  })
  const haystack = text.join('\n')
  for (const claim of FORBIDDEN_CLAIM_PATTERNS) {
    if (claim.pattern.test(haystack)) errors.push(`Forbidden absolute claim found: ${claim.label}`)
  }
}

function validateReferencesAgainstSource(page, sourceData, errors, warnings) {
  const allowedTools = buildAllowedToolSet(sourceData)
  const refs = [
    ...extractRefsByKey(page, 'toolId'),
    ...extractRefsByKey(page, 'toolHandle'),
    ...extractRefsByKey(page, 'primaryToolId'),
    ...extractRefsByKey(page, 'secondaryToolId'),
  ]

  for (const ref of refs) {
    if (!isAllowedRef(ref, allowedTools)) errors.push(`Generated content references tool not present in sourceData: ${ref.label}`)
  }

  const structuralNames = extractRefsByKey(page, 'toolName')
  for (const ref of structuralNames) {
    if (!isAllowedRef(ref, allowedTools)) warnings.push(`Possible uninput tool name in generated content: ${ref.label}`)
  }
}

function buildAllowedToolSet(sourceData) {
  const tools = uniqueTools([
    ...(sourceData.tools || []),
    ...(sourceData.topTools || []),
    ...(sourceData.categoryTopTools || []),
    sourceData.primaryTool || null,
    sourceData.secondaryTool || null,
  ])
  return {
    ids: new Set(tools.map((tool) => String(tool.id))),
    handles: new Set(tools.map((tool) => normalizeText(tool.handle))),
    names: new Set(tools.map((tool) => normalizeText(tool.name))),
  }
}

function uniqueTools(tools) {
  const byId = new Map()
  for (const tool of tools) {
    if (tool) byId.set(tool.id, tool)
  }
  return Array.from(byId.values())
}

function extractRefsByKey(value, keyName) {
  const refs = []
  visit(value, (current, key) => {
    if (key !== keyName) return
    for (const ref of valueToRefs(current)) refs.push(ref)
  })
  return refs
}

function valueToRefs(value) {
  if (Array.isArray(value)) return value.flatMap(valueToRefs)
  if (typeof value === 'number') return [{ label: String(value), normalized: String(value) }]
  if (typeof value === 'string') return [{ label: value, normalized: normalizeText(value) }]
  if (!isObject(value)) return []

  const refs = []
  for (const key of ['id', 'toolId']) {
    const raw = value[key]
    if (typeof raw === 'number' || typeof raw === 'string') refs.push({ label: String(raw), normalized: String(raw) })
  }
  for (const key of ['handle', 'toolHandle', 'slug', 'name', 'toolName', 'title']) {
    const raw = value[key]
    if (typeof raw === 'string') refs.push({ label: raw, normalized: normalizeText(raw) })
  }
  return refs
}

function isAllowedRef(ref, allowed) {
  return allowed.ids.has(ref.normalized) || allowed.handles.has(ref.normalized) || allowed.names.has(ref.normalized)
}

function visit(value, visitor, key = '') {
  visitor(value, key)
  if (Array.isArray(value)) {
    value.forEach((item, index) => visit(item, visitor, String(index)))
    return
  }
  if (!isObject(value)) return
  for (const [childKey, childValue] of Object.entries(value)) {
    visit(childValue, visitor, childKey)
  }
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}
