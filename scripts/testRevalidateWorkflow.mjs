import assert from 'node:assert/strict'
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { validateGeneratedContentPage } from '../server/services/contentGeneration/validators.js'

function productionScoreFromValidation(validation) {
  const raw = validation.checks?.productionScore?.actual ?? validation.score ?? 0
  const score = Number(raw)
  return Number.isFinite(score) ? score : 0
}

function canManualApproveValidation(validation) {
  const score = productionScoreFromValidation(validation)
  const failedChecks = Array.isArray(validation.failedChecks) ? validation.failedChecks : []
  return score >= 90
    && failedChecks.length > 0
    && failedChecks.every(name => name === 'toolGrounding')
}

assert.equal(canManualApproveValidation({ score: 100, failedChecks: ['toolGrounding'] }), true)
assert.equal(canManualApproveValidation({ checks: { productionScore: { actual: 95 } }, failedChecks: ['toolGrounding'] }), true)
assert.equal(canManualApproveValidation({ score: 100, failedChecks: [] }), false)
assert.equal(canManualApproveValidation({ score: 89, failedChecks: ['toolGrounding'] }), false)
assert.equal(canManualApproveValidation({ score: 100, failedChecks: ['toolGrounding', 'wordCount'] }), false)

console.log('manual approve eligibility: ok')

const prisma = new PrismaClient()
try {
  const task = await prisma.contentGenerationTask.findFirst({
    where: { status: 'REVIEW' },
    orderBy: { id: 'desc' },
  })

  if (!task?.finalContentJson || !task.sourceDataJson) {
    console.log('integration: skipped (no review task with content + sourceData in DB)')
  }
  else {
    const validationResult = validateGeneratedContentPage(task.finalContentJson, task.sourceDataJson)
    console.log('integration task', task.id, {
      passed: validationResult.passed,
      score: validationResult.score,
      failedChecks: validationResult.failedChecks,
      warningCount: validationResult.warnings?.length || 0,
    })
    assert.ok(typeof validationResult.score === 'number')
    assert.ok(Array.isArray(validationResult.failedChecks))
    console.log('integration revalidate validator path: ok')
    if (validationResult.score >= 90 && validationResult.failedChecks?.every(name => name === 'toolGrounding')) {
      console.log('integration: task eligible for manual approve')
    }
  }
}
finally {
  await prisma.$disconnect()
}

console.log('all revalidate workflow tests passed')
