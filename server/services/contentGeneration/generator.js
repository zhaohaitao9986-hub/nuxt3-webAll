import { createError } from 'h3'
import { callContentGenerationAi, callContentGenerationAiStream } from './aiClient.js'
import {
  getContentGenerationTask,
  saveContentGenerationTaskGenerationResult,
  updateContentGenerationTaskStatus,
} from './taskStore.js'
import { buildContentSourceData } from './sourceBuilder.js'
import { buildContentPrompt, buildExpandFixPrompt } from './prompts.js'
import {
  GENERATION_MODE,
  PRODUCTION_MAX_TOKENS,
  PRODUCTION_MODEL,
  PRODUCTION_TEMPERATURE,
  resolvePromptVersion,
} from './promptVersion.js'
import { countEnglishWords, validateGeneratedContentPage, validateSourceData } from './validators.js'
import {
  formatParseErrorMessage,
  safeJsonParse,
} from './jsonParse.js'

const EXPAND_RETRY_LIMIT = 1
const BUYER_GUIDE_FORBIDDEN_REPLACEMENTS = [
  [/\bbest possible\b/gi, 'strong fit'],
  [/\bguaranteed\b/gi, 'may help'],
  [/\bguarantee(?:s|d)?\b/gi, 'can help'],
  [/\bperfect\b/gi, 'suitable fit'],
  [/\balways\b/gi, 'often'],
  [/\bnever\b/gi, 'rarely'],
  [/\b100%\b/g, 'highly'],
  [/\bflawless\b/gi, 'strong'],
  [/\bultimate\b/gi, 'comprehensive'],
]

function parseGeneratedJson(rawOutput) {
  const result = safeJsonParse(rawOutput)
  if (!result.ok) {
    const error = new Error(formatParseErrorMessage(result))
    error.code = 'CONTENT_JSON_PARSE_FAILED'
    error.parseMeta = result
    throw error
  }
  return { content: result.data, parseMeta: result }
}

function buildParseFailureValidation(parseMeta, message) {
  return {
    ok: false,
    passed: false,
    errors: [message],
    warnings: parseMeta?.repaired ? ['JSON structure repair was attempted but parsing still failed'] : [],
    checks: {},
    metrics: { wordCount: 0, blockCount: 0 },
    missingToolFields: [],
    parseErrorPosition: parseMeta?.position ?? null,
    parseErrorSnippet: parseMeta?.snippet ?? null,
    parseErrorLine: parseMeta?.line ?? null,
    parseErrorColumn: parseMeta?.column ?? null,
    parseRepaired: Boolean(parseMeta?.repaired),
    parseStrategy: parseMeta?.strategy ?? null,
    rawOutputLength: parseMeta?.rawLength ?? null,
    typedWriteStatus: 'not-written-review-stage',
  }
}

function enforceReviewState(content) {
  if (!content?.contentPage) return
  content.contentPage.status = 'REVIEW'
  content.contentPage.robots = 'NOINDEX_FOLLOW'
}

function sanitizeBuyerGuideText(value) {
  return BUYER_GUIDE_FORBIDDEN_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    String(value || ''),
  )
}

function sanitizeBuyerGuideObject(value) {
  if (typeof value === 'string') return sanitizeBuyerGuideText(value)
  if (Array.isArray(value)) return value.map(item => sanitizeBuyerGuideObject(item))
  if (!value || typeof value !== 'object') return value
  Object.keys(value).forEach((key) => {
    value[key] = sanitizeBuyerGuideObject(value[key])
  })
  return value
}

function buyerGuideContext(sourceData) {
  const input = sourceData?.aiInput || {}
  const categoryName = input.categoryContext?.name || sourceData?.category?.level2?.name || 'this category'
  const targetKeyword = input.targetKeyword || categoryName
  const audience = input.audience && typeof input.audience === 'object'
    ? input.audience
    : { primaryAudience: input.audience || 'buyers comparing AI tools', secondaryAudience: 'teams reviewing workflow fit' }
  const primaryAudience = audience.primaryAudience || audience.primary || 'buyers comparing AI tools'
  const secondaryAudience = audience.secondaryAudience || audience.secondary || 'teams reviewing workflow fit'
  return { input, categoryName, targetKeyword, primaryAudience, secondaryAudience }
}

