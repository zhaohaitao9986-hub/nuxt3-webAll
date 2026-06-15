import { PrismaClient } from '@prisma/client'
import { safeJsonParse } from '../server/services/contentGeneration/jsonParse.js'

const taskId = Number(process.argv[2] || 29)
const prisma = new PrismaClient()

const task = await prisma.contentGenerationTask.findUnique({
  where: { id: taskId },
  select: { id: true, rawOutput: true, errorMessage: true },
})

if (!task?.rawOutput) {
  console.error('No rawOutput for task', taskId)
  process.exit(1)
}

const result = safeJsonParse(task.rawOutput)
console.log(JSON.stringify({
  taskId: task.id,
  previousError: task.errorMessage,
  ok: result.ok,
  repaired: result.repaired,
  strategy: result.strategy,
  topLevelKeys: result.ok ? Object.keys(result.data) : null,
  hasBodyJson: result.ok ? !!result.data?.bodyJson : null,
  blockCount: result.ok ? (result.data?.bodyJson?.blocks?.length || 0) : null,
  errorMessage: result.ok ? null : result.errorMessage,
  position: result.position,
  snippet: result.snippet?.slice(0, 200),
}, null, 2))

await prisma.$disconnect()
