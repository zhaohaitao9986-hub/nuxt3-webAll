import {
  COMPARE_PRODUCTION_PROMPT_VERSION,
  FORBIDDEN_CLAIM_LABELS,
  META_LIMITS,
  PRODUCTION_LIMITS,
  PRODUCTION_PROMPT_VERSION,
  QUALITATIVE_PRICING_POLICY,
  contentRules,
} from './editorialRules.js'
import {
  ALTERNATIVE_RESPONSE_SHAPE,
  COMPARE_RESPONSE_SHAPE,
  GUIDE_RESPONSE_SHAPE,
} from './responseSchemas.js'

export const JSON_OUTPUT_RULES = [
  'Return only valid JSON. Do not use markdown fences such as ```json.',
  'All object keys must be double-quoted. Do not use single-quoted keys.',
  'Do not include trailing commas after the last item in objects or arrays.',
  'Escape double quotes and control characters inside JSON string values.',
  'Do not include explanations, comments, or text outside the JSON object.',
  'The first non-whitespace character must be { and the last must be }.',
  'Ensure the JSON object is complete and closed before finishing the response.',
]

export const editorialSystemPrompt = [
  'You are the production editorial content generation engine for AISeekTools.',
  'You create production-ready SEO drafts for Nuxt and Prisma-backed content pages.',
  'A REVIEW status means the draft awaits human approval; it does not permit thin, placeholder, test, or outline content.',
  'Be factual, conservative, source-grounded, specific, and useful to buyers making a decision.',
  'Return exactly one valid JSON object and no surrounding text.',
  ...JSON_OUTPUT_RULES,
  'If source data is insufficient for a claim, omit or clearly qualify the claim.',
  `Never use unsupported absolute phrases: ${FORBIDDEN_CLAIM_LABELS.join(', ')}.`,
  QUALITATIVE_PRICING_POLICY,
  'Set contentPage.status to REVIEW and contentPage.robots to NOINDEX_FOLLOW.',
].join('\n')

const TASK_INSTRUCTIONS = {
  BUYER_GUIDE: [
    'Help the stated audience choose among selectedTools using the supplied decisionCriteria.',
    'Recommend only selectedTools and ground every recommendation in the matching toolFacts entry.',
    'Only recommend tools from selectedTools in tool_callout blocks.',
    'Do not introduce tools outside selectedTools except in a clearly labeled alternatives/fallback section when fallbackTools are supplied.',
    'Fallback tools are related alternatives only; they must not be framed as primary recommendations.',
    'Prioritize tools with STRONG relevance. If a MEDIUM tool is used, explain its limitation clearly.',
    'Each selectedTools item includes categoryRelevanceScore, relevanceLabel, matchedCategories, and selectionReason; use those fields to justify fit.',
  ],
  CATEGORY_GUIDE: [
    'Explain the category using categoryContext as the primary evidence.',
    'Use representativeTools only as concise examples; do not turn the page into a ranked buyer list.',
    'Tool callouts are optional and must not be forced to five items.',
  ],
  TUTORIAL: [
    'Teach the exact tutorialGoal using the supplied workflowContext in order.',
    'Do not invent product steps or substitute generic category guidance.',
    'The primaryTool is the workflow anchor; relatedTools are optional supporting references, not recommendations.',
  ],
  COMPARISON: [
    'Compare exactly primaryTool and secondaryTool for comparisonIntent and targetAudience.',
    'Do not introduce other tools as comparison subjects.',
  ],
  ALTERNATIVE: [
    'Explain alternatives to primaryTool for the supplied reasonToSwitch.',
    'Recommend only alternativeTools and use selectionCriteria and comparisonDimensions for trade-offs.',
    'Do not model the first alternative as a secondaryTool.',
  ],
}

function guideRulesFor(contentType) {
  if (contentType === 'BUYER_GUIDE') return contentRules.buyerGuide
  return {
    ...contentRules.guides,
    requirements: contentRules.guides.requirements.filter(rule => !/Recommend at least 5|tool_callout|How to choose|Recommended tools/i.test(rule)),
  }
}

