import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import { generateContentForTask } from '~/server/services/contentGeneration/generator'

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)
  const id = getRouterParam(event, 'id')
  return generateContentForTask(id, event)
})
