import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import { getContentGenerationTask, updateContentGenerationTask } from '~/server/services/contentGeneration/taskStore'
import { prepareDeterministicBrief } from '~/server/services/contentGeneration/briefBuilder'
import { buildContentSourceData } from '~/server/services/contentGeneration/sourceBuilder'
import { validateSourceData } from '~/server/services/contentGeneration/validators'

export default defineEventHandler(async (event) => {
  const auth = assertAnyAdmin(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event).catch(() => ({}))
  const task = await getContentGenerationTask(id)
  if (!task) throw createError({ statusCode: 404, statusMessage: '任务不存在' })

  try {
    const seedTask = {
      ...task,
      contentType: body?.contentType || task.contentType,
      categoryId: body?.categoryId || task.categoryId,
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
    const updated = await updateContentGenerationTask(id, {
      contentType: seedTask.contentType,
      categoryId: seedTask.categoryId || null,
      toolId: brief.primaryToolId || task.toolId || null,
      promptJson: { ...(task.promptJson || {}), brief, briefPreparedAt: new Date().toISOString(), briefPreparedBy: 'deterministic-rules' },
      errorMessage: '',
    }, auth)
    const sourceData = await buildContentSourceData({ ...updated, contentType: updated.contentType.toUpperCase() })
    const validation = validateSourceData(sourceData)
    return {
      task: updated,
      brief,
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
