import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import { revalidateContentGenerationTask } from '~/server/services/contentGeneration/reviewWorkflow'

export default defineEventHandler(async (event) => {
  const auth = assertAnyAdmin(event)
  const id = getRouterParam(event, 'id')
  return revalidateContentGenerationTask(id, auth)
})
