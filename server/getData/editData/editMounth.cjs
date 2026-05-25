/**
 * 将 ai_tools.month_visited_count = 0 的记录按规则写回估算值。
 *
 * 规则：
 * 1. collected_count 与 tool_info_review 均存在且均不为 0：
 *    month_visited_count = collected_count × tool_info_review × tool_info_review × 300
 * 2. collected_count 为 0，且 tool_info_review 存在：
 *    month_visited_count = tool_info_review × 200 × [1,10] 随机整数
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
 * @param {{ collected_count: number | null, tool_info_review: import('@prisma/client/runtime/library').Decimal | null }} row
 * @returns {bigint | null} 无法计算则 null（跳过）
 */
function computeMonthVisited(row) {
  const collected = Number(row.collected_count ?? 0)
  const reviewRaw = row.tool_info_review
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
    where: { month_visited_count: ZERO },
    select: {
      id: true,
      handle: true,
      collected_count: true,
      tool_info_review: true,
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
      data: { month_visited_count: next },
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
