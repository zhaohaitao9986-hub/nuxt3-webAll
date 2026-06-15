<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import ContentGenerationBriefFields from '~/components/contentGeneration/ContentGenerationBriefFields.vue'
import {
  CONTENT_GENERATION_PHASE_LABELS,
  CONTENT_GENERATION_STATUS_OPTIONS,
  contentGenerationStatusLabel,
  contentGenerationStatusType,
  contentGenerationTargetType,
  createContentGenerationBriefForm,
  fillContentGenerationDetailForm,
  parseContentJsonText,
  validateContentGenerationBrief,
} from '~/utils/contentGeneration'

definePageMeta({
  layout: 'admin',
})

const route = useRoute()
const router = useRouter()
const adminAxios = useAdminAxios()
const { streamGenerate } = useContentGenerationStream()

const taskId = computed(() => {
  const raw = route.params.id
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
})

const statusMap = computed(() => Object.fromEntries(
  CONTENT_GENERATION_STATUS_OPTIONS.map((item) => [item.value, item]),
))

const pageLoading = ref(false)
const detailSaving = ref(false)
const briefPreparing = ref(false)
const briefSummary = ref(null)
const generationLoading = ref(false)
const reviewLoading = ref(false)
const rejectSaving = ref(false)
const revalidateLoading = ref(false)
const manualApproveLoading = ref(false)
const generationPhase = ref('')

const categoryOptions = ref([])
const detailFormRef = ref(null)

const detailForm = reactive({
  ...createContentGenerationBriefForm(),
  title: '',
  slug: '',
  contentType: '',
  targetType: '',
  categoryId: '',
  toolId: '',
  limit: 5,
  status: 'draft',
  generatedContentText: '',
  contentJsonText: '',
  sourceDataJsonText: '',
  rawOutput: '',
  validationJsonText: '',
  errorMessage: '',
  rejectReason: '',
})

const rejectVisible = ref(false)
const rejectForm = reactive({ reason: '' })

const detailRules = {
  title: [{ required: true, message: '请输入任务标题', trigger: 'blur' }],
}

const phaseLabel = computed(() => CONTENT_GENERATION_PHASE_LABELS[generationPhase.value] || '')
const briefValidation = computed(() => validateContentGenerationBrief(detailForm))

const parsedValidationJson = computed(() => {
  try {
    return JSON.parse(detailForm.validationJsonText || '{}')
  }
  catch {
    return null
  }
})

const canManualApprove = computed(() => {
  if (detailForm.status !== 'review') {
    return false
  }
  const validation = parsedValidationJson.value
  if (!validation) {
    return false
  }
  const score = Number(validation.checks?.productionScore?.actual ?? validation.score ?? 0)
  const failedChecks = Array.isArray(validation.failedChecks) ? validation.failedChecks : []
  return Number.isFinite(score)
    && score >= 90
    && failedChecks.length > 0
    && failedChecks.every(name => name === 'toolGrounding')
})

function statusLabel(status) {
  return contentGenerationStatusLabel(status, statusMap.value)
}

function statusType(status) {
  return contentGenerationStatusType(status, statusMap.value)
}

function errorMessage(error, fallback) {
  return error?.response?.data?.statusMessage
    || error?.response?.data?.message
    || error?.message
    || fallback
}

async function loadOptions() {
  try {
    const [categoriesRes] = await Promise.all([
      adminAxios.get('/api/admin/categories/options'),
    ])
    categoryOptions.value = categoriesRes.data?.data || []
  }
  catch {
    categoryOptions.value = []
  }
}

async function loadDetail() {
  if (!taskId.value) {
    return
  }
  pageLoading.value = true
  try {
    const res = await adminAxios.get(`/api/admin/content-generation/tasks/${taskId.value}`)
    fillContentGenerationDetailForm(detailForm, res.data)
  }
  catch (e) {
    if (e?.response?.status === 401) {
      return
    }
    ElMessage.error(errorMessage(e, '加载详情失败'))
    router.push('/admin/content-generation')
  }
  finally {
    pageLoading.value = false
  }
}

