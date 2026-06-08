import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import { rejectTaskForReview } from '~/server/services/contentGeneration/reviewWorkflow'

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  return rejectTaskForReview(id, body?.rejectReason || body?.reject_reason)
})