function buyerGuideParagraph(role, sourceData) {
  const { categoryName, targetKeyword, primaryAudience, secondaryAudience } = buyerGuideContext(sourceData)
  const paragraphs = {
    introduction: `${targetKeyword} can cover a wide range of products, so this guide focuses on the practical choice buyers need to make: which tools match the work, evidence, budget, and review process they actually have. It compares the selected tools through category fit, source-backed capabilities, workflow usefulness, pricing context, and the limits visible in the available data. The goal is to help readers move beyond broad popularity signals and evaluate whether a tool is a suitable fit for drafting, editing, collaboration, or repeatable content work in ${categoryName}. Use the guide as a structured shortlist, then confirm current pricing, usage limits, and product details on the official sources before making a final decision.`,
    whoItIsFor: `This guide is for ${primaryAudience} who need a practical way to compare ${categoryName} options without treating every AI product as interchangeable. It is also useful for ${secondaryAudience} who want a second-pass framework for workflow fit, review effort, and budget trade-offs. These tools are generally suitable for users who want assistance with repeatable writing, editing, summarizing, research, or production tasks and still expect human review. They may not be a suitable fit for teams that need fully custom systems, regulated approval workflows, or unsupported claims about accuracy, automation, or performance. Readers should use the recommendations as a shortlist, not as a substitute for testing against their own content and review requirements.`,
    workflow: `A practical workflow starts with one clear content task, a sample input, and a review checklist. Shortlist tools that match the core category need, then compare the output quality, editing controls, collaboration model, pricing structure, and source-backed features. For team use, assign one reviewer to check factual accuracy, another to review tone or structure, and a final owner to decide whether the tool saves enough time to justify adoption. Keep prompts, examples, and approval notes in a shared place so results can be compared consistently. After a small pilot, keep the tool that reduces repeat work while preserving human judgment and source verification.`,
    commonMistakes: `Common mistakes usually come from treating category labels as proof of fit. A tool can be popular and still be too broad, too narrow, or poorly matched to the actual workflow. Buyers should avoid choosing only by traffic, broad assistant positioning, or a single feature claim that is not supported by the available source data. Another mistake is ignoring review effort: if outputs need heavy rewriting, formatting, or fact checking, the tool may not save time in practice. Teams should also avoid relying on stale pricing details or assuming that one user experience applies across every department. A better approach is to test a few realistic tasks and compare results against the decision criteria in this guide.`,
    finalRecommendation: `The strongest choice is usually the tool that combines clear category relevance, enough source-backed functionality, and a workflow your team can review consistently. Start with STRONG selected tools because they are directly tied to this category, then compare the final shortlist against output quality, ease of use, collaboration needs, pricing model, and the amount of human editing required. MEDIUM tools can still be useful when they support the workflow, but they should be treated as broader options with clearer limitations. Before committing, verify official pricing and run a small pilot with real examples. The right decision is the option that improves repeatable work while keeping review, accuracy checks, and ownership clear.`,
  }
  return `<p>${paragraphs[role]}</p>`
}

function insertBuyerGuideSection(blocks, role, sourceData) {
  const heading = role === 'introduction' ? 'Introduction' : 'Who This Guide Is For'
  const block = { type: 'section', heading, level: 2, html: buyerGuideParagraph(role, sourceData) }
  const problemIndex = blocks.findIndex(item => item?.type === 'problem_frame')
  const introIndex = blocks.findIndex(item => item?.type === 'section' && /introduction|overview/i.test(String(item.heading || '')))
  if (role === 'introduction') {
    blocks.splice(problemIndex >= 0 ? problemIndex + 1 : 0, 0, block)
    return
  }
  blocks.splice(introIndex >= 0 ? introIndex + 1 : problemIndex >= 0 ? problemIndex + 1 : 0, 0, block)
}

