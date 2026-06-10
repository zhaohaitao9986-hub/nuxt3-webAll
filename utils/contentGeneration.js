export const CONTENT_GENERATION_STATUS_OPTIONS = [
  { label: '草稿', value: 'draft', type: 'info' },
  { label: '待生成', value: 'pending', type: 'warning' },
  { label: '生成中', value: 'generating', type: 'primary' },
  { label: '失败', value: 'failed', type: 'danger' },
  { label: '待审核', value: 'review', type: 'warning' },
  { label: '已通过', value: 'approved', type: 'success' },
  { label: '已驳回', value: 'rejected', type: 'danger' },
  { label: '已发布', value: 'published', type: 'success' },
]

export function contentGenerationStatusLabel(status, statusMap) {
  return statusMap?.[status]?.label || status || '未知'
}

export function contentGenerationStatusType(status, statusMap) {
  return statusMap?.[status]?.type || 'info'
}

export function stringifyContentJson(value) {
  if (value === null || value === undefined || value === '') {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  return JSON.stringify(value, null, 2)
}

export function parseContentJsonText(text, label) {
  const trimmed = String(text || '').trim()
  if (!trimmed) {
    return null
  }
  try {
    return JSON.parse(trimmed)
  }
  catch {
    throw new Error(`${label} 不是有效 JSON`)
  }
}

export function fillContentGenerationDetailForm(detailForm, row) {
  detailForm.title = row.title || ''
  detailForm.slug = row.slug || ''
  detailForm.contentType = row.contentType || ''
  detailForm.targetType = row.targetType || ''
  detailForm.categoryId = row.categoryId ?? ''
  detailForm.toolId = row.toolId ?? ''
  detailForm.limit = row.limit ?? 5
  detailForm.status = row.status || 'draft'
  detailForm.generatedContentText = stringifyContentJson(row.generatedContent || row.generated_content || row.contentJson)
  detailForm.contentJsonText = stringifyContentJson(row.finalContent || row.final_content || row.contentJson)
  detailForm.sourceDataJsonText = stringifyContentJson(row.sourceDataJson)
  detailForm.rawOutput = row.rawOutput || ''
  detailForm.validationJsonText = stringifyContentJson(row.validationJson)
  detailForm.errorMessage = row.errorMessage || row.error_message || ''
  detailForm.rejectReason = row.rejectReason || row.reject_reason || ''
}

export const CONTENT_GENERATION_PHASE_LABELS = {
  building_source: '正在构建来源数据…',
  generating: 'AI 生成中…',
  expanding: '正在扩展重试…',
  parsing: '正在解析 JSON…',
  validating: '正在校验生成结果…',
}