async function saveDetail() {
  try {
    await detailFormRef.value?.validate?.()
  }
  catch {
    return false
  }

  let payload
  try {
    const briefValidation = validateContentGenerationBrief(detailForm)
    if (!briefValidation.ok) throw new Error(`缺少必要输入：${briefValidation.missing.join('、')}`)
    payload = {
      title: detailForm.title.trim(),
      slug: detailForm.slug.trim(),
      contentType: detailForm.contentType.trim(),
      targetType: detailForm.targetType.trim(),
      categoryId: detailForm.categoryId || null,
      toolId: detailForm.primaryToolId || detailForm.toolId || null,
      limit: detailForm.limit,
      promptJson: { brief: briefValidation.brief },
      contentJson: parseContentJsonText(detailForm.contentJsonText, '内容 JSON'),
      finalContent: parseContentJsonText(detailForm.contentJsonText, '最终内容 JSON'),
      sourceDataJson: parseContentJsonText(detailForm.sourceDataJsonText, '来源 JSON'),
      rawOutput: detailForm.rawOutput,
      validationJson: parseContentJsonText(detailForm.validationJsonText, '校验 JSON'),
      errorMessage: detailForm.errorMessage,
    }
  }
  catch (e) {
    ElMessage.error(e.message)
    return false
  }

  detailSaving.value = true
  try {
    const res = await adminAxios.put(`/api/admin/content-generation/tasks/${taskId.value}`, payload)
    fillContentGenerationDetailForm(detailForm, res.data)
    ElMessage.success('已保存')
    return true
  }
  catch (e) {
    if (e?.response?.status === 401) {
      return
    }
    ElMessage.error(errorMessage(e, '保存失败'))
    return false
  }
  finally {
    detailSaving.value = false
  }
}

async function prepareBrief() {
  const type = String(detailForm.contentType).toUpperCase()
  if (['BUYER_GUIDE', 'CATEGORY_GUIDE', 'COMPARISON', 'ALTERNATIVE'].includes(type) && !detailForm.categoryId) {
    ElMessage.warning('请先选择二级分类')
    return
  }
  if (['TUTORIAL', 'COMPARISON', 'ALTERNATIVE'].includes(type) && !detailForm.primaryToolId) {
    ElMessage.warning('请先选择主工具')
    return
  }
  briefPreparing.value = true
  try {
    const response = await adminAxios.post(`/api/admin/content-generation/tasks/${taskId.value}/prepare-brief`, {
      contentType: detailForm.contentType,
      categoryId: detailForm.categoryId || null,
      primaryToolId: detailForm.primaryToolId || detailForm.toolId || null,
      secondaryToolId: detailForm.secondaryToolId || null,
    })
    fillContentGenerationDetailForm(detailForm, response.data.task)
    briefSummary.value = response.data.inputSummary
    ElMessage.success('Brief 已根据数据库事实自动生成')
  }
  catch (e) {
    ElMessage.error(errorMessage(e, 'Brief 生成失败'))
  }
  finally {
    briefPreparing.value = false
  }
}

async function generateTask(mode) {
  if (!taskId.value || generationLoading.value) {
    return
  }

  if (mode === 'regenerate') {
    try {
      await ElMessageBox.confirm('重新生成会覆盖当前生成内容，确定继续吗？', '重新生成确认', {
        type: 'warning',
        confirmButtonText: '重新生成',
        cancelButtonText: '取消',
      })
    }
    catch {
      return
    }
  }

  const saved = await saveDetail()
  if (!saved) {
    return
  }

  generationLoading.value = true
  generationPhase.value = 'building_source'
  detailForm.status = 'generating'
  detailForm.rawOutput = ''
  detailForm.errorMessage = ''

  try {
    await streamGenerate(taskId.value, mode, {
      onStatus: (payload) => {
        if (payload.status) {
          detailForm.status = payload.status
        }
      },
      onSource: (payload) => {
        if (payload.sourceDataJson) {
          detailForm.sourceDataJsonText = JSON.stringify(payload.sourceDataJson, null, 2)
        }
      },
      onPhase: (payload) => {
        if (payload.phase) {
          generationPhase.value = payload.phase
        }
        if (payload.clearOutput) {
          detailForm.rawOutput = ''
        }
      },
      onChunk: (text) => {
        detailForm.rawOutput += text
      },
      onComplete: (payload) => {
        if (payload.task) {
          fillContentGenerationDetailForm(detailForm, payload.task)
        }
        if (payload.success !== false) {
          ElMessage.success('已生成，进入待审核')
        }
      },
      onError: (payload) => {
        if (payload.task) {
          fillContentGenerationDetailForm(detailForm, payload.task)
        }
        else {
          detailForm.status = 'failed'
          detailForm.errorMessage = payload.message || '生成失败'
        }
        ElMessage.error(payload.message || '生成失败')
      },
    })
  }
  catch (e) {
    ElMessage.error(e?.message || (mode === 'regenerate' ? '重新生成失败' : '生成失败'))
    await loadDetail()
  }
  finally {
    generationLoading.value = false
    generationPhase.value = ''
  }
}