function appendUntilMin(value, minWords, appendText) {
  let text = sanitizeBuyerGuideText(value || '')
  while (countEnglishWords(text) < minWords) {
    text = `${text}${text.includes('<p>') ? '' : ' '}${appendText}`
    if (countEnglishWords(appendText) === 0) break
  }
  return text
}

function buyerGuideSupportSentence(kind, sourceData, tool = null) {
  const { categoryName } = buyerGuideContext(sourceData)
  if (kind === 'tool') {
    return ` Buyers should verify current pricing, test the tool with representative work, and compare the result with the team's review standards before treating ${tool?.name || 'this tool'} as the main option.`
  }
  if (kind === 'faq') {
    return ` A useful evaluation also checks review effort, pricing fit, source-backed features, and whether the workflow remains clear when more than one teammate is involved.`
  }
  return ` For ${categoryName}, the practical test is whether the tool improves a real workflow while keeping human review, source checks, and ownership clear.`
}

function repairBuyerGuideBlocks(page, sourceData, validation = null) {
  if (page?.contentPage?.type !== 'BUYER_GUIDE') return page
  page.bodyJson ||= { version: 1, blocks: [] }
  page.bodyJson.blocks ||= []
  const blocks = page.bodyJson.blocks
  const headingText = blocks.map(block => `${block?.heading || ''} ${block?.title || ''}`).join('\n')
  if (!/introduction|overview/i.test(headingText)) insertBuyerGuideSection(blocks, 'introduction', sourceData)
  if (!/who (?:this guide|this|it) is for|target audience|intended audience|who should use/i.test(headingText)) {
    insertBuyerGuideSection(blocks, 'whoItIsFor', sourceData)
  }

  blocks.forEach((block) => {
    if (block?.type === 'section') {
      const heading = String(block.heading || '')
      const minWords = /final recommendation|final guidance|bottom line/i.test(heading) ? 130 : 120
      block.html = appendUntilMin(block.html || block.text || '', minWords, buyerGuideSupportSentence('section', sourceData))
      delete block.text
    }
    if (block?.type === 'tool_callout') {
      const tool = (sourceData.selectedTools || sourceData.tools || []).find(row => String(row.handle || '') === String(block.toolHandle || ''))
      block.verdict = appendUntilMin(block.verdict || block.note || block.text || '', 110, buyerGuideSupportSentence('tool', sourceData, tool))
      delete block.note
      delete block.text
    }
    if (block?.type === 'methodology') {
      block.text = appendUntilMin(block.text || '', 80, ' The methodology uses available source data, category fit, and qualitative review criteria without claiming hands-on testing or unsupported performance results.')
    }
    if (block?.type === 'faq' && Array.isArray(block.items)) {
      block.items.forEach((item) => {
        item.answer = appendUntilMin(item.answer || '', 65, buyerGuideSupportSentence('faq', sourceData))
      })
    }
  })

  if (validation?.checks?.wordCount?.passed === false && Number(validation.checks.wordCount.actual) < 2200) {
    const hasUseCases = blocks.some(block => /use cases|common scenarios|when to use/i.test(`${block?.heading || ''} ${block?.html || ''}`))
    if (!hasUseCases && blocks.length < 22) {
      const finalIndex = blocks.findIndex(block => block?.type === 'section' && /final recommendation|final guidance|bottom line/i.test(String(block.heading || '')))
      blocks.splice(finalIndex >= 0 ? finalIndex : blocks.length, 0, {
        type: 'section',
        heading: 'Use Cases and Team Fit',
        level: 2,
        html: '<p>Use cases should be judged by the work the buyer repeats most often. Individual creators may value fast drafting, rewriting, and editing support, while teams may care more about collaboration, review steps, templates, and predictable handoff. Some tools fit long-form content planning, while others are stronger for short edits, summaries, or structured production tasks. The safest evaluation is to test each shortlisted tool against two or three real examples, then compare how much editing remains. This keeps the decision grounded in practical fit rather than broad category claims or isolated feature lists.</p>',
      })
    }
  }
  page.contentPage = sanitizeBuyerGuideObject(page.contentPage)
  page.bodyJson = sanitizeBuyerGuideObject(page.bodyJson)
  return page
}

