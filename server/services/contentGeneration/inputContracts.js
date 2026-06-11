const CONTRACTS = {
  BUYER_GUIDE: {
    requiredFields: ['pageType', 'contentType', 'targetKeyword', 'pageGoal', 'searchIntent', 'audience', 'selectedTools', 'toolFacts', 'decisionCriteria', 'sourceMap', 'internalLinks'],
    optionalFields: ['categoryContext'],
    forbiddenFields: ['representativeTools', 'tutorialGoal', 'prerequisiteKnowledge', 'primaryTool', 'workflowContext', 'commonMistakes', 'outputChecklist', 'relatedTools', 'secondaryTool', 'alternativeTools', 'reasonToSwitch', 'comparisonIntent', 'targetAudience', 'sharedUseCases', 'featureComparisonFacts', 'pricingComparisonFacts', 'comparisonDimensions', 'pricingSummary', 'socialLinks', 'companyInfo'],
    minTools: 5,
    maxTools: 10,
    maxSources: 30,
    minCriteria: 5,
    sourceSelectionRule: 'Selected tools only; official site plus retained pricing, platform, and high-confidence relevant claim sources. No social sources.',
  },
  CATEGORY_GUIDE: {
    requiredFields: ['pageType', 'contentType', 'targetKeyword', 'pageGoal', 'searchIntent', 'audience', 'categoryContext', 'relatedCategories', 'representativeTools', 'sourceMap', 'internalLinks'],
    optionalFields: [],
    forbiddenFields: ['selectedTools', 'toolFacts', 'decisionCriteria', 'tutorialGoal', 'prerequisiteKnowledge', 'primaryTool', 'workflowContext', 'commonMistakes', 'outputChecklist', 'relatedTools', 'secondaryTool', 'alternativeTools', 'reasonToSwitch', 'comparisonIntent', 'targetAudience', 'sharedUseCases', 'featureComparisonFacts', 'pricingComparisonFacts', 'comparisonDimensions', 'pricingSummary', 'socialLinks', 'companyInfo'],
    minTools: 3,
    maxTools: 5,
    maxSources: 12,
    sourceSelectionRule: 'Representative tool official sites only; category facts come from curated database fields. Exclude pricing-plan and claim sources.',
    allowEmptyFields: ['relatedCategories'],
  },
  TUTORIAL: {
    requiredFields: ['pageType', 'contentType', 'targetKeyword', 'pageGoal', 'searchIntent', 'audience', 'tutorialGoal', 'primaryTool', 'workflowContext', 'outputChecklist', 'relatedTools', 'sourceMap', 'internalLinks'],
    optionalFields: ['prerequisiteKnowledge', 'commonMistakes'],
    forbiddenFields: ['categoryContext', 'relatedCategories', 'representativeTools', 'selectedTools', 'toolFacts', 'decisionCriteria', 'secondaryTool', 'alternativeTools', 'reasonToSwitch', 'comparisonIntent', 'targetAudience', 'sharedUseCases', 'featureComparisonFacts', 'pricingComparisonFacts', 'comparisonDimensions', 'pricingSummary', 'socialLinks', 'companyInfo'],
    minTools: 1,
    maxTools: 3,
    maxSources: 12,
    sourceSelectionRule: 'Primary tool and up to two explicitly related tools; only sources supporting the supplied workflow and tool facts.',
    allowEmptyFields: ['relatedTools'],
  },
  COMPARISON: {
    requiredFields: ['pageType', 'contentType', 'comparisonIntent', 'targetAudience', 'primaryTool', 'secondaryTool', 'decisionCriteria', 'featureComparisonFacts', 'pricingComparisonFacts', 'sourceMap', 'internalLinks'],
    optionalFields: ['sharedUseCases'],
    forbiddenFields: ['categoryContext', 'relatedCategories', 'representativeTools', 'selectedTools', 'toolFacts', 'tutorialGoal', 'prerequisiteKnowledge', 'workflowContext', 'commonMistakes', 'outputChecklist', 'relatedTools', 'alternativeTools', 'reasonToSwitch', 'comparisonDimensions', 'pricingSummary', 'socialLinks', 'companyInfo'],
    minTools: 2,
    maxTools: 2,
    maxSources: 20,
    minCriteria: 6,
    sourceSelectionRule: 'Exactly primary and secondary tools; only sources for aligned comparison facts and qualitative pricing.',
  },
  ALTERNATIVE: {
    requiredFields: ['pageType', 'contentType', 'primaryTool', 'alternativeTools', 'reasonToSwitch', 'selectionCriteria', 'comparisonDimensions', 'pricingSummary', 'sourceMap', 'internalLinks'],
    optionalFields: [],
    forbiddenFields: ['categoryContext', 'relatedCategories', 'representativeTools', 'selectedTools', 'toolFacts', 'decisionCriteria', 'tutorialGoal', 'prerequisiteKnowledge', 'workflowContext', 'commonMistakes', 'outputChecklist', 'relatedTools', 'secondaryTool', 'comparisonIntent', 'targetAudience', 'sharedUseCases', 'featureComparisonFacts', 'pricingComparisonFacts', 'socialLinks', 'companyInfo'],
    minTools: 3,
    maxTools: 9,
    minAlternativeTools: 2,
    maxAlternativeTools: 8,
    maxSources: 30,
    minCriteria: 5,
    sourceSelectionRule: 'Primary plus two to eight explicit alternatives; sources must belong to retained tool, pricing, platform, or relevant claim facts.',
  },
}