export function buildContentPrompt(sourceData) {
  return sourceData.task === 'generate_compare'
    ? buildCompareUserPrompt(sourceData)
    : buildGuideUserPrompt(sourceData)
}

function compactToolSelectionDiagnostics(diagnostics) {
  if (!diagnostics) return null
  const {
    candidateToolCount,
    dedupedCandidateToolCount,
    STRONG,
    MEDIUM,
    WEAK,
    INVALID,
    selectedToolsCount,
    fallbackToolsCount,
    toolSelectionStrategy,
    selectedToolIds,
    fallbackToolIds,
  } = diagnostics
  return {
    candidateToolCount,
    dedupedCandidateToolCount,
    STRONG,
    MEDIUM,
    WEAK,
    INVALID,
    selectedToolsCount,
    fallbackToolsCount,
    toolSelectionStrategy,
    selectedToolIds,
    fallbackToolIds,
  }
}

function buyerGuideBlockPlan(sourceData, source) {
  const selectedTools = source?.selectedTools || sourceData.selectedTools || []
  return {
    totalWordTarget: '2,400-2,600 English words; hard validator range 2,200-2,800',
    requiredBlocksInOrder: [
      {
        type: 'section',
        role: 'introduction',
        headingMustContain: ['Introduction', 'Overview'],
        wordCount: '120-170',
        requirements: [
          'Naturally include targetKeyword once.',
          'Explain the specific buying or selection problem this guide solves.',
          'Do not combine this with the audience section.',
        ],
      },
      {
        type: 'section',
        role: 'whoItIsFor',
        headingMustContain: ['Who This Guide Is For', 'Who It Is For', 'Who Should Use These AI Writing Assistants'],
        wordCount: '120-170',
        requirements: [
          'Name the primaryAudience and secondaryAudience from the input when available.',
          'Explain who is a suitable fit and who may not be a suitable fit.',
          'Do not combine this with the introduction section.',
        ],
      },
      { type: 'key_takeaways' },
      { type: 'problem_frame' },
      { type: 'framework', minimumCriteria: 6 },
      { type: 'tool_callout', count: selectedTools.length, wordCountEach: '110-130', source: 'one for every selectedTools item only' },
      { type: 'decision_tree' },
      { type: 'section', role: 'workflow', headingMustMention: 'Workflow or Implementation Steps', wordCount: '120-170' },
      { type: 'section', role: 'commonMistakes', headingMustMention: 'Common Mistakes or What to Avoid', wordCount: '120-170' },
      { type: 'section', role: 'finalRecommendation', headingMustMention: 'Final Recommendation or Final Guidance', wordCount: '130-170' },
      { type: 'methodology' },
      { type: 'faq', minimumItems: 5, answerWordCountEach: '65-85' },
    ],
    forbiddenClaimReplacements: {
      perfect: 'strong fit / suitable fit / good option',
      guaranteed: 'likely / may / can help',
      always: 'often / generally',
      never: 'rarely / may not',
      '100%': 'highly / largely',
      flawless: 'strong / reliable / suitable',
      ultimate: 'comprehensive / strong',
      'best possible': 'strong fit / suitable fit',
    },
  }
}

