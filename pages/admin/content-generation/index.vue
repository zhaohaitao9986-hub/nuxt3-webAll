<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'

definePageMeta({
  layout: 'admin',
})

const adminAxios = useAdminAxios()

const statusOptions = [
  { label: '草稿', value: 'draft', type: 'info' },
  { label: '待生成', value: 'pending', type: 'warning' },
  { label: '生成中', value: 'generating', type: 'primary' },
  { label: '失败', value: 'failed', type: 'danger' },
  { label: '待审核', value: 'review', type: 'warning' },
  { label: '已通过', value: 'approved', type: 'success' },
  { label: '已驳回', value: 'rejected', type: 'danger' },
  { label: '已发布', value: 'published', type: 'success' },
]

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

const createVisible = ref(false)
const createSaving = ref(false)
const createFormRef = ref(null)
const createForm = reactive({
  title: '',
  slug: '',
  contentType: 'BUYER_GUIDE',
  targetType: 'guide',
  status: 'draft',
})

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailSaving = ref(false)
const editingId = ref(null)
const detailFormRef = ref(null)
const detailForm = reactive({
  title: '',
  slug: '',
  contentType: '',
  targetType: '',
  status: 'draft',
  contentJsonText: '',
  sourceDataJsonText: '',
  rawOutput: '',
  validationJsonText: '',
  errorMessage: '',
})

const createRules = {
  title: [{ required: true, message: '请输入任务标题', trigger: 'blur' }],
}

const detailRules = {
  title: [{ required: true, message: '请输入任务标题', trigger: 'blur' }],
}

function statusLabel(status) {
  return statusMap.value[status]?.label || status || '未知'
}

function statusType(status) {
  return statusMap.value[status]?.type || 'info'
}

function formatDt(iso) {
  if (!iso) {
    return '—'
  }
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('zh-CN')
}

