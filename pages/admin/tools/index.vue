<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'

definePageMeta({
  layout: 'admin',
})

const userStore = useUserStore()

const filters = reactive({
  name: '',
  categoryId: '',
  status: '',
})

const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)

const categoryOptions = ref([])
const statusOptions = [
  { label: '全部', value: '' },
  { label: '草稿', value: '0' },
  { label: '已发布', value: '1' },
  { label: '已下架', value: '-1' },
]

const statusLoading = reactive({})

const canDeleteTool = computed(() => userStore.user?.role === 'SUPERADMIN')

function formatCategoryNames(row) {
  const tcs = row.toolCategories
  if (!tcs?.length) {
    return '—'
  }
  return tcs.map((tc) => tc.category?.name).filter(Boolean).join('、') || '—'
}

function formatDt(iso) {
  if (!iso) {
    return '—'
  }
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('zh-CN')
}

function logoSrc(row) {
  return row.image || row.website_logo || ''
}

async function loadCategories() {
  try {
    const res = await useAdminFetch('/api/admin/categories/options')
    categoryOptions.value = res.data || []
  }
  catch {
    categoryOptions.value = []
  }
}

async function loadList() {
  loading.value = true
  try {
    const query = {
      page: page.value,
      pageSize: pageSize.value,
    }
    if (filters.name.trim()) {
      query.name = filters.name.trim()
    }
    if (filters.categoryId !== '' && filters.categoryId != null) {
      query.categoryId = filters.categoryId
    }
    if (filters.status !== '' && filters.status != null) {
      query.status = Number(filters.status)
    }
    const res = await useAdminFetch('/api/admin/tools', { query })
    list.value = res.data || []
    total.value = res.total ?? 0
  }
  catch (e) {
    if (e?.statusCode === 401 || e?.status === 401) {
      return
    }
    ElMessage.error(e?.data?.message || e?.message || '加载失败')
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
  filters.name = ''
  filters.categoryId = ''
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

async function onStatusChange(row, published) {
  const id = row.id
  const next = published ? 1 : 0
  statusLoading[id] = true
  try {
    await useAdminFetch(`/api/admin/tools/${id}`, {
      method: 'PUT',
      body: { status: next },
    })
    row.status = next
    ElMessage.success('状态已更新')
  }
  catch (e) {
    if (e?.statusCode === 401 || e?.status === 401) {
      return
    }
    ElMessage.error(e?.data?.statusMessage || e?.data?.message || e?.message || '更新失败')
  }
  finally {
    statusLoading[id] = false
  }
}

function onEdit(row) {
  navigateTo({
    path: '/admin/tools/edit',
    query: { id: String(row.id) },
  })
}

function onCreate() {
  navigateTo({ path: '/admin/tools/edit' })
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.name}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  }
  catch {
    return
  }
  try {
    await useAdminFetch(`/api/admin/tools/${row.id}`, { method: 'DELETE' })
    ElMessage.success('已删除')
    await loadList()
  }
  catch (e) {
    if (e?.statusCode === 401 || e?.status === 401) {
      return
    }
    if (e?.statusCode === 403 || e?.status === 403) {
      ElMessage.warning(e?.data?.statusMessage || '权限不足')
      return
    }
    ElMessage.error(e?.data?.statusMessage || e?.data?.message || e?.message || '删除失败')
  }
}

onMounted(() => {
  loadCategories()
  loadList()
})
</script>

<template>
  <div class="tools-page">
    <el-card shadow="never" class="tools-filter-card">
      <el-form :inline="true" class="tools-filter-form" @submit.prevent="onSearch">
        <el-form-item label="关键词">
          <el-input
            v-model="filters.name"
            clearable
            placeholder="名称模糊搜索"
            style="width: 200px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item label="分类">
          <el-select
            v-model="filters.categoryId"
            clearable
            placeholder="全部"
            style="width: 240px"
            filterable
          >
            <el-option
              v-for="opt in categoryOptions"
              :key="opt.id"
              :label="opt.label"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部" clearable style="width: 140px">
            <el-option
              v-for="opt in statusOptions"
              :key="String(opt.value)"
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

    <el-card shadow="never" class="tools-table-card">
      <div class="tools-table-toolbar">
        <el-button type="primary" @click="onCreate">
          新建工具
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
        <el-table-column label="Logo" width="88">
          <template #default="{ row }">
            <el-image
              v-if="logoSrc(row)"
              :src="logoSrc(row)"
              fit="cover"
              class="tools-logo"
              :preview-src-list="[logoSrc(row)]"
              preview-teleported
            />
            <span v-else class="tools-logo-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.status === 1"
              :loading="!!statusLoading[row.id]"
              inline-prompt
              active-text="发"
              inactive-text="藏"
              @change="(val) => onStatusChange(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column label="分类" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatCategoryNames(row) }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="168">
          <template #default="{ row }">
            {{ formatDt(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="onEdit(row)">
              编辑
            </el-button>
            <el-button
              v-if="canDeleteTool"
              link
              type="danger"
              @click="onDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="tools-pagination">
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
  </div>
</template>

<style scoped>
.tools-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tools-filter-card :deep(.el-card__body) {
  padding-bottom: 4px;
}

.tools-filter-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

.tools-table-card :deep(.el-card__body) {
  padding-top: 12px;
}

.tools-table-toolbar {
  margin-bottom: 12px;
}

.tools-logo {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

.tools-logo-empty {
  color: var(--el-text-color-secondary);
}

.tools-pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