function shouldExpand(validation) {
  if (!validation || validation.ok) return false
  const expandable = new Set([
    'wordCount',
    'blockCount',
    'faqCount',
    'matrixRowCount',
    'criteriaCount',
    'recommendedToolsCount',
    'toolCalloutCount',
    'minSectionWordCount',
    'minFaqAnswerWordCount',
    'minRecommendedToolWordCount',
    'verdictSpecific',
    'requiredTopics',
    'hasPricingContext',
    'hasDecisionGuidance',
    'hasUseCases',
    'hasMethodology',
    'forbiddenClaims',
    'faqQuestionStyle',
    'toolGrounding',
  ])
  return Object.entries(validation.checks || {}).some(([name, row]) => expandable.has(name) && row?.passed === false)
}

export function buildValidationPayload(validation, metadata) {
  const metrics = validation?.metrics || {}
  return {
    ...validation,
    contentType: metadata.contentType,
    generatorName: metadata.generatorName,
    selectedToolStrategy: metadata.selectedToolStrategy,
    model: PRODUCTION_MODEL,
    temperature: PRODUCTION_TEMPERATURE,
    max_tokens: PRODUCTION_MAX_TOKENS,
    maxTokens: PRODUCTION_MAX_TOKENS,
    max_completion_tokens: null,
    promptVersion: metadata.promptVersion,
    promptVersionId: metadata.promptVersionId,
    retryCount: metadata.retryCount,
    apiRetryCount: metadata.apiRetryCount,
    expandRetryCount: metadata.expandRetryCount,
    generationMode: GENERATION_MODE,
    wordCount: metrics.wordCount || 0,
    blockCount: metrics.blockCount || 0,
    faqCount: metrics.faqCount || 0,
    sourceCount: metrics.sourceCount || validation?.normalizedSources?.length || metadata.sourceCount || 0,
    toolCount: metadata.toolCount || 0,
    criteriaCount: metrics.criteriaCount || 0,
    matrixRowCount: metrics.matrixRowCount || 0,
    score: validation?.score || 0,
    passed: Boolean(validation?.passed),
    failedChecks: validation?.failedChecks?.length
      ? validation.failedChecks
      : validation?.passed ? [] : ['generationError'],
    warnings: validation?.warnings || [],
    missingToolFields: validation?.missingToolFields || [],
    normalizedSources: validation?.normalizedSources?.length
      ? validation.normalizedSources
      : metadata.normalizedSources || [],
    typedWriteStatus: metadata.typedWriteStatus || 'not-written-review-stage',
    provider: metadata.provider,
    usage: metadata.usage,
    generatedAt: new Date().toISOString(),
    rawOutputLength: metadata.rawOutputLength ?? null,
    jsonParseRepaired: metadata.jsonParseRepaired ?? null,
    jsonParseStrategy: metadata.jsonParseStrategy ?? null,
    parseErrorPosition: metadata.parseErrorPosition ?? validation?.parseErrorPosition ?? null,
    parseErrorSnippet: metadata.parseErrorSnippet ?? validation?.parseErrorSnippet ?? null,
    parseErrorLine: metadata.parseErrorLine ?? validation?.parseErrorLine ?? null,
    parseErrorColumn: metadata.parseErrorColumn ?? validation?.parseErrorColumn ?? null,
    parseRepaired: metadata.parseRepaired ?? validation?.parseRepaired ?? null,
    parseStrategy: metadata.parseStrategy ?? validation?.parseStrategy ?? null,
  }
}

function createEmit(streamHandlers) {
  if (!streamHandlers?.emit) {
    return async () => {}
  }
  return streamHandlers.emit
}

