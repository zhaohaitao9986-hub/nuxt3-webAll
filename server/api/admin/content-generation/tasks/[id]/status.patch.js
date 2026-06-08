import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import { updateContentGenerationTaskStatus } from '~/server/services/contentGeneration/taskStore'

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const status = typeof body?.status === 'string' ? body.status : ''

  return updateContentGenerationTaskStatus(id, status)
})