async function approveTask() {
  reviewLoading.value = true
  try {
    const saved = await saveDetail()
    if (!saved) {
      return
    }
    const res = await adminAxios.post(`/api/admin/content-generation/tasks/${taskId.value}/approve`)
    fillContentGenerationDetailForm(detailForm, res.data)
    ElMessage.success('审核已通过')
  }
  catch (e) {
    if (e?.response?.status === 401) {
      return
    }
    ElMessage.error(errorMessage(e, '审核通过失败'))
  }
  finally {
    reviewLoading.value = false
  }
}

async function revalidateTask() {
  if (!taskId.value || revalidateLoading.value) {
    return
  }
  revalidateLoading.value = true
  try {
    const res = await adminAxios.post(`/api/admin/content-generation/tasks/${taskId.value}/revalidate`)
    const { passed, score, failedChecks, warnings } = res.data || {}
    await loadDetail()
    const failedText = Array.isArray(failedChecks) && failedChecks.length
      ? `，未通过项：${failedChecks.join('、')}`
      : ''
    const warningCount = Array.isArray(warnings) ? warnings.length : 0
    const warningText = warningCount ? `，警告 ${warningCount} 条` : ''
    if (passed) {
      ElMessage.success(`重新校验通过，score=${score}${warningText}`)
    }
    else {
      ElMessage.warning(`重新校验未通过，score=${score}${failedText}${warningText}`)
    }
  }
  catch (e) {
    if (e?.response?.status === 401) {
      return
    }
    ElMessage.error(errorMessage(e, '重新校验失败'))
  }
  finally {
    revalidateLoading.value = false
  }
}

async function manualApproveTask() {
  if (!taskId.value || manualApproveLoading.value) {
    return
  }
  try {
    await ElMessageBox.confirm(
      '该任务仅因 toolGrounding 未通过校验，确认手动标记为审核通过吗？',
      '标记通过确认',
      {
        type: 'warning',
        confirmButtonText: '标记通过',
        cancelButtonText: '取消',
      },
    )
  }
  catch {
    return
  }

  manualApproveLoading.value = true
  try {
    const res = await adminAxios.post(`/api/admin/content-generation/tasks/${taskId.value}/manual-approve`)
    fillContentGenerationDetailForm(detailForm, res.data)
    ElMessage.success('已手动标记通过')
  }
  catch (e) {
    if (e?.response?.status === 401) {
      return
    }
    ElMessage.error(errorMessage(e, '标记通过失败'))
  }
  finally {
    manualApproveLoading.value = false
  }
}

function openReject() {
  rejectForm.reason = detailForm.rejectReason || ''
  rejectVisible.value = true
}

async function submitReject() {
  const reason = rejectForm.reason.trim()
  if (!reason) {
    ElMessage.warning('请填写驳回原因')
    return
  }

  rejectSaving.value = true
  try {
    const res = await adminAxios.post(`/api/admin/content-generation/tasks/${taskId.value}/reject`, {
      rejectReason: reason,
    })
    fillContentGenerationDetailForm(detailForm, res.data)
    rejectVisible.value = false
    ElMessage.success('已驳回')
  }
  catch (e) {
    if (e?.response?.status === 401) {
      return
    }
    ElMessage.error(errorMessage(e, '驳回失败'))
  }
  finally {
    rejectSaving.value = false
  }
}

