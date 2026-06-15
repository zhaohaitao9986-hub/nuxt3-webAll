import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import { deleteContentGenerationTask } from '~/server/services/contentGeneration/taskStore'

export default defineEventHandler(async (event) => {
  const auth = assertAnyAdmin(event)
  const id = getRouterParam(event, 'id')
  return deleteContentGenerationTask(id, auth)
})