export function buildGuideUserPrompt(sourceData) {
  const source = sourceData.contentType === 'BUYER_GUIDE'
    ? {
        ...sourceData.aiInput,
        selectedTools: sourceData.aiInput?.selectedTools || sourceData.selectedTools || [],
        fallbackTools: sourceData.fallbackTools || [],
        toolSelectionDiagnostics: compactToolSelectionDiagnostics(sourceData.toolSelectionDiagnostics),
      }
    : sourceData.aiInput
  const requiresRecommendations = sourceData.contentType === 'BUYER_GUIDE'
  const limits = requiresRecommendations ? PRODUCTION_LIMITS.buyerGuide : PRODUCTION_LIMITS.guide
  return [
    `Generate a ${sourceData.contentType} production-ready SEO draft as JSON.`,
    `Prompt version: ${PRODUCTION_PROMPT_VERSION}.`,
    '',
    'Shared production rules:',
    JSON.stringify(contentRules.shared, null, 2),
    '',
    'Guide production rules:',
    JSON.stringify(guideRulesFor(sourceData.contentType), null, 2),
    '',
    'Content-type task instructions:',
    JSON.stringify(TASK_INSTRUCTIONS[sourceData.contentType], null, 2),
    '',
    'Non-negotiable validation targets:',
    `- ${limits.minWords}-${limits.maxWords} English editorial words`,
    requiresRecommendations
      ? `- target ${limits.targetMinBlocks}-${limits.targetMaxBlocks} body blocks; never exceed ${limits.maxBlocks}`
      : `- ${limits.minBlocks}-${limits.maxBlocks} body blocks`,
    requiresRecommendations
      ? `- exactly ${limits.minRecommendedTools} distinct tool_callout recommendations, each ${limits.minToolNoteWords}-${limits.maxToolNoteWords} words`
      : '- tool_callout blocks are optional; do not manufacture recommendations to meet a buyer-guide quota',
    `- at least ${limits.minFaqItems} FAQ items`,
    requiresRecommendations
      ? `- each section ${limits.minSectionWords}-${limits.maxSectionWords} words`
      : `- each section >= ${limits.minSectionWords} words`,
    requiresRecommendations
      ? `- each FAQ answer ${limits.minFaqAnswerWords}-${limits.maxFaqAnswerWords} words`
      : `- each FAQ answer >= ${limits.minFaqAnswerWords} words`,
    requiresRecommendations
      ? '- total BUYER_GUIDE target is 2,400-2,600 words; do not submit a short 2,000-2,100 word draft'
      : '',
    requiresRecommendations
      ? '- requiredTopics must be visible in headings/text: introduction, whoItIsFor, howToChoose, keyCriteria, recommendedTools, workflow, useCases, commonMistakes, decisionGuidance, finalRecommendation'
      : '',
    requiresRecommendations
      ? '- feature claims must use exact facts from the matching toolFacts.allowedFeatures; raw description is context, not feature evidence'
      : '',
    '- contentPage.status = REVIEW and robots = NOINDEX_FOLLOW',
    '- copy sourceData.sources into output sources',
    '',
    'Block shape reference:',
    JSON.stringify(contentRules.guides.blockSchemas, null, 2),
    '',
    requiresRecommendations
      ? [
          'BUYER_GUIDE required block plan and length contract:',
          JSON.stringify(buyerGuideBlockPlan(sourceData, source), null, 2),
          '',
          'BUYER_GUIDE drafting notes:',
          '- The Introduction block and Who This Guide Is For block must be separate section blocks.',
          '- Include one tool_callout for each selectedTools item, not only five, unless selectedTools has five items.',
          '- FAQ answers below 65 words fail validation; write 65-85 words on the first draft.',
          '- Avoid forbidden claim words in all bodyJson.blocks fields, including section html, FAQ answers, tool_callout verdicts, decision_tree text, and methodology.',
          '',
        ].join('\n')
      : '',
    'Required output shape:',
    JSON.stringify({
      ...GUIDE_RESPONSE_SHAPE.example,
      contentPage: {
        ...GUIDE_RESPONSE_SHAPE.example.contentPage,
        type: sourceData.contentType,
        slug: sourceData.slug,
        canonicalPath: sourceData.canonicalPath,
      },
      tutorialPage: sourceData.contentType === 'TUTORIAL'
        ? { difficulty: 'BEGINNER', prerequisites: [], stepsJson: {}, outcome: 'string' }
        : null,
      categoryContentPage: ['CATEGORY_GUIDE', 'BUYER_GUIDE'].includes(sourceData.contentType)
        ? { level1Id: sourceData.category?.level1?.id ?? null, level2Id: sourceData.category?.level2?.id ?? null }
        : null,
      sources: 'copy sourceData.sources exactly',
    }, null, 2),
    '',
    'Validated AI input contract:',
    JSON.stringify(source, null, 2),
    '',
    'JSON output contract (strict):',
    JSON.stringify(JSON_OUTPUT_RULES, null, 2),
    '',
    'Return strict JSON only. The first character must be { and the last character must be }.',
  ].join('\n')
}