async function publishTask() {
  try {
    await ElMessageBox.confirm('发布会写入正式内容发布存储，确定发布吗？', '发布确认', {
      type: 'warning',
      confirmButtonText: '发布',
      cancelButtonText: '取消',
    })
  }
  catch {
    return
  }

  reviewLoading.value = true
  try {
    const saved = await saveDetail()
    if (!saved) {
      return
    }
    const res = await adminAxios.post(`/api/admin/content-generation/tasks/${taskId.value}/publish`)
    fillContentGenerationDetailForm(detailForm, res.data)
    ElMessage.success('发布成功')
  }
  catch (e) {
    if (e?.response?.status === 401) {
      return
    }
    ElMessage.error(errorMessage(e, '发布失败'))
  }
  finally {
    reviewLoading.value = false
  }
}

function goBack() {
  router.push('/admin/content-generation')
}

onMounted(() => {
  loadOptions()
  loadDetail()
})

watch(taskId, () => {
  loadDetail()
})

watch(() => detailForm.contentType, (contentType, previousType) => {
  detailForm.targetType = contentGenerationTargetType(contentType)
  if (previousType && String(previousType).toUpperCase() !== String(contentType).toUpperCase()) {
    detailForm.categoryId = ''
    detailForm.primaryToolId = ''
    detailForm.secondaryToolId = ''
    detailForm.alternativeToolIds = []
  }
})
</script>

