<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import ContentGenerationBriefFields from '~/components/contentGeneration/ContentGenerationBriefFields.vue'
import {
  CONTENT_GENERATION_STATUS_OPTIONS,
  buildContentGenerationBrief,
  contentGenerationStatusLabel,
  contentGenerationStatusType,
  contentGenerationTargetType,
  createContentGenerationBriefForm,
} from '~/utils/contentGeneration'

definePageMeta({
  layout: 'admin',
})

const router = useRouter()
const adminAxios = useAdminAxios()

const statusOptions = CONTENT_GENERATION_STATUS_OPTIONS
const statusMap = computed(() => Object.fromEntries(statusOptions.map((item) => [item.value, item])))

const filters = reactive({
  keyword: '',
  status: '',
})

const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const statusLoading = reactive({})
const selectedRows = ref([])
const batchLoading = ref(false)
const batchDeleteLoading = ref(false)
const deleteLoading = reactive({})
const batchAbortController = ref(null)
const categoryOptions = ref([])
const batchCreateVisible = ref(false)
const batchCreateLoading = ref(false)
const batchCreateForm = reactive({
  taskType: 'guide',
  input: '',
  limitCount: 5,
  generationMode: 'production-seo-draft',
})
const batchCreateResults = ref([])
const batchGenerateResults = ref([])
const batchProgress = reactive({
  total: 0,
  running: 0,
  succeeded: 0,
  failed: 0,
  skipped: 0,
})
const jsonDialog = reactive({
  visible: false,
  title: '',
  content: '',
})

const createVisible = ref(false)
const createSaving = ref(false)
const briefPreparing = ref(false)
const createFormRef = ref(null)
const createForm = reactive({
  ...createContentGenerationBriefForm(),
  title: '',
  slug: '',
  contentType: 'BUYER_GUIDE',
  targetType: 'guides',
  categoryId: '',
  toolId: '',
  limit: 5,
  status: 'draft',
})

const createRules = {
}

function statusLabel(status) {
  return contentGenerationStatusLabel(status, statusMap.value)
}

function statusType(status) {
  return contentGenerationStatusType(status, statusMap.value)
}

function formatDt(iso) {
  if (!iso) {
    return '-'
  }
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('zh-CN')
}

function errorMessage(error, fallback) {
  return error?.response?.data?.statusMessage
    || error?.response?.data?.message
    || error?.message
    || fallback
}

