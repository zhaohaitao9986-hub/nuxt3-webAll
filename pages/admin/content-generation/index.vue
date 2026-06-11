<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import ContentGenerationBriefFields from '~/components/contentGeneration/ContentGenerationBriefFields.vue'
import {
  CONTENT_GENERATION_STATUS_OPTIONS,
  contentGenerationStatusLabel,
  contentGenerationStatusType,
  createContentGenerationBriefForm,
  validateContentGenerationBrief,
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
const categoryOptions = ref([])

const createVisible = ref(false)
const createSaving = ref(false)
const createFormRef = ref(null)
const createForm = reactive({
  ...createContentGenerationBriefForm(),
  title: '',
  slug: '',
  contentType: 'BUYER_GUIDE',
  targetType: 'guide',
  categoryId: '',
  toolId: '',
  limit: 5,
  status: 'draft',
})

const createRules = {
  title: [{ required: true, message: '请输入任务标题', trigger: 'blur' }],
}

function statusLabel(status) {
  return contentGenerationStatusLabel(status, statusMap.value)
}

function statusType(status) {
  return contentGenerationStatusType(status, statusMap.value)
}

function formatDt(iso) {
  if (!iso) {
    return '—'
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
    ElMessage.error(errorMessage(e, '加载失败'))
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

function openDetail(row) {
  router.push(`/admin/content-generation/${row.id}`)
}

async function batchGenerateTasks() {
  const ids = selectedRows.value.map((row) => row.id).filter(Boolean)
  if (!ids.length) {
    ElMessage.warning('请选择需要生成的任务')
    return
  }

  try {
    await ElMessageBox.confirm(`将批量生成 ${ids.length} 个任务，生成结果只会进入待审核状态。确定继续吗？`, '批量生成确认', {
      type: 'warning',
      confirmButtonText: '批量生成',
      cancelButtonText: '取消',
    })
  }
  catch {
    return
  }

  batchLoading.value = true
  try {
    const res = await adminAxios.post('/api/admin/content-generation/tasks/batch-generate', {
      ids,
      concurrency: 2,
    })
    const data = res.data || {}
    ElMessage.success(`批量生成完成：成功 ${data.success || 0}，失败 ${data.failed || 0}`)
    await loadList()
  }
  catch (e) {
    if (e?.response?.status === 401) {
      return
    }
    ElMessage.error(errorMessage(e, '批量生成失败'))
    await loadList()
  }
  finally {
    batchLoading.value = false
  }
}

function openCreate() {
  Object.assign(createForm, createContentGenerationBriefForm())
  createForm.title = ''
  createForm.slug = ''
  createForm.contentType = 'BUYER_GUIDE'
  createForm.targetType = 'guide'
  createForm.categoryId = ''
  createForm.toolId = ''
  createForm.limit = 5
  createForm.status = 'draft'
  createVisible.value = true
  nextTick(() => createFormRef.value?.clearValidate?.())
}

async function submitCreate() {
  try {
    await createFormRef.value?.validate?.()
  }
  catch {
    return false
  }

  createSaving.value = true
  try {
    const briefValidation = validateContentGenerationBrief(createForm)
    if (!briefValidation.ok) throw new Error(`缺少必要输入：${briefValidation.missing.join('、')}`)
    const brief = briefValidation.brief
    await adminAxios.post('/api/admin/content-generation/tasks', {
      title: createForm.title.trim(),
      slug: createForm.slug.trim(),
      contentType: createForm.contentType.trim(),
      targetType: createForm.targetType.trim(),
      categoryId: createForm.categoryId || null,
      toolId: createForm.primaryToolId || createForm.toolId || null,
      limit: createForm.limit,
      status: createForm.status,
      promptJson: { brief },
    })
    ElMessage.success('已创建')
    createVisible.value = false
    await loadList()
  }
  catch (e) {
    if (e?.response?.status === 401) {
      return
    }
    ElMessage.error(errorMessage(e, '创建失败'))
  }
  finally {
    createSaving.value = false
  }
}

async function changeStatus(row, status) {
  if (row.status === status) {
    return
  }
  if (status === 'published') {
    ElMessage.warning('请在详情页使用发布按钮')
    return
  }
  if (status === 'approved') {
    ElMessage.warning('请在详情页使用审核通过按钮')
    return
  }
  if (status === 'rejected') {
    ElMessage.warning('请在详情页使用驳回按钮')
    return
  }

  statusLoading[row.id] = true
  try {
    const res = await adminAxios.patch(`/api/admin/content-generation/tasks/${row.id}/status`, { status })
    row.status = res.data.status
    row.updatedAt = res.data.updatedAt
    ElMessage.success('状态已更新')
  }
  catch (e) {
    if (e?.response?.status === 401) {
      return
    }
    ElMessage.error(errorMessage(e, '状态更新失败'))
  }
  finally {
    statusLoading[row.id] = false
  }
}

onMounted(() => {
  loadOptions()
  loadList()
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
        <el-button
          type="success"
          :loading="batchLoading"
          :disabled="!selectedRows.length"
          @click="batchGenerateTasks"
        >
          批量生成
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
        <el-table-column type="selection" width="48" />
        <el-table-column prop="id" label="ID" width="72" />
        <el-table-column prop="title" label="任务标题" min-width="180" show-overflow-tooltip />
        <el-table-column prop="slug" label="Slug" min-width="160" show-overflow-tooltip />
        <el-table-column prop="contentType" label="内容类型" width="140" show-overflow-tooltip />
        <el-table-column label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" effect="light">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="168">
          <template #default="{ row }">
            {{ formatDt(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">
              详情
            </el-button>
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
      v-model="createVisible"
      title="新建内容生成任务"
      width="560px"
      destroy-on-close
    >
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="92px">
        <el-form-item label="任务标题" prop="title">
          <el-input v-model="createForm.title" placeholder="例如：AI 写作工具 Buyer Guide" />
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
          <el-input v-model="createForm.targetType" placeholder="guide / compare / alternative" />
        </el-form-item>
        <el-form-item label="分类" :required="String(createForm.contentType).toUpperCase() === 'CATEGORY_GUIDE'">
          <el-select
            v-model="createForm.categoryId"
            clearable
            filterable
            placeholder="可选，用于按分类读取工具"
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
        <ContentGenerationBriefFields :form="createForm" />
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
        <el-button type="primary" :loading="createSaving" @click="submitCreate">
          创建
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
</style>