<template>
  <div v-loading="pageLoading" class="content-generation-detail-page">
    <div class="detail-top-bar">
      <div class="detail-page-header">
        <el-button @click="goBack">
          返回列表
        </el-button>
        <div class="detail-page-header-meta">
          <span class="detail-page-title">任务详情</span>
          <span v-if="taskId" class="detail-page-id">#{{ taskId }}</span>
          <el-tag v-if="detailForm.status" :type="statusType(detailForm.status)" effect="light">
            {{ statusLabel(detailForm.status) }}
          </el-tag>
          <span v-if="generationLoading && phaseLabel" class="detail-phase-label">
            {{ phaseLabel }}
          </span>
        </div>
      </div>

      <div class="detail-action-bar">
        <el-button
          type="success"
          :loading="generationLoading"
          :disabled="detailSaving || briefPreparing || !briefValidation.ok"
          @click="generateTask('generate')"
        >
          生成内容
        </el-button>
        <el-button
          type="warning"
          :loading="generationLoading"
          :disabled="detailSaving || briefPreparing || !briefValidation.ok"
          @click="generateTask('regenerate')"
        >
          重新生成
        </el-button>
        <el-button
          v-if="detailForm.status === 'review'"
          type="primary"
          :loading="reviewLoading"
          :disabled="generationLoading"
          @click="approveTask"
        >
          审核通过
        </el-button>
        <el-button
          v-if="canManualApprove"
          type="primary"
          plain
          :loading="manualApproveLoading"
          :disabled="generationLoading || revalidateLoading"
          @click="manualApproveTask"
        >
          标记通过
        </el-button>
        <el-button
          :loading="revalidateLoading"
          :disabled="generationLoading || !detailForm.contentJsonText.trim()"
          @click="revalidateTask"
        >
          重新校验
        </el-button>
        <el-button
          v-if="detailForm.status === 'review'"
          type="danger"
          :loading="rejectSaving"
          :disabled="generationLoading"
          @click="openReject"
        >
          驳回
        </el-button>
        <el-button
          v-if="detailForm.status === 'approved'"
          type="success"
          :loading="reviewLoading"
          :disabled="generationLoading"
          @click="publishTask"
        >
          发布
        </el-button>
        <el-button :disabled="generationLoading" @click="goBack">
          返回
        </el-button>
        <el-button
          type="primary"
          :loading="detailSaving"
          :disabled="generationLoading"
          @click="saveDetail"
        >
          保存
        </el-button>
        <el-button type="success" :loading="briefPreparing" :disabled="generationLoading" @click="prepareBrief">
          AI 生成 Brief
        </el-button>
      </div>
    </div>

    <el-card shadow="never" class="detail-card">
      <el-alert
        v-if="briefSummary"
        :type="briefSummary.contractPassed ? 'success' : 'warning'"
        :closable="false"
        show-icon
        class="mb-4"
        :title="briefSummary.contractPassed ? 'Brief Contract 已通过' : `Brief 缺少：${briefSummary.missingRequiredFields.join('、')}`"
        :description="`工具 ${briefSummary.selectedTools.length} 个，来源 ${briefSummary.sourceMapCount} 个，策略：${briefSummary.selectedToolStrategy || '-'}，警告：${briefSummary.inputWarnings.join('、') || '无'}`"
      />
      <el-form ref="detailFormRef" :model="detailForm" :rules="detailRules" label-width="96px">
        <el-form-item label="任务标题" prop="title">
          <el-input v-model="detailForm.title" :disabled="generationLoading" />
        </el-form-item>
        <el-form-item label="Slug">
          <el-input v-model="detailForm.slug" :disabled="generationLoading" />
        </el-form-item>
        <el-form-item label="内容类型">
          <el-input v-model="detailForm.contentType" :disabled="generationLoading" />
        </el-form-item>
        <el-form-item label="目标类型">
          <el-input v-model="detailForm.targetType" readonly />
        </el-form-item>
        <el-form-item v-if="!['COMPARISON', 'ALTERNATIVE'].includes(String(detailForm.contentType).toUpperCase())" label="分类" :required="['BUYER_GUIDE', 'CATEGORY_GUIDE'].includes(String(detailForm.contentType).toUpperCase())">
          <el-select
            v-model="detailForm.categoryId"
            clearable
            filterable
            placeholder="可选，用于按分类读取工具"
            style="width: 100%"
            :disabled="generationLoading"
          >
            <el-option
              v-for="opt in categoryOptions"
              :key="opt.id"
              :label="opt.label || opt.name"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <ContentGenerationBriefFields :form="detailForm" :disabled="generationLoading" />
        <el-form-item label="数量">
          <el-input-number
            v-model="detailForm.limit"
            :min="1"
            :max="30"
            style="width: 160px"
            :disabled="generationLoading"
          />
        </el-form-item>

        <el-form-item label="来源 JSON">
          <el-input
            v-model="detailForm.sourceDataJsonText"
            type="textarea"
            class="detail-textarea-fixed"
            :disabled="generationLoading"
          />
        </el-form-item>

        <el-form-item label="原始输出">
          <el-input
            v-model="detailForm.rawOutput"
            type="textarea"
            class="detail-textarea-fixed detail-textarea-stream"
            :readonly="generationLoading"
          />
        </el-form-item>

        <el-form-item label="AI 原始">
          <el-input
            v-model="detailForm.generatedContentText"
            type="textarea"
            class="detail-textarea-fixed"
            readonly
          />
        </el-form-item>

        <el-form-item label="最终内容">
          <el-input
            v-model="detailForm.contentJsonText"
            type="textarea"
            class="detail-textarea-fixed"
            :disabled="generationLoading"
          />
        </el-form-item>

        <el-form-item label="校验 JSON">
          <el-input
            v-model="detailForm.validationJsonText"
            type="textarea"
            class="detail-textarea-fixed"
            :disabled="generationLoading"
          />
        </el-form-item>

        <el-form-item label="错误信息">
          <el-input
            v-model="detailForm.errorMessage"
            type="textarea"
            class="detail-textarea-fixed"
            :disabled="generationLoading"
          />
        </el-form-item>

        <el-form-item v-if="detailForm.rejectReason" label="驳回原因">
          <el-input
            v-model="detailForm.rejectReason"
            type="textarea"
            class="detail-textarea-fixed"
            readonly
          />
        </el-form-item>
      </el-form>
    </el-card>

    <el-dialog
      v-model="rejectVisible"
      title="驳回内容"
      width="520px"
      destroy-on-close
    >
      <el-form label-width="86px">
        <el-form-item label="驳回原因">
          <el-input
            v-model="rejectForm.reason"
            type="textarea"
            :rows="5"
            placeholder="请输入需要修改的原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectVisible = false">
          取消
        </el-button>
        <el-button type="danger" :loading="rejectSaving" @click="submitReject">
          驳回
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.content-generation-detail-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-top-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.detail-page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.detail-page-header-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.detail-page-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.detail-page-id {
  font-size: 14px;
  color: #6b7280;
}

.detail-phase-label {
  font-size: 13px;
  color: #409eff;
}

.detail-action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-card :deep(.el-card__body) {
  padding-top: 20px;
}

.detail-textarea-fixed :deep(.el-textarea__inner) {
  height: 1000px !important;
  min-height: 1000px;
  max-height: 1000px;
  overflow-y: auto !important;
  resize: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
}

.detail-textarea-stream :deep(.el-textarea__inner) {
  background-color: #f9fafb;
}
</style>
