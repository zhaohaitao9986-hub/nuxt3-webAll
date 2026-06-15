import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import { batchDeleteContentGenerationTasks } from '~/server/services/contentGeneration/taskStore'

export default defineEventHandler(async (event) => {
  const auth = assertAnyAdmin(event)
  const body = await readBody(event)
  return batchDeleteContentGenerationTasks(body, auth)
})
