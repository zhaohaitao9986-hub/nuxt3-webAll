import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import { batchPublishTasks } from '~/server/services/contentGeneration/batchReviewWorkflow'

export default defineEventHandler(async (event) => {
  const auth = assertAnyAdmin(event)
  const body = await readBody(event)
  return batchPublishTasks(body, auth)
})
