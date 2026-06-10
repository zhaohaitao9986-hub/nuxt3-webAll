import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import { handleContentGenerationStream } from '~/server/services/contentGeneration/streamHandler'

export default defineEventHandler((event) => {
  const auth = assertAnyAdmin(event)
  const id = getRouterParam(event, 'id')
  return handleContentGenerationStream(id, event, auth)
})
