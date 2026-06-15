import { PrismaClient } from '@prisma/client'

const taskId = Number(process.argv[2] || 29)
const prisma = new PrismaClient()

function snippet(text, pos, radius = 300) {
  const start = Math.max(0, pos - radius)
  const end = Math.min(text.length, pos + radius)
  return {
    start,
    end,
    text: text.slice(start, end),
    markerAt: pos - start,
  }
}

function lineCol(text, pos) {
  const before = text.slice(0, pos)
  const line = before.split('\n').length
  const col = before.length - before.lastIndexOf('\n')
  return { line, col }
}

try {
  const task = await prisma.contentGenerationTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      status: true,
      errorMessage: true,
      rawOutput: true,
      validationJson: true,
      generatedContentJson: true,
      finalContentJson: true,
    },
  })
  if (!task) {
    console.error('Task not found:', taskId)
    process.exit(1)
  }

  const raw = task.rawOutput || ''
  const pos = 33379
  const near = snippet(raw, pos)
  const lc = lineCol(raw, pos)

  console.log('taskId:', task.id)
  console.log('title:', task.title)
  console.log('status:', task.status)
  console.log('errorMessage:', task.errorMessage)
  console.log('rawOutput empty:', !raw.length)
  console.log('rawOutput length:', raw.length)
  console.log('has generatedContentJson:', !!task.generatedContentJson)
  console.log('has finalContentJson:', !!task.finalContentJson)
  console.log('\n--- first 500 chars ---')
  console.log(raw.slice(0, 500))
  console.log('\n--- last 500 chars ---')
  console.log(raw.slice(-500))
  console.log('\n--- around position', pos, `(line ${lc.line} col ${lc.col}) ---`)
  console.log(near.text)
  console.log('\n--- line 418 area ---')
  const lines = raw.split('\n')
  for (let i = 415; i <= 421 && i < lines.length; i++) {
    console.log(`${i + 1}: ${lines[i]}`)
  }

  const v = task.validationJson || {}
  console.log('\n--- validationJson summary ---')
  console.log(JSON.stringify({
    wordCount: v.wordCount,
    blockCount: v.blockCount,
    typedWriteStatus: v.typedWriteStatus,
    passed: v.passed,
    failedChecks: v.failedChecks,
    errors: v.errors?.slice?.(0, 5),
  }, null, 2))
}
finally {
  await prisma.$disconnect()
}
