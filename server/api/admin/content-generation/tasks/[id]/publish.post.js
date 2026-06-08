import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import { publishApprovedTask } from '~/server/services/contentGeneration/reviewWorkflow'

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)
  const id = getRouterParam(event, 'id')
  return publishApprovedTask(id)
})