export function buildCompareUserPrompt(sourceData) {
  const source = sourceData.aiInput
  const isComparison = sourceData.contentType === 'COMPARISON'
  const limits = isComparison
    ? { ...PRODUCTION_LIMITS.compare, ...PRODUCTION_LIMITS.comparison }
    : PRODUCTION_LIMITS.compare
  const rules = isComparison ? contentRules.comparison : contentRules.compare
  return [
    `Generate a ${sourceData.contentType} production-ready SEO comparison draft as JSON.`,
    `Prompt version: ${COMPARE_PRODUCTION_PROMPT_VERSION}.`,
    '',
    'Shared production rules:',
    JSON.stringify(contentRules.shared, null, 2),
    '',
    'Compare production rules:',
    JSON.stringify(rules, null, 2),
    '',
    'Content-type task instructions:',
    JSON.stringify(TASK_INSTRUCTIONS[sourceData.contentType], null, 2),
    '',
    'Non-negotiable validation targets:',
    isComparison
      ? `- ${limits.minWords}-${limits.maxWords} English editorial words`
      : `- ideal total length ${limits.idealMinWords}-${limits.idealMaxWords} English editorial words; hard range ${limits.minWords}-${limits.maxWords}`,
    `- ${limits.minBlocks}-${limits.maxBlocks} body blocks`,
    isComparison
      ? `- at least ${limits.minMatrixRows} matrix rows`
      : '- include at least one grounded alternative tool distinct from the primary tool',
    `- at least ${limits.minCriteria} meaningful criteria`,
    `- at least ${limits.minFaqItems} FAQ items`,
    `- each section ${limits.minSectionWords}-${limits.maxSectionWords} words; prefer ${limits.recommendedMinSectionWords}-${limits.maxSectionWords}`,
    `- each FAQ answer ${limits.minFaqAnswerWords}-${limits.maxFaqAnswerWords} words; do not expand already compliant FAQ answers`,
    `- verdict >= ${limits.minVerdictWords} words and scenario-specific`,
    '- Criteria Analysis: 1-2 sentences per dimension. Do not restate matrix rows as long paragraphs.',
    '- Use explicit headings "Best For {primaryTool.name}" and "Best For {secondaryTool.name}" for the two buyer-fit sections.',
    '- Never write guarantee, guaranteed, or guarantee rankings. Use help, support, improve, reduce risk, increase likelihood, may help, is designed to, support SEO workflows, or improve the optimization process.',
    '- contentPage.status = REVIEW and robots = NOINDEX_FOLLOW',
    isComparison
      ? '- comparisonPage.matrixJson must be an array of rows or an object containing a rows array'
      : '- alternativePage.selectionCriteriaJson must be an array or an object containing a criteria array',
    '',
    'Block shape reference:',
    JSON.stringify(rules.blockSchemas, null, 2),
    '',
    'Required output shape:',
    JSON.stringify(buildCompareShapeExample(sourceData), null, 2),
    '',
    'Validated AI input contract:',
    JSON.stringify(source, null, 2),
    '',
    'JSON output contract (strict):',
    JSON.stringify(JSON_OUTPUT_RULES, null, 2),
    '',
    'Return strict JSON only. The first character must be { and the last character must be }.',
  ].join('\n')
}

function buildCompareShapeExample(sourceData) {
  const base = structuredClone(
    sourceData.contentType === 'ALTERNATIVE'
      ? ALTERNATIVE_RESPONSE_SHAPE.example
      : COMPARE_RESPONSE_SHAPE.example,
  )
  base.contentPage.type = sourceData.contentType
  base.contentPage.slug = sourceData.slug
  base.contentPage.canonicalPath = sourceData.canonicalPath
  if (base.comparisonPage) {
    base.comparisonPage.comparisonType = sourceData.comparisonType
    base.comparisonPage.primaryToolId = sourceData.primaryTool?.id || 0
    base.comparisonPage.secondaryToolId = sourceData.secondaryTool?.id || 0
    base.comparisonTools[0].toolId = sourceData.primaryTool?.id || 0
    base.comparisonTools[1].toolId = sourceData.secondaryTool?.id || 0
  }
  if (base.alternativePage) {
    base.alternativePage.primaryToolId = sourceData.primaryTool?.id || 0
    base.alternativeTools[0].toolId = sourceData.aiInput?.alternativeTools?.[0]?.id || 0
  }
  base.sources = 'copy sourceData.sources exactly'
  return base
}

