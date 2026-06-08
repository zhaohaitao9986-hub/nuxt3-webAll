import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import { updateContentGenerationTask } from '~/server/services/contentGeneration/taskStore'

export default defineEventHandler(async (event) => {
  const auth = assertAnyAdmin(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: '请求体无效' })
  }

  return updateContentGenerationTask(id, body, auth)
})