function stringifyJson(value) {
  if (value === null || value === undefined || value === '') {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  return JSON.stringify(value, null, 2)
}

function parseJsonText(text, label) {
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

function openCreate() {
  createForm.title = ''
  createForm.slug = ''
  createForm.contentType = 'BUYER_GUIDE'
  createForm.targetType = 'guide'
  createForm.status = 'draft'
  createVisible.value = true
  nextTick(() => createFormRef.value?.clearValidate?.())
}

async function submitCreate() {
  try {
    await createFormRef.value?.validate?.()
  }
  catch {
    return
  }

  createSaving.value = true
  try {
    await adminAxios.post('/api/admin/content-generation/tasks', {
      title: createForm.title.trim(),
      slug: createForm.slug.trim(),
      contentType: createForm.contentType.trim(),
      targetType: createForm.targetType.trim(),
      status: createForm.status,
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

function fillDetailForm(row) {
  editingId.value = row.id
  detailForm.title = row.title || ''
  detailForm.slug = row.slug || ''
  detailForm.contentType = row.contentType || ''
  detailForm.targetType = row.targetType || ''
  detailForm.status = row.status || 'draft'
  detailForm.contentJsonText = stringifyJson(row.contentJson)
  detailForm.sourceDataJsonText = stringifyJson(row.sourceDataJson)
  detailForm.rawOutput = row.rawOutput || ''
  detailForm.validationJsonText = stringifyJson(row.validationJson)
  detailForm.errorMessage = row.errorMessage || ''
}

async function openDetail(row) {
  detailVisible.value = true
  detailLoading.value = true
  try {
    const res = await adminAxios.get(`/api/admin/content-generation/tasks/${row.id}`)
    fillDetailForm(res.data)
  }
  catch (e) {
    if (e?.response?.status === 401) {
      return
    }
    ElMessage.error(errorMessage(e, '加载详情失败'))
    detailVisible.value = false
  }
  finally {
    detailLoading.value = false
  }
}

async function saveDetail() {
  try {
    await detailFormRef.value?.validate?.()
  }
  catch {
    return
  }

  let payload
  try {
    payload = {
      title: detailForm.title.trim(),
      slug: detailForm.slug.trim(),
      contentType: detailForm.contentType.trim(),
      targetType: detailForm.targetType.trim(),
      contentJson: parseJsonText(detailForm.contentJsonText, '内容 JSON'),
      sourceDataJson: parseJsonText(detailForm.sourceDataJsonText, '来源 JSON'),
      rawOutput: detailForm.rawOutput,
      validationJson: parseJsonText(detailForm.validationJsonText, '校验 JSON'),
      errorMessage: detailForm.errorMessage,
    }
  }
  catch (e) {
    ElMessage.error(e.message)
    return
  }

  detailSaving.value = true
  try {
    const res = await adminAxios.put(`/api/admin/content-generation/tasks/${editingId.value}`, payload)
    fillDetailForm(res.data)
    ElMessage.success('已保存')
    await loadList()
  }
  catch (e) {
    if (e?.response?.status === 401) {
      return
    }
    ElMessage.error(errorMessage(e, '保存失败'))
  }
  finally {
    detailSaving.value = false
  }
}

async function changeStatus(row, status) {
  if (row.status === status) {
    return
  }
  if (status === 'published') {
    try {
      await ElMessageBox.confirm('本阶段不会发布正式内容，仅更新任务状态。确定继续吗？', '状态确认', {
        type: 'warning',
        confirmButtonText: '确定',
        cancelButtonText: '取消',
      })
    }
    catch {
      return
    }
  }

  statusLoading[row.id] = true
  try {
    const res = await adminAxios.patch(`/api/admin/content-generation/tasks/${row.id}/status`, { status })
    row.status = res.data.status
    row.updatedAt = res.data.updatedAt
    if (editingId.value === row.id) {
      detailForm.status = res.data.status
    }
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
      </div>

      <el-table
        v-loading="loading"
        :data="list"
        row-key="id"
        border
        stripe
        style="width: 100%"
      >
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

    <el-drawer
      v-model="detailVisible"
      title="任务详情"
      size="720px"
      destroy-on-close
    >
      <div v-loading="detailLoading" class="detail-drawer-body">
        <el-form ref="detailFormRef" :model="detailForm" :rules="detailRules" label-width="96px">
          <el-form-item label="任务标题" prop="title">
            <el-input v-model="detailForm.title" />
          </el-form-item>
          <el-form-item label="Slug">
            <el-input v-model="detailForm.slug" />
          </el-form-item>
          <el-form-item label="内容类型">
            <el-input v-model="detailForm.contentType" />
          </el-form-item>
          <el-form-item label="目标类型">
            <el-input v-model="detailForm.targetType" />
          </el-form-item>
          <el-form-item label="当前状态">
            <el-tag :type="statusType(detailForm.status)">
              {{ statusLabel(detailForm.status) }}
            </el-tag>
          </el-form-item>
          <el-form-item label="内容 JSON">
            <el-input
              v-model="detailForm.contentJsonText"
              type="textarea"
              :rows="8"
              resize="vertical"
            />
          </el-form-item>
          <el-form-item label="来源 JSON">
            <el-input
              v-model="detailForm.sourceDataJsonText"
              type="textarea"
              :rows="6"
              resize="vertical"
            />
          </el-form-item>
          <el-form-item label="原始输出">
            <el-input
              v-model="detailForm.rawOutput"
              type="textarea"
              :rows="5"
              resize="vertical"
            />
          </el-form-item>
          <el-form-item label="校验 JSON">
            <el-input
              v-model="detailForm.validationJsonText"
              type="textarea"
              :rows="5"
              resize="vertical"
            />
          </el-form-item>
          <el-form-item label="错误信息">
            <el-input
              v-model="detailForm.errorMessage"
              type="textarea"
              :rows="3"
              resize="vertical"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">
          关闭
        </el-button>
        <el-button type="primary" :loading="detailSaving" @click="saveDetail">
          保存
        </el-button>
      </template>
    </el-drawer>
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
}

.content-pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.detail-drawer-body {
  min-height: 320px;
  padding-right: 4px;
}
</style>
