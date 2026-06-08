import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import { batchGenerateContentTasks } from '~/server/services/contentGeneration/batchQueue'

export default defineEventHandler(async (event) => {
  const auth = assertAnyAdmin(event)
  const body = await readBody(event)
  return batchGenerateContentTasks(body, event, auth)
})
