import { assertAnyAdmin } from '~/server/utils/requireAdminRole'
import { listContentGenerationTasks } from '~/server/services/contentGeneration/taskStore'

export default defineEventHandler(async (event) => {
  assertAnyAdmin(event)
  const query = getQuery(event)

  return listContentGenerationTasks({
    page: query.page,
    pageSize: query.pageSize,
    status: typeof query.status === 'string' ? query.status : '',
    keyword: typeof query.keyword === 'string' ? query.keyword : '',
  })
})
