import prisma from '../../utils/prisma.js'
import { PRODUCTION_PROMPT_VERSION, contentRules } from './editorialRules.js'
import { applyPromptTemplate, editorialSystemPrompt } from './prompts.js'

export const PRODUCTION_MODEL = 'deepseek-v4-pro'
export const PRODUCTION_TEMPERATURE = 0.25
export const PRODUCTION_MAX_TOKENS = 12000
export const GENERATION_MODE = 'production-seo-draft'

function promptNameFor(sourceData) {
  return `content-generation-${String(sourceData.contentType || '').toLowerCase().replaceAll('_', '-')}-production`
}

async function ensureDefaultPromptVersion(sourceData) {
  const name = promptNameFor(sourceData)
  const existing = await prisma.contentGenerationPromptVersion.findFirst({
    where: { name, isActive: true, version: { gte: PRODUCTION_PROMPT_VERSION } },
    orderBy: { version: 'desc' },
  })
  if (existing) return existing

  return prisma.contentGenerationPromptVersion.upsert({
    where: { name_version: { name, version: PRODUCTION_PROMPT_VERSION } },
    create: {
      name,
      version: PRODUCTION_PROMPT_VERSION,
      provider: 'deepseek',
      model: PRODUCTION_MODEL,
      systemPrompt: editorialSystemPrompt,
      userPromptTemplate: '{{SOURCE_PROMPT}}',
      configJson: {
        temperature: PRODUCTION_TEMPERATURE,
        max_tokens: PRODUCTION_MAX_TOKENS,
        generationMode: GENERATION_MODE,
      },
      rulesJson: sourceData.task === 'generate_compare' ? contentRules.compare : contentRules.guides,
      isActive: true,
    },
    update: { isActive: true },
  })
}

export async function resolvePromptVersion(task, sourceData, sourcePrompt) {
  let row = null
  if (task.promptVersionId) {
    row = await prisma.contentGenerationPromptVersion.findUnique({
      where: { id: Number(task.promptVersionId) },
    })
  }
  if (!row) row = await ensureDefaultPromptVersion(sourceData)

  const versionSystemPrompt = String(row.systemPrompt || '').trim()
  const systemPrompt = !versionSystemPrompt || versionSystemPrompt === editorialSystemPrompt
    ? editorialSystemPrompt
    : `${editorialSystemPrompt}\n\nPrompt-version-specific additional instructions:\n${versionSystemPrompt}`
  const userPrompt = applyPromptTemplate(row.userPromptTemplate, sourcePrompt, sourceData)
  const promptVersion = `${row.name}@${row.version}`
  const previousPromptJson = task.promptJson && typeof task.promptJson === 'object' ? task.promptJson : {}
  const preservedBrief = previousPromptJson.brief || previousPromptJson.input || Object.fromEntries(
    Object.entries(previousPromptJson).filter(([key]) => ![
      'promptVersion', 'promptVersionId', 'provider', 'model', 'temperature', 'max_tokens',
      'generationMode', 'systemPrompt', 'userPrompt',
    ].includes(key)),
  )

  await prisma.contentGenerationTask.update({
    where: { id: Number(task.id) },
    data: {
      promptVersionId: row.id,
      promptJson: {
        brief: preservedBrief,
        promptVersion,
        promptVersionId: row.id,
        provider: 'deepseek',
        model: PRODUCTION_MODEL,
        temperature: PRODUCTION_TEMPERATURE,
        max_tokens: PRODUCTION_MAX_TOKENS,
        generationMode: GENERATION_MODE,
        systemPrompt,
        userPrompt,
      },
      updatedAt: new Date(),
    },
  })

  return {
    id: row.id,
    name: row.name,
    version: row.version,
    promptVersion,
    systemPrompt,
    userPrompt,
    brief: preservedBrief,
  }
}