async function loadList() {
  loading.value = true
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value,
    }
    if (filters.keyword.trim()) {
      params.keyword = filters.keyword.trim()
    }
    if (filters.status) {
      params.status = filters.status
    }

    const res = await adminAxios.get('/api/admin/content-generation/tasks', { params })
    list.value = res.data?.data || []
    total.value = res.data?.total ?? 0
  }
  catch (e) {
    if (e?.response?.status === 401) {
      return
    }
    ElMessage.error(errorMessage(e, 'Load failed'))
    list.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
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

function onSearch() {
  page.value = 1
  loadList()
}

function onReset() {
  filters.keyword = ''
  filters.status = ''
  page.value = 1
  loadList()
}

function onPageChange(p) {
  page.value = p
  loadList()
}

function onSizeChange(s) {
  pageSize.value = s
  page.value = 1
  loadList()
}

function onSelectionChange(rows) {
  selectedRows.value = rows
}

function hasBrief(row) {
  return !!(row?.promptJson?.brief && Object.keys(row.promptJson.brief).length)
}

function batchCreateStatusLabel(status) {
  const map = {
    created: '已创建',
    skipped: '已跳过',
    failed: '失败',
  }
  return map[status] || status || '-'
}

function batchCreateStatusType(status) {
  if (status === 'created') return 'success'
  if (status === 'skipped') return 'warning'
  if (status === 'failed') return 'danger'
  return 'info'
}

function canBatchGenerate(row) {
  return ['draft', 'pending', 'review_queue', 'failed'].includes(row?.status) && hasBrief(row)
}

function openDetail(row) {
  router.push(`/admin/content-generation/${row.id}`)
}

function canDelete(row) {
  return row?.status !== 'generating'
}

async function deleteRow(row) {
  if (!canDelete(row)) {
    ElMessage.warning('生成中的任务不能删除')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定删除任务 #${row.id}「${row.title || row.slug || ''}」吗？将同时删除任务内生成的 JSON 内容，若已发布还会删除前台对应页面。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  }
  catch {
    return
  }

  deleteLoading[row.id] = true
  try {
    await adminAxios.delete(`/api/admin/content-generation/tasks/${row.id}`)
    ElMessage.success('任务已删除')
    selectedRows.value = selectedRows.value.filter(item => item.id !== row.id)
    await loadList()
  }
  catch (e) {
    if (e?.response?.status === 401) return
    ElMessage.error(errorMessage(e, '删除失败'))
  }
  finally {
    deleteLoading[row.id] = false
  }
}

async function batchDeleteTasks() {
  const rows = selectedRows.value.filter(canDelete)
  if (!rows.length) {
    ElMessage.warning('请选择要删除的任务（生成中的任务不可删除）')
    return
  }
  const skipped = selectedRows.value.length - rows.length
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${rows.length} 个任务吗？将同时删除各任务生成的 JSON 内容，已发布任务还会删除前台对应页面。${skipped ? `（已跳过 ${skipped} 个生成中的任务）` : ''}`,
      '批量删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  }
  catch {
    return
  }

  batchDeleteLoading.value = true
  try {
    const res = await adminAxios.post('/api/admin/content-generation/tasks/batch-delete', {
      ids: rows.map(row => row.id),
    })
    const data = res.data || {}
    const pageCount = (data.deletedContentPageIds || []).length
    ElMessage.success(`已删除 ${data.deleted || rows.length} 个任务${pageCount ? `，含 ${pageCount} 个已发布页面` : ''}`)
    selectedRows.value = []
    await loadList()
  }
  catch (e) {
    if (e?.response?.status === 401) return
    ElMessage.error(errorMessage(e, '批量删除失败'))
  }
  finally {
    batchDeleteLoading.value = false
  }
}

async function batchGenerateTasksV2() {
  const ids = selectedRows.value.filter(canBatchGenerate).map(row => row.id).filter(Boolean)
  if (!ids.length) {
    ElMessage.warning('Please select draft, pending, or failed tasks with prepared briefs.')
    return
  }

  batchLoading.value = true
  batchGenerateResults.value = []
  Object.assign(batchProgress, { total: ids.length, running: ids.length, succeeded: 0, failed: 0, skipped: 0 })
  batchAbortController.value = new AbortController()
  try {
    const res = await adminAxios.post('/api/admin/content-generation/tasks/batch-generate', {
      ids,
      concurrency: 1,
    }, { signal: batchAbortController.value.signal })
    const data = res.data || {}
    batchGenerateResults.value = data.results || []
    Object.assign(batchProgress, {
      total: data.total || ids.length,
      running: data.running || 0,
      succeeded: data.succeeded || data.success || 0,
      failed: data.failed || 0,
      skipped: data.skipped || 0,
    })
    ElMessage.success(`Batch generation finished: ${batchProgress.succeeded} succeeded, ${batchProgress.failed} failed, ${batchProgress.skipped} skipped.`)
    await loadList()
  }
  catch (e) {
    if (e?.response?.status === 401) return
    if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') {
      ElMessage.warning('Batch generation request stopped.')
    }
    else {
      ElMessage.error(errorMessage(e, 'Batch generation failed'))
    }
    await loadList()
  }
  finally {
    batchLoading.value = false
    batchProgress.running = 0
    batchAbortController.value = null
  }
}

function stopBatchGenerate() {
  batchAbortController.value?.abort?.()
}

function openBatchCreate() {
  batchCreateForm.taskType = 'guide'
  batchCreateForm.input = ''
  batchCreateForm.limitCount = 5
  batchCreateForm.generationMode = 'production-seo-draft'
  batchCreateResults.value = []
  batchCreateVisible.value = true
}

async function submitBatchCreate() {
  if (!batchCreateForm.input.trim()) {
    ElMessage.warning('Please enter batch input.')
    return
  }
  batchCreateLoading.value = true
  try {
    const res = await adminAxios.post('/api/admin/content-generation/tasks/batch-create-brief', {
      taskType: batchCreateForm.taskType,
      input: batchCreateForm.input,
      limitCount: batchCreateForm.limitCount,
      generationMode: batchCreateForm.generationMode,
    })
    const data = res.data || {}
    batchCreateResults.value = [
      ...(data.createdItems || []),
      ...(data.skippedItems || []),
      ...(data.failedItems || []),
    ]
    ElMessage.success(`Created ${data.summary?.created || 0}, skipped ${data.summary?.skipped || 0}, failed ${data.summary?.failed || 0}.`)
    await loadList()
  }
  catch (e) {
    if (e?.response?.status === 401) return
    ElMessage.error(errorMessage(e, 'Batch create failed'))
  }
  finally {
    batchCreateLoading.value = false
  }
}

async function prepareBriefForRow(row) {
  try {
    await adminAxios.post(`/api/admin/content-generation/tasks/${row.id}/prepare-brief`, {
      contentType: row.contentType,
      categoryId: row.categoryId || null,
      primaryToolId: row.toolId || row.promptJson?.brief?.primaryToolId || null,
      secondaryToolId: row.promptJson?.brief?.secondaryToolId || null,
    })
    ElMessage.success('Brief prepared.')
    await loadList()
  }
  catch (e) {
    if (e?.response?.status === 401) return
    ElMessage.error(errorMessage(e, 'Prepare brief failed'))
  }
}

async function generateRow(row) {
  batchLoading.value = true
  try {
    await adminAxios.post(`/api/admin/content-generation/tasks/${row.id}/generate`)
    ElMessage.success('Content generated.')
    await loadList()
  }
  catch (e) {
    if (e?.response?.status === 401) return
    ElMessage.error(errorMessage(e, 'Generate content failed'))
    await loadList()
  }
  finally {
    batchLoading.value = false
  }
}

function showJson(title, value) {
  jsonDialog.title = title
  jsonDialog.content = JSON.stringify(value || {}, null, 2)
  jsonDialog.visible = true
}

function openCreate() {
  Object.assign(createForm, createContentGenerationBriefForm())
  createForm.title = ''
  createForm.slug = ''
  createForm.contentType = 'BUYER_GUIDE'
  createForm.targetType = 'guides'
  createForm.categoryId = ''
  createForm.toolId = ''
  createForm.limit = 5
  createForm.status = 'draft'
  createVisible.value = true
  nextTick(() => createFormRef.value?.clearValidate?.())
}

function validatePrepareSeed() {
  const type = String(createForm.contentType).toUpperCase()
  if (['BUYER_GUIDE', 'CATEGORY_GUIDE', 'COMPARISON', 'ALTERNATIVE'].includes(type) && !createForm.categoryId) return 'Please select a category.'
  if (['TUTORIAL', 'COMPARISON', 'ALTERNATIVE'].includes(type) && !createForm.primaryToolId) return 'Please select a primary tool.'
  return ''
}
async function submitCreate(prepareBrief = false) {
  try {
    await createFormRef.value?.validate?.()
  }
  catch {
    return false
  }

  createSaving.value = true
  try {
    if (prepareBrief) {
      const seedError = validatePrepareSeed()
      if (seedError) throw new Error(seedError)
      briefPreparing.value = true
    }
    const response = await adminAxios.post('/api/admin/content-generation/tasks', {
      title: createForm.title.trim(),
      slug: createForm.slug.trim(),
      contentType: createForm.contentType.trim(),
      targetType: createForm.targetType.trim(),
      categoryId: createForm.categoryId || null,
      toolId: createForm.primaryToolId || createForm.toolId || null,
      limit: createForm.limit,
      status: createForm.status,
      promptJson: { brief: buildContentGenerationBrief(createForm) },
    })
    if (prepareBrief) {
      await adminAxios.post(`/api/admin/content-generation/tasks/${response.data.id}/prepare-brief`, {
        contentType: createForm.contentType,
        categoryId: createForm.categoryId || null,
        primaryToolId: createForm.primaryToolId || null,
        secondaryToolId: createForm.secondaryToolId || null,
      })
      ElMessage.success('Task created and brief prepared.')
      createVisible.value = false
      await loadList()
      router.push(`/admin/content-generation/${response.data.id}`)
      return
    }
    ElMessage.success('Task created.')
    createVisible.value = false
    await loadList()
  }
  catch (e) {
    if (e?.response?.status === 401) return
    ElMessage.error(errorMessage(e, 'Create failed'))
  }
  finally {
    createSaving.value = false
    briefPreparing.value = false
  }
}
async function changeStatus(row, status) {
  if (row.status === status) return
  if (status === 'published') {
    ElMessage.warning('Use the detail page to publish approved content.')
    return
  }
  if (status === 'approved') {
    ElMessage.warning('Use the detail page to approve review content.')
    return
  }
  if (status === 'rejected') {
    ElMessage.warning('Use the detail page to reject content with a reason.')
    return
  }

  statusLoading[row.id] = true
  try {
    const res = await adminAxios.patch(`/api/admin/content-generation/tasks/${row.id}/status`, { status })
    row.status = res.data.status
    row.updatedAt = res.data.updatedAt
    ElMessage.success('Status updated.')
  }
  catch (e) {
    if (e?.response?.status === 401) return
    ElMessage.error(errorMessage(e, 'Status update failed'))
  }
  finally {
    statusLoading[row.id] = false
  }
}
onMounted(() => {
  loadOptions()
  loadList()
})

watch(() => createForm.contentType, (contentType) => {
  createForm.targetType = contentGenerationTargetType(contentType)
  createForm.categoryId = ''
  createForm.primaryToolId = ''
  createForm.secondaryToolId = ''
  createForm.alternativeToolIds = []
})
</script>

<template>
  <div class="content-generation-page">
    <el-card shadow="never" class="content-filter-card">
      <el-form :inline="true" class="content-filter-form" @submit.prevent="onSearch">
        <el-form-item label="关键词">
          <el-input
            v-model="filters.keyword"
            clearable
            placeholder="标题 / slug / 类型"
            style="width: 220px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" clearable placeholder="全部" style="width: 150px">
            <el-option
              v-for="opt in statusOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSearch">
            搜索
          </el-button>
          <el-button @click="onReset">
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="content-table-card">
      <div class="content-table-toolbar">
        <el-button type="primary" @click="openCreate">
          新建任务
        </el-button>
        <el-button type="primary" plain @click="openBatchCreate">
          批量创建
        </el-button>
        <el-button
          type="success"
          :loading="batchLoading"
          :disabled="!selectedRows.length"
          @click="batchGenerateTasksV2"
        >
          批量生成
        </el-button>
        <el-button v-if="batchLoading" type="danger" plain @click="stopBatchGenerate">
          停止批量
        </el-button>
        <el-button
          type="danger"
          plain
          :loading="batchDeleteLoading"
          :disabled="!selectedRows.length || batchLoading"
          @click="batchDeleteTasks"
        >
          批量删除
        </el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="list"
        row-key="id"
        border
        stripe
        style="width: 100%"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="48" fixed="left" />
        <el-table-column prop="id" label="ID" width="72" fixed="left" />
        <el-table-column prop="title" label="任务标题" min-width="180" show-overflow-tooltip fixed="left" />
        <el-table-column label="任务状态" width="110" align="center" fixed="left">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" effect="light">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="slug" label="Slug" min-width="160" show-overflow-tooltip />
        <el-table-column prop="contentType" label="内容类型" width="140" show-overflow-tooltip />
        <el-table-column label="分类/对比" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.categorySlug || row.toolPair || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="score" label="评分" width="88" />
        <el-table-column prop="wordCount" label="字数" width="92" />
        <el-table-column prop="errorMessage" label="错误" min-width="180" show-overflow-tooltip />
        <el-table-column label="生成时间" width="168">
          <template #default="{ row }">
            {{ formatDt(row.generatedAt || row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="480" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">
              详情
            </el-button>
            <el-button link type="primary" @click="prepareBriefForRow(row)">
              生成 Brief
            </el-button>
            <el-button link type="success" :disabled="!hasBrief(row)" @click="generateRow(row)">
              {{ row.status === 'failed' ? '重试' : '生成内容' }}
            </el-button>
            <el-dropdown trigger="click">
              <el-button link type="primary">
                查看
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="showJson('Brief', row.promptJson?.brief)">
                    查看 Brief
                  </el-dropdown-item>
                  <el-dropdown-item @click="showJson('Validation', row.validationJson)">
                    查看校验
                  </el-dropdown-item>
                  <el-dropdown-item @click="showJson('Content', row.contentJson || row.generatedContent || row.finalContent)">
                    查看内容
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-dropdown
              trigger="click"
              :disabled="!!statusLoading[row.id]"
              @command="(status) => changeStatus(row, status)"
            >
              <el-button link type="primary" :loading="!!statusLoading[row.id]">
                改状态
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="opt in statusOptions"
                    :key="opt.value"
                    :command="opt.value"
                    :disabled="row.status === opt.value"
                  >
                    {{ opt.label }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button
              link
              type="danger"
              :disabled="!canDelete(row)"
              :loading="!!deleteLoading[row.id]"
              @click="deleteRow(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-alert
        v-if="batchLoading || batchGenerateResults.length"
        class="batch-progress"
        type="info"
        :closable="false"
        show-icon
      >
        <template #title>
          批量进度：共 {{ batchProgress.total }}，
          进行中 {{ batchProgress.running }}，
          成功 {{ batchProgress.succeeded }}，
          失败 {{ batchProgress.failed }}，
          跳过 {{ batchProgress.skipped }}
        </template>
      </el-alert>

      <el-table
        v-if="batchGenerateResults.length"
        :data="batchGenerateResults"
        border
        size="small"
        class="batch-result-table"
      >
        <el-table-column prop="taskId" label="taskId" width="90" />
        <el-table-column prop="contentType" label="contentType" width="140" />
        <el-table-column prop="title" label="title" min-width="180" show-overflow-tooltip />
        <el-table-column prop="slug" label="slug" min-width="160" show-overflow-tooltip />
        <el-table-column prop="score" label="score" width="80" />
        <el-table-column prop="wordCount" label="字数" width="100" />
        <el-table-column label="任务状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" effect="light">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="errorMessage" label="错误" min-width="220" show-overflow-tooltip />
        <el-table-column label="warnings" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            {{ Array.isArray(row.warnings) ? row.warnings.length : 0 }}
          </template>
        </el-table-column>
      </el-table>

      <div class="content-pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="onPageChange"
          @size-change="onSizeChange"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="batchCreateVisible"
      title="批量创建任务"
      width="760px"
      destroy-on-close
    >
      <el-form label-width="140px">
        <el-form-item label="taskType">
          <el-radio-group v-model="batchCreateForm.taskType">
            <el-radio-button label="guide">
              Guide
            </el-radio-button>
            <el-radio-button label="compare">
              Compare
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Batch Input">
          <el-input
            v-model="batchCreateForm.input"
            type="textarea"
            :rows="8"
            :placeholder="batchCreateForm.taskType === 'guide' ? 'ai-writing-assistants\nai-summarizer' : 'ChatGPT vs Claude\nGrammarly vs QuillBot'"
          />
        </el-form-item>
        <el-form-item label="limitCount">
          <el-input-number v-model="batchCreateForm.limitCount" :min="1" :max="30" />
        </el-form-item>
        <el-form-item label="generationMode">
          <el-input v-model="batchCreateForm.generationMode" />
        </el-form-item>
      </el-form>

      <el-table
        v-if="batchCreateResults.length"
        :data="batchCreateResults"
        border
        size="small"
      >
        <el-table-column prop="input" label="输入" min-width="160" show-overflow-tooltip />
        <el-table-column label="结果" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="batchCreateStatusType(row.status)" effect="light">
              {{ batchCreateStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="taskId" label="taskId" width="90" />
        <el-table-column prop="title" label="title" min-width="180" show-overflow-tooltip />
        <el-table-column prop="slug" label="slug" min-width="160" show-overflow-tooltip />
        <el-table-column prop="reason" label="reason" min-width="180" show-overflow-tooltip />
      </el-table>

      <template #footer>
        <el-button @click="batchCreateVisible = false">
          关闭
        </el-button>
        <el-button type="primary" :loading="batchCreateLoading" @click="submitBatchCreate">
          创建并准备 Brief
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="jsonDialog.visible" :title="jsonDialog.title" width="760px">
      <pre class="json-preview">{{ jsonDialog.content }}</pre>
    </el-dialog>

    <el-dialog
      v-model="createVisible"
      title="新建内容生成任务"
      width="560px"
      destroy-on-close
    >
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="92px">
        <el-form-item label="任务标题">
          <el-input v-model="createForm.title" placeholder="可选，未填写时自动生成草稿标题" />
        </el-form-item>
        <el-form-item label="Slug">
          <el-input v-model="createForm.slug" placeholder="ai-writing-tools-buyer-guide" />
        </el-form-item>
        <el-form-item label="内容类型">
          <el-select v-model="createForm.contentType" style="width: 100%">
            <el-option label="BUYER_GUIDE" value="BUYER_GUIDE" />
            <el-option label="CATEGORY_GUIDE" value="CATEGORY_GUIDE" />
            <el-option label="TUTORIAL" value="TUTORIAL" />
            <el-option label="COMPARISON" value="COMPARISON" />
            <el-option label="ALTERNATIVE" value="ALTERNATIVE" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标类型">
          <el-input v-model="createForm.targetType" readonly />
        </el-form-item>
        <el-form-item v-if="!['COMPARISON', 'ALTERNATIVE'].includes(String(createForm.contentType).toUpperCase())" label="分类" :required="['BUYER_GUIDE', 'CATEGORY_GUIDE'].includes(String(createForm.contentType).toUpperCase())">
          <el-select
            v-model="createForm.categoryId"
            clearable
            filterable
            placeholder="请选择分类"
            style="width: 100%"
          >
            <el-option
              v-for="opt in categoryOptions"
              :key="opt.id"
              :label="opt.label || opt.name"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <ContentGenerationBriefFields :form="createForm" compact />
        <el-form-item label="数量">
          <el-input-number v-model="createForm.limit" :min="1" :max="30" style="width: 160px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="createForm.status" style="width: 100%">
            <el-option
              v-for="opt in statusOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">
          取消
        </el-button>
        <el-button :loading="createSaving && !briefPreparing" @click="submitCreate(false)">
          创建
        </el-button>
        <el-button type="primary" :loading="briefPreparing" @click="submitCreate(true)">
          AI 生成 Brief
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.content-generation-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.content-filter-card :deep(.el-card__body) {
  padding-bottom: 4px;
}

.content-filter-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

.content-table-card :deep(.el-card__body) {
  padding-top: 12px;
}

.content-table-toolbar {
  margin-bottom: 12px;
  display: flex;
  gap: 8px;
}

.content-pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.batch-progress,
.batch-result-table {
  margin-top: 12px;
}

.json-preview {
  max-height: 560px;
  overflow: auto;
  padding: 12px;
  margin: 0;
  background: #111827;
  color: #e5e7eb;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
