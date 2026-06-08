import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import { createContentGenerationTask } from '~/server/services/contentGeneration/taskStore'

export default defineEventHandler(async (event) => {
  const auth = assertAnyAdmin(event)
  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: '请求体无效' })
  }

  return createContentGenerationTask(body, auth)
})
