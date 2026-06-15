import prisma from '../../utils/prisma.js'

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function uniqueContentGenerationSlug(baseSlug, {
  contentType = null,
  excludeTaskId = null,
} = {}) {
  const base = slugify(baseSlug) || 'content'
  const normalizedType = contentType ? String(contentType).toUpperCase() : null
  const normalizedExcludeTaskId = Number(excludeTaskId) || null

  for (let index = 1; index < 1000; index += 1) {
    const candidate = index === 1 ? base : `${base}-${index}`
    const [task, page] = await Promise.all([
      prisma.contentGenerationTask.findFirst({
        where: {
          slug: candidate,
          ...(normalizedExcludeTaskId ? { id: { not: normalizedExcludeTaskId } } : {}),
        },
        select: { id: true },
      }),
      prisma.contentPage.findFirst({
        where: {
          slug: candidate,
          ...(normalizedType ? { type: normalizedType } : {}),
        },
        select: { id: true },
      }),
    ])
    if (!task && !page) return candidate
  }

  return `${base}-${Date.now()}`
}