export function applyPromptTemplate(template, sourcePrompt, sourceData) {
  const value = String(template || '').trim()
  const contractJson = JSON.stringify(sourceData.aiInput, null, 2)
  if (!value || value === '{{SOURCE_PROMPT}}') return sourcePrompt
  if (value.includes('{{SOURCE_PROMPT}}')) {
    return value
      .replaceAll('{{SOURCE_PROMPT}}', sourcePrompt)
      .replaceAll('{{SOURCE_DATA_JSON}}', contractJson)
      .replaceAll('{{INPUT_CONTRACT_JSON}}', contractJson)
  }
  return [
    sourcePrompt,
    '',
    'Prompt-version-specific additional instructions:',
    value
      .replaceAll('{{SOURCE_DATA_JSON}}', contractJson)
      .replaceAll('{{INPUT_CONTRACT_JSON}}', contractJson),
  ].join('\n')
}

export function buildExpandFixPrompt(originalPrompt, rawOutput, validation) {
  const fixableChecks = Object.entries(validation?.checks || {})
    .filter(([, check]) => check && check.passed === false && check.expandable !== false)
    .map(([name, check]) => ({ name, actual: check.actual, expected: check.expected }))

  const overBudget = fixableChecks.some(row => (
    (row.name === 'wordCount' || row.name === 'blockCount')
    && Number(row.actual) > Number(String(row.expected).split('-').at(-1))
  ))
  const isCompareFix = ['COMPARISON', 'ALTERNATIVE'].includes(String(
    validation?.inputContractType || validation?.inputContract?.inputContractType || validation?.contentType || '',
  ).toUpperCase())

  return [
    originalPrompt,
    '',
    'REVISION/FIX PASS:',
    'The previous JSON was structurally parseable but failed production validation.',
    'Return one complete replacement JSON object. Preserve identifiers, source grounding, output shape, REVIEW status, and NOINDEX_FOLLOW.',
    overBudget
      ? 'The draft is over budget. Compress repeated explanations, merge overlapping sections, and remove optional blocks while preserving required topics. Do not add detail.'
      : 'Add only the detail needed for failed minimum checks. Do not create duplicate sections or repeat explanations.',
    'Replace forbidden absolute wording with cautious, evidence-based language. Replace perfect with strong fit, suitable fit, or good option; guaranteed with likely, may, or can help; always with often or generally; never with rarely or may not; 100% with highly or largely; flawless with strong or suitable; ultimate with comprehensive or strong; and best possible with strong fit or suitable fit.',
    isCompareFix
      ? 'For Compare revisions, target 1,900-2,300 total words and never exceed 2,500. Keep sections at 90-220 words; do not expand sections already within range. Compress Criteria Analysis to 1-2 sentences per dimension and do not repeat matrix content. Keep FAQ answers at 60-100 words and do not expand compliant FAQs.'
      : 'For BUYER_GUIDE revisions, target 2,400-2,600 total words. If introduction or whoItIsFor is missing, add separate section blocks. Keep every normal section at 120-170 words, every tool_callout at 110-130 words, every FAQ answer at 65-85 words, and Final Recommendation at 130-170 words.',
    'Rewrite ranking-style FAQ questions as evaluation questions such as "How should I evaluate...", "Which factors matter when...", or "When should I choose...".',
    'Remove unsupported feature details. A tool feature may appear only when it is grounded in that tool\'s allowedFeatures or other explicit tool facts.',
    'Fix these checks:',
    JSON.stringify(fixableChecks, null, 2),
    'Validation errors to correct:',
    JSON.stringify(validation?.errors || [], null, 2),
    '',
    'Previous JSON:',
    rawOutput,
  ].join('\n')
}
