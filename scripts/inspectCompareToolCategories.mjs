import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import {
  logCompareCategorySelection,
  resolveCompareCategorySelection,
  toolCategoryIncludeForCompare,
} from '../server/services/contentGeneration/compareCategorySelection.js'

const prisma = new PrismaClient()

async function loadTool(idOrName) {
  if (Number(idOrName)) {
    return prisma.aiTool.findFirst({
      where: { id: Number(idOrName), toolStatus: { in: ['ONLINE', 'ACTIVE'] } },
      include: toolCategoryIncludeForCompare,
    })
  }
  const raw = String(idOrName).trim()
  return prisma.aiTool.findFirst({
    where: {
      toolStatus: { in: ['ONLINE', 'ACTIVE'] },
      OR: [
        { name: { equals: raw, mode: 'insensitive' } },
        { handle: { equals: raw.toLowerCase(), mode: 'insensitive' } },
        { name: { contains: raw, mode: 'insensitive' } },
      ],
    },
    orderBy: [{ rank: 'asc' }, { id: 'asc' }],
    include: toolCategoryIncludeForCompare,
  })
}

try {
  const tool21126 = await loadTool(21126)
  console.log('tool 21126', tool21126 ? {
    id: tool21126.id,
    name: tool21126.name,
    handle: tool21126.handle,
    categories: tool21126.toolCategories.map(row => ({
      categoryId: row.categoryId,
      handle: row.category?.handle,
      name: row.category?.name,
      toolCount: row.category?.toolCount,
    })),
  } : null)

  const chatgpt = await loadTool('ChatGPT')
  const gemini = await loadTool(21126) || await loadTool('Gemini')
  if (chatgpt && gemini) {
    const selection = resolveCompareCategorySelection(chatgpt, gemini)
    logCompareCategorySelection({
      ...selection,
      taskCategoryIdBefore: null,
      source: 'inspect-script',
    })
  }
}
finally {
  await prisma.$disconnect()
}