function hasValue(value) {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

function selectedToolsFor(type, input) {
  if (type === 'BUYER_GUIDE') return input.selectedTools || []
  if (type === 'CATEGORY_GUIDE') return input.representativeTools || []
  if (type === 'TUTORIAL') return [input.primaryTool, ...(input.relatedTools || [])].filter(Boolean)
  if (type === 'COMPARISON') return [input.primaryTool, input.secondaryTool].filter(Boolean)
  if (type === 'ALTERNATIVE') return [input.primaryTool, ...(input.alternativeTools || [])].filter(Boolean)
  return []
}

export function getInputContractDefinition(contentType) {
  return CONTRACTS[String(contentType || '').toUpperCase()] || null
}

export function enforceInputContract(contentType, candidate) {
  const type = String(contentType || '').toUpperCase()
  const definition = getInputContractDefinition(type)
  if (!definition) throw new Error(`unsupportedInputContract: ${type || '(empty)'}`)

  const allowed = new Set([...definition.requiredFields, ...definition.optionalFields])
  const forbiddenFieldsRemoved = Object.keys(candidate || {}).filter(key => !allowed.has(key))
  const input = Object.fromEntries(Object.entries(candidate || {}).filter(([key]) => allowed.has(key)))
  const allowEmpty = new Set(definition.allowEmptyFields || [])
  const missingRequiredFields = definition.requiredFields.filter(field => (
    allowEmpty.has(field) ? !Object.prototype.hasOwnProperty.call(input, field) : !hasValue(input[field])
  ))
  const selectedTools = selectedToolsFor(type, input)
  const inputWarnings = []

  if (selectedTools.length < definition.minTools) {
    missingRequiredFields.push(type === 'ALTERNATIVE' ? 'alternativeTools' : 'selectedToolsCount')
  }
  if (selectedTools.length > definition.maxTools) inputWarnings.push(`selected tools truncated expectation exceeded: ${selectedTools.length}/${definition.maxTools}`)
  if (type === 'ALTERNATIVE') {
    const count = input.alternativeTools?.length || 0
    if (count < definition.minAlternativeTools) missingRequiredFields.push('alternativeToolsCount')
    if (count > definition.maxAlternativeTools) inputWarnings.push(`alternativeTools exceeds ${definition.maxAlternativeTools}`)
  }
  const criteria = type === 'ALTERNATIVE' ? input.selectionCriteria : input.decisionCriteria
  if (definition.minCriteria && (criteria?.length || 0) < definition.minCriteria) {
    missingRequiredFields.push(type === 'ALTERNATIVE' ? 'selectionCriteriaCount' : 'decisionCriteriaCount')
  }
  if ((input.sourceMap?.length || 0) > definition.maxSources) inputWarnings.push(`sourceMap exceeds ${definition.maxSources}`)

  const dedupedMissing = [...new Set(missingRequiredFields)]
  return {
    input,
    validation: {
      inputContractType: type,
      selectedTools: selectedTools.map(tool => ({ id: tool.id, handle: tool.handle || tool.slug, name: tool.name })),
      missingRequiredFields: dedupedMissing,
      forbiddenFieldsRemoved,
      sourceMapCount: input.sourceMap?.length || 0,
      inputWarnings,
      contract: {
        requiredFields: definition.requiredFields,
        optionalFields: definition.optionalFields,
        forbiddenFields: definition.forbiddenFields,
        maxToolsCount: definition.maxTools,
        maxSourcesCount: definition.maxSources,
        sourceSelectionRule: definition.sourceSelectionRule,
      },
      passed: dedupedMissing.length === 0 && selectedTools.length <= definition.maxTools && (input.sourceMap?.length || 0) <= definition.maxSources,
    },
  }
}

export function validateInputContractPayload(input) {
  return enforceInputContract(input?.contentType, input).validation
}
