import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import { batchApproveTasks } from '~/server/services/contentGeneration/batchReviewWorkflow'

export default defineEventHandler(async (event) => {
  const auth = assertAnyAdmin(event)
  const body = await readBody(event)
  return batchApproveTasks(body, auth)
})