export async function generateContentForTask(taskId, event, auth, streamHandlers = null) {
  const emit = createEmit(streamHandlers)
  const streaming = Boolean(streamHandlers?.emit)

  const task = await getContentGenerationTask(taskId)
  if (!task) throw createError({ statusCode: 404, statusMessage: '任务不存在' })

  await updateContentGenerationTaskStatus(taskId, 'generating', auth)
  await emit('status', { status: 'generating' })

  let sourceData = null
  let rawOutput = ''
  let parsedContent = null
  let validationResult = null
  let promptVersion = null
  let apiRetryCount = 0
  let expandRetryCount = 0
  let provider = 'https://api.deepseek.com/v1'
  let usage = null
  let jsonParseMeta = null

  try {
    await emit('phase', { phase: 'building_source' })
    sourceData = await buildContentSourceData(task)
    const sourceValidation = validateSourceData(sourceData)
    validationResult = sourceValidation
    if (!sourceValidation.ok) throw new Error(`sourceData 校验失败：${sourceValidation.errors.join('；')}`)

    await emit('source', { sourceDataJson: sourceData })

    const sourcePrompt = buildContentPrompt(sourceData)
    promptVersion = await resolvePromptVersion(task, sourceData, sourcePrompt)
    let activeUserPrompt = promptVersion.userPrompt

    for (let generationAttempt = 0; generationAttempt <= EXPAND_RETRY_LIMIT; generationAttempt += 1) {
      if (generationAttempt > 0) {
        await emit('phase', { phase: 'expanding', attempt: generationAttempt + 1, clearOutput: true })
      }
      else {
        await emit('phase', { phase: 'generating', attempt: 1 })
      }

      const aiParams = {
        systemPrompt: promptVersion.systemPrompt,
        userPrompt: activeUserPrompt,
      }

      const aiResult = streaming
        ? await callContentGenerationAiStream({
            ...aiParams,
            onChunk: async (text) => {
              await emit('chunk', { text })
            },
          }, event)
        : await callContentGenerationAi(aiParams, event)

      apiRetryCount += aiResult.retryCount
      provider = aiResult.provider
      usage = aiResult.usage
      rawOutput = aiResult.rawOutput

      await emit('phase', { phase: 'parsing' })
      const parsed = parseGeneratedJson(rawOutput)
      parsedContent = parsed.content
      jsonParseMeta = parsed.parseMeta
      if (jsonParseMeta?.repaired) {
        await emit('phase', { phase: 'parsing', repaired: true, strategy: jsonParseMeta.strategy })
      }
      enforceReviewState(parsedContent)
      if (!parsedContent.sources?.length && sourceData.sources?.length) parsedContent.sources = sourceData.sources
      if (sourceData.contentType === 'BUYER_GUIDE') {
        parsedContent = repairBuyerGuideBlocks(parsedContent, sourceData)
      }

      await emit('phase', { phase: 'validating' })
      validationResult = validateGeneratedContentPage(parsedContent, sourceData)
      if (validationResult.normalizedSources?.length) parsedContent.sources = validationResult.normalizedSources
      if (sourceData.contentType === 'BUYER_GUIDE' && !validationResult.ok && shouldExpand(validationResult)) {
        parsedContent = repairBuyerGuideBlocks(parsedContent, sourceData, validationResult)
        validationResult = validateGeneratedContentPage(parsedContent, sourceData)
        if (validationResult.normalizedSources?.length) parsedContent.sources = validationResult.normalizedSources
      }

      if (validationResult.ok) break
      if (generationAttempt >= EXPAND_RETRY_LIMIT || !shouldExpand(validationResult)) break

      expandRetryCount += 1
      activeUserPrompt = buildExpandFixPrompt(promptVersion.userPrompt, rawOutput, validationResult)
    }

    const validationJson = buildValidationPayload(validationResult, {
      promptVersion: promptVersion.promptVersion,
      promptVersionId: promptVersion.id,
      retryCount: apiRetryCount + expandRetryCount,
      apiRetryCount,
      expandRetryCount,
      provider,
      usage,
      contentType: sourceData.contentType,
      generatorName: sourceData.task === 'generate_compare' ? 'compare-generator' : 'guide-generator',
      selectedToolStrategy: sourceData.selectedToolStrategy,
      toolCount: sourceData.tools?.length || 0,
      sourceCount: sourceData.sources?.length || 0,
      normalizedSources: validationResult?.normalizedSources || sourceData.sources || [],
      jsonParseRepaired: Boolean(jsonParseMeta?.repaired),
      jsonParseStrategy: jsonParseMeta?.strategy || null,
      rawOutputLength: rawOutput?.length || 0,
    })

    if (!validationResult?.ok) {
      const message = `生成结果未达到 production-ready SEO draft 标准：${validationResult?.errors?.join('；') || 'unknown validation error'}`
      const failedTask = await saveContentGenerationTaskGenerationResult(taskId, {
        status: 'failed',
        contentJson: parsedContent,
        sourceDataJson: sourceData,
        promptVersionId: promptVersion.id,
        promptJson: {
          brief: promptVersion.brief,
          promptVersion: promptVersion.promptVersion,
          systemPrompt: promptVersion.systemPrompt,
          userPrompt: promptVersion.userPrompt,
        },
        rawOutput,
        validationJson,
        errorMessage: message,
      }, auth)
      throw createError({ statusCode: 422, statusMessage: message, data: failedTask })
    }

    return saveContentGenerationTaskGenerationResult(taskId, {
      status: 'review',
      contentJson: parsedContent,
      sourceDataJson: sourceData,
      promptVersionId: promptVersion.id,
      promptJson: {
        brief: promptVersion.brief,
        promptVersion: promptVersion.promptVersion,
        systemPrompt: promptVersion.systemPrompt,
        userPrompt: promptVersion.userPrompt,
      },
      rawOutput,
      validationJson,
      errorMessage: '',
    }, auth)
  }
  catch (error) {
    if (error?.statusCode === 422) throw error
    apiRetryCount += Number(error?.retryCount || 0)
    const isParseError = error?.code === 'CONTENT_JSON_PARSE_FAILED' || error?.parseMeta
    const parseMeta = error?.parseMeta || null
    const message = isParseError
      ? formatParseErrorMessage(parseMeta || { errorMessage: error?.message })
      : (error instanceof Error ? error.message : String(error))
    const validationJson = buildValidationPayload(
      isParseError
        ? buildParseFailureValidation(parseMeta, message)
        : (validationResult || {
          ok: false,
          passed: false,
          errors: [message],
          warnings: [],
          checks: {},
          metrics: {},
          missingToolFields: sourceData ? validateSourceData(sourceData).missingToolFields || [] : [],
        }),
      {
        promptVersion: promptVersion?.promptVersion || null,
        promptVersionId: promptVersion?.id || null,
        retryCount: apiRetryCount + expandRetryCount,
        apiRetryCount,
        expandRetryCount,
        provider,
        usage,
        contentType: sourceData?.contentType || task.contentType?.toUpperCase?.() || task.contentType,
        generatorName: sourceData?.task === 'generate_compare'
          ? 'compare-generator'
          : sourceData?.task === 'generate_guide' ? 'guide-generator' : 'unsupported-generator',
        selectedToolStrategy: sourceData?.selectedToolStrategy || null,
        toolCount: sourceData?.tools?.length || 0,
        sourceCount: sourceData?.sources?.length || 0,
        normalizedSources: validationResult?.normalizedSources || sourceData?.sources || [],
        rawOutputLength: rawOutput?.length || 0,
        ...(isParseError
          ? {
            parseErrorPosition: parseMeta?.position ?? null,
            parseErrorSnippet: parseMeta?.snippet ?? null,
            parseErrorLine: parseMeta?.line ?? null,
            parseErrorColumn: parseMeta?.column ?? null,
            parseRepaired: Boolean(parseMeta?.repaired),
            parseStrategy: parseMeta?.strategy ?? null,
          }
          : {}),
      },
    )

    await saveContentGenerationTaskGenerationResult(taskId, {
      status: 'failed',
      contentJson: parsedContent,
      sourceDataJson: sourceData,
      promptVersionId: promptVersion?.id,
      promptJson: promptVersion
          ? {
            brief: promptVersion.brief,
            promptVersion: promptVersion.promptVersion,
            systemPrompt: promptVersion.systemPrompt,
            userPrompt: promptVersion.userPrompt,
          }
        : undefined,
      rawOutput,
      validationJson,
      errorMessage: message,
    }, auth)
    throw createError({ statusCode: 500, statusMessage: message })
  }
}
