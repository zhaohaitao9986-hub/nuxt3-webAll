import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import { getContentGenerationTask, updateContentGenerationTask } from '~/server/services/contentGeneration/taskStore'
import { prepareDeterministicBrief } from '~/server/services/contentGeneration/briefBuilder'
import { buildContentSourceData } from '~/server/services/contentGeneration/sourceBuilder'
import { validateSourceData } from '~/server/services/contentGeneration/validators'
import { uniqueContentGenerationSlug } from '~/server/services/contentGeneration/slugUtils'

function normalizeOptionalCategoryId(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

export default defineEventHandler(async (event) => {
  const auth = assertAnyAdmin(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event).catch(() => ({}))
  const task = await getContentGenerationTask(id)
  if (!task) throw createError({ statusCode: 404, statusMessage: '任务不存在' })

  try {
    const contentType = String(body?.contentType || task.contentType || '').toUpperCase()
    const isComparison = contentType === 'COMPARISON'
    const categoryIdBefore = task.categoryId ?? null
    const manualCategoryId = body?.lockCategory === true
      ? normalizeOptionalCategoryId(body?.categoryId)
      : null

    const seedTask = {
      ...task,
      contentType,
      categoryId: isComparison ? null : (normalizeOptionalCategoryId(body?.categoryId) ?? task.categoryId),
      categoryIdBefore,
      manualCategoryId: isComparison ? manualCategoryId : null,
      toolId: body?.primaryToolId || task.toolId,
      promptJson: {
        ...(task.promptJson || {}),
        brief: {
          ...(task.promptJson?.brief || {}),
          ...(body?.secondaryToolId ? { secondaryToolId: body.secondaryToolId } : {}),
        },
      },
    }
    const brief = await prepareDeterministicBrief(seedTask)
    const resolvedCategoryId = brief.resolvedCategoryId
      ?? (isComparison ? null : (normalizeOptionalCategoryId(body?.categoryId) ?? task.categoryId))

    const preparedSlug = await uniqueContentGenerationSlug(brief.slug || brief.targetKeyword || brief.title || task.slug, {
      contentType: seedTask.contentType,
      excludeTaskId: id,
    })
    const preparedTitle = String(brief.title || task.title || '').trim()
    const updated = await updateContentGenerationTask(id, {
      title: preparedTitle,
      slug: preparedSlug,
      contentType: seedTask.contentType,
      categoryId: resolvedCategoryId,
      toolId: brief.primaryToolId || task.toolId || null,
      promptJson: {
        ...(task.promptJson || {}),
        brief,
        briefPreparedAt: new Date().toISOString(),
        briefPreparedBy: 'deterministic-rules',
        categoryIdBefore,
        categoryIdAfter: resolvedCategoryId,
      },
      sourceDataJson: null,
      validationJson: null,
      errorMessage: '',
      rejectReason: '',
      contentJson: null,
      generatedContent: null,
      finalContent: null,
      rawOutput: '',
    }, auth)
    const sourceData = await buildContentSourceData({ ...updated, contentType: updated.contentType.toUpperCase() })
    const validation = validateSourceData(sourceData)
    return {
      task: updated,
      brief,
      categorySelection: brief.categorySelection || null,
      categoryIdBefore,
      categoryIdAfter: resolvedCategoryId,
      inputSummary: {
        inputContractType: validation.inputContract?.inputContractType || sourceData.contentType,
        selectedTools: validation.inputContract?.selectedTools || [],
        sourceMapCount: validation.inputContract?.sourceMapCount || 0,
        selectedToolStrategy: sourceData.selectedToolStrategy || null,
        missingRequiredFields: validation.inputContract?.missingRequiredFields || [],
        inputWarnings: validation.inputContract?.inputWarnings || [],
        contractPassed: Boolean(validation.ok && validation.inputContract?.passed),
        briefSource: 'content_generation_tasks.prompt_json.brief',
      },
    }
  }
  catch (error) {
    const message = error?.statusMessage || error?.message || String(error)
    await updateContentGenerationTask(id, { errorMessage: message }, auth).catch(() => {})
    throw error
  }
})
