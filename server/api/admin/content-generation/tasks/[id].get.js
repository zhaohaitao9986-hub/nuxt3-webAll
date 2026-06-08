import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import { getContentGenerationTask } from '~/server/services/contentGeneration/taskStore'

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)
  const id = getRouterParam(event, 'id')
  const row = await getContentGenerationTask(id)
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: '任务不存在' })
  }
  return row
})
