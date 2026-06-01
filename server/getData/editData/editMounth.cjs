/**
 * 将 aiTools.monthVisitedCount = 0 的记录按规则写回估算值。
 *
 * 规则：
 * 1. collectedCount 与 toolInfoReview 均存在且均不为 0：
 *    monthVisitedCount = collectedCount × toolInfoReview × toolInfoReview × 300
 * 2. collectedCount 为 0，且 toolInfoReview 存在：
 *    monthVisitedCount = toolInfoReview × 200 × [1,10] 随机整数
 *
 * 其它组合（例如 collected > 0 但 rating 为 0/null）：跳过不更新。
 *
 * 运行（项目根目录）:
 *   node server/getData/editData/editMounth.cjs
 */
'use strict'

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const ZERO = BigInt(0)

function randomInt1To10() {
  return Math.floor(Math.random() * 10) + 1
}

/**
 * @param {{ collectedCount: number | null, toolInfoReview: import('@prisma/client/runtime/library').Decimal | null }} row
 * @returns {bigint | null} 无法计算则 null（跳过）
 */
function computeMonthVisited(row) {
  const collected = Number(row.collectedCount ?? 0)
  const reviewRaw = row.toolInfoReview
  const review = reviewRaw == null ? null : Number(reviewRaw)

  const rule1 =
    collected !== 0 &&
    review != null &&
    !Number.isNaN(review) &&
    review !== 0

  if (rule1) {
    const v = collected * review * review * 300
    if (!Number.isFinite(v) || v < 0) return null
    return BigInt(Math.round(v))
  }

  if (collected === 0 && review != null && !Number.isNaN(review)) {
    const v = review * 200 * randomInt1To10()
    if (!Number.isFinite(v) || v < 0) return null
    return BigInt(Math.round(v))
  }

  return null
}

async function main() {
  const rows = await prisma.aiTool.findMany({
    where: { monthVisitedCount: ZERO },
    select: {
      id: true,
      handle: true,
      collectedCount: true,
      toolInfoReview: true,
    },
  })

  console.log(`[2/4] 查询完成，共找到 ${rows.length} 条待处理数据`)

  let updated = 0
  let skipped = 0

  console.log('[3/4] 开始遍历更新...')
  console.log('----------------------------------------')

  for (const row of rows) {
    const next = computeMonthVisited(row)
    if (next == null) {
      skipped += 1
      continue
    }
    await prisma.aiTool.update({
      where: { id: row.id },
      data: { monthVisitedCount: next },
    })
    updated += 1
    console.log(`[3/4] 更新完成: ${row.handle} | 已更新 ${updated} 条，跳过 ${skipped} 条`)
  }

  console.log(`[4/4] 完成！共更新 ${updated} 条，跳过 ${skipped} 条`)
  console.log('----------------------------------------')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
