import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import { batchCreateTasksWithBrief } from '~/server/services/contentGeneration/batchCreate'

export default defineEventHandler(async (event) => {
  const auth = assertAnyAdmin(event)
  const body = await readBody(event)
  return batchCreateTasksWithBrief(body, auth)
})
