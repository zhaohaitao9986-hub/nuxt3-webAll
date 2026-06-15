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

export function createContentGenerationBriefForm() {
  return {
    selectedToolIds: [],
    targetKeyword: '',
    pageGoal: '',
    searchIntent: '',
    audience: '',
    decisionCriteriaText: '',
    primaryToolId: '',
    tutorialGoal: '',
    workflowContextText: '',
    prerequisiteKnowledgeText: '',
    outputChecklistText: '',
    commonMistakesText: '',
    secondaryToolId: '',
    comparisonIntent: '',
    targetAudience: '',
    sharedUseCasesText: '',
    alternativeToolIds: [],
    reasonToSwitch: '',
    selectionCriteriaText: '',
  }
}

function lines(value) {
  return String(value || '').split(/\r?\n/).map(row => row.trim()).filter(Boolean)
}

function parseWorkflow(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) return parseContentJsonText(trimmed, 'Workflow Context') || []
  return lines(trimmed).map((instruction, index) => ({ step: index + 1, instruction }))
}

export function normalizeContentGenerationType(value) {
  return String(value || '').trim().toUpperCase()
}

export function contentGenerationTargetType(value) {
  const type = normalizeContentGenerationType(value)
  return ['COMPARISON', 'ALTERNATIVE'].includes(type) ? 'compare' : 'guides'
}

export function buildContentGenerationBrief(form) {
  const contentType = normalizeContentGenerationType(form.contentType)
  const common = {
    targetKeyword: form.targetKeyword?.trim() || undefined,
    pageGoal: form.pageGoal?.trim() || undefined,
    searchIntent: form.searchIntent?.trim() || undefined,
    audience: form.audience?.trim() || undefined,
  }
  if (contentType === 'BUYER_GUIDE') {
    return { ...common, selectedToolIds: form.selectedToolIds || [], decisionCriteria: lines(form.decisionCriteriaText) }
  }
  if (contentType === 'CATEGORY_GUIDE') return common
  if (contentType === 'TUTORIAL') {
    return {
      ...common,
      primaryToolId: form.primaryToolId || undefined,
      tutorialGoal: form.tutorialGoal?.trim() || undefined,
      workflowContext: parseWorkflow(form.workflowContextText),
      prerequisiteKnowledge: lines(form.prerequisiteKnowledgeText),
      outputChecklist: lines(form.outputChecklistText),
      commonMistakes: lines(form.commonMistakesText),
    }
  }
  if (contentType === 'COMPARISON') {
    return {
      primaryToolId: form.primaryToolId || undefined,
      secondaryToolId: form.secondaryToolId || undefined,
      comparisonIntent: form.comparisonIntent?.trim() || undefined,
      targetAudience: form.targetAudience?.trim() || undefined,
      decisionCriteria: lines(form.decisionCriteriaText),
      sharedUseCases: lines(form.sharedUseCasesText),
    }
  }
  return {
    primaryToolId: form.primaryToolId || undefined,
    alternativeToolIds: form.alternativeToolIds || [],
    reasonToSwitch: form.reasonToSwitch?.trim() || undefined,
    selectionCriteria: lines(form.selectionCriteriaText),
  }
}

export function validateContentGenerationBrief(form) {
  const type = normalizeContentGenerationType(form.contentType)
  const brief = buildContentGenerationBrief(form)
  const missing = []
  const need = (field, label) => {
    const value = brief[field]
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) missing.push(label)
  }
  if (['BUYER_GUIDE', 'CATEGORY_GUIDE', 'TUTORIAL'].includes(type)) {
    need('targetKeyword', '目标关键词')
    need('pageGoal', '页面目标')
    need('searchIntent', '搜索意图')
    need('audience', '目标受众')
  }
  if (type === 'BUYER_GUIDE') {
    if ((brief.selectedToolIds || []).length < 5) missing.push('至少 5 个入选工具')
    if ((brief.decisionCriteria || []).length < 5) missing.push('至少 5 条决策标准')
  }
  if (type === 'CATEGORY_GUIDE' && !form.categoryId) missing.push('分类')
  if (type === 'TUTORIAL') {
    need('primaryToolId', '主工具')
    need('tutorialGoal', '教程目标')
    need('workflowContext', '工作流步骤')
    need('outputChecklist', '输出检查')
  }
  if (type === 'COMPARISON') {
    if (!form.categoryId) missing.push('二级分类')
    need('primaryToolId', '主工具')
    need('secondaryToolId', '对比工具')
    need('comparisonIntent', '对比意图')
    need('targetAudience', '目标受众')
    if ((brief.decisionCriteria || []).length < 6) missing.push('至少 6 条决策标准')
    if (brief.primaryToolId && Number(brief.primaryToolId) === Number(brief.secondaryToolId)) missing.push('主工具和对比工具不能相同')
  }
  if (type === 'ALTERNATIVE') {
    if (!form.categoryId) missing.push('二级分类')
    need('primaryToolId', '主工具')
    if ((brief.alternativeToolIds || []).length < 2) missing.push('至少 2 个替代工具')
    need('reasonToSwitch', '切换原因')
    if ((brief.selectionCriteria || []).length < 5) missing.push('至少 5 条选择标准')
    if ((brief.alternativeToolIds || []).some(id => Number(id) === Number(brief.primaryToolId))) missing.push('替代工具不能包含主工具')
  }
  return { ok: missing.length === 0, missing, brief }
}

export function fillContentGenerationBriefForm(form, promptJson) {
  const brief = promptJson?.brief || promptJson?.input || {}
  form.selectedToolIds = Array.isArray(brief.selectedToolIds) ? [...brief.selectedToolIds] : []
  form.targetKeyword = brief.targetKeyword || ''
  form.pageGoal = brief.pageGoal || ''
  form.searchIntent = brief.searchIntent || ''
  form.audience = brief.audience || ''
  form.decisionCriteriaText = (brief.decisionCriteria || []).map(row => typeof row === 'string' ? row : row?.name).filter(Boolean).join('\n')
  form.primaryToolId = brief.primaryToolId ?? form.toolId ?? ''
  form.tutorialGoal = brief.tutorialGoal || ''
  form.workflowContextText = Array.isArray(brief.workflowContext) ? JSON.stringify(brief.workflowContext, null, 2) : ''
  form.prerequisiteKnowledgeText = (brief.prerequisiteKnowledge || []).join('\n')
  form.outputChecklistText = (brief.outputChecklist || []).join('\n')
  form.commonMistakesText = (brief.commonMistakes || []).join('\n')
  form.secondaryToolId = brief.secondaryToolId ?? ''
  form.comparisonIntent = brief.comparisonIntent || ''
  form.targetAudience = brief.targetAudience || ''
  form.sharedUseCasesText = (brief.sharedUseCases || []).join('\n')
  form.alternativeToolIds = Array.isArray(brief.alternativeToolIds) ? [...brief.alternativeToolIds] : []
  form.reasonToSwitch = brief.reasonToSwitch || ''
  form.selectionCriteriaText = (brief.selectionCriteria || []).map(row => typeof row === 'string' ? row : row?.name).filter(Boolean).join('\n')
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
  fillContentGenerationBriefForm(detailForm, row.promptJson || row.prompt_json)
}

export const CONTENT_GENERATION_PHASE_LABELS = {
  building_source: '正在构建来源数据…',
  generating: 'AI 生成中…',
  expanding: '正在扩展重试…',
  parsing: '正在解析 JSON…',
  validating: '正在校验生成结果…',
}
