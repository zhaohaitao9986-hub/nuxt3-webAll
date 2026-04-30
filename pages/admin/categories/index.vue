<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'

definePageMeta({
  layout: 'admin',
})

const userStore = useUserStore()

const filters = reactive({
  name: '',
  level1Id: '',
  isActive: '',
})

const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)

const level1Options = ref([])
const activeFilterOptions = [
  { label: '全部', value: '' },
  { label: '启用', value: 'true' },
  { label: '停用', value: 'false' },
]

const dialogVisible = ref(false)
const editingId = ref(null)
const formRef = ref(null)
const saving = ref(false)

const canDeleteCategory = computed(() => userStore.user?.role === 'SUPERADMIN')

const form = reactive({
  name: '',
  handle: '',
  level1Id: null,
  sort: 0,
  is_active: true,
})

const handleLocked = ref(false)

const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  handle: [{ required: true, message: '请输入 handle', trigger: 'blur' }],
  level1Id: [{ required: true, message: '请选择一级分类', trigger: 'change' }],
}

const switchLoading = reactive({})

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
}

watch(
  () => form.name,
  (n) => {
    if (handleLocked.value) {
      return
    }
    form.handle = slugify(n)
  },
)

function onHandleInput() {
  handleLocked.value = true
}

async function loadLevel1() {
  try {
    const res = await useAdminFetch('/api/admin/categories/level1-options')
    level1Options.value = res.data || []
  }
  catch {
    level1Options.value = []
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
    if (filters.level1Id !== '' && filters.level1Id != null) {
      query.level1Id = filters.level1Id
    }
    if (filters.isActive !== '') {
      query.isActive = filters.isActive
    }
    const res = await useAdminFetch('/api/admin/categories/level2', { query })
    list.value = res.data || []
    total.value = res.total ?? 0
  }
  catch (e) {
    if (e?.statusCode === 401 || e?.status === 401) {
      return
    }
    ElMessage.error(e?.data?.statusMessage || e?.data?.message || e?.message || '加载失败')
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
  filters.level1Id = ''
  filters.isActive = ''
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
  editingId.value = null
  handleLocked.value = false
  form.name = ''
  form.handle = ''
  form.level1Id = null
  form.sort = 0
  form.is_active = true
  dialogVisible.value = true
  nextTick(() => formRef.value?.clearValidate?.())
}

function openEdit(row) {
  editingId.value = row.id
  handleLocked.value = true
  form.name = row.name
  form.handle = row.handle
  form.level1Id = row.level1Id
  form.sort = row.sort ?? 0
  form.is_active = row.is_active
  dialogVisible.value = true
  nextTick(() => formRef.value?.clearValidate?.())
}

async function saveDialog() {
  const el = formRef.value
  if (!el) {
    return
  }
  try {
    await el.validate()
  }
  catch {
    return
  }

  saving.value = true
  try {
    if (editingId.value == null) {
      await useAdminFetch('/api/admin/categories/level2', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          handle: form.handle.trim(),
          level1Id: form.level1Id,
          sort: form.sort,
          is_active: form.is_active,
        },
      })
      ElMessage.success('已创建')
    }
    else {
      await useAdminFetch(`/api/admin/categories/level2/${editingId.value}`, {
        method: 'PUT',
        body: {
          name: form.name.trim(),
          handle: form.handle.trim(),
          level1Id: form.level1Id,
          sort: form.sort,
          is_active: form.is_active,
        },
      })
      ElMessage.success('已保存')
    }
    dialogVisible.value = false
    await loadList()
  }
  catch (e) {
    if (e?.statusCode === 401 || e?.status === 401) {
      return
    }
    ElMessage.error(e?.data?.statusMessage || e?.data?.message || e?.message || '保存失败')
  }
  finally {
    saving.value = false
  }
}

async function onActiveChange(row, val) {
  const id = row.id
  switchLoading[id] = true
  try {
    await useAdminFetch(`/api/admin/categories/level2/${id}`, {
      method: 'PUT',
      body: { is_active: val },
    })
    row.is_active = val
    ElMessage.success('已更新')
  }
  catch (e) {
    if (e?.statusCode === 401 || e?.status === 401) {
      return
    }
    ElMessage.error(e?.data?.statusMessage || e?.data?.message || e?.message || '更新失败')
  }
  finally {
    switchLoading[id] = false
  }
}

function formatDt(iso) {
  if (!iso) {
    return '—'
  }
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('zh-CN')
}

function onDialogClosed() {
  handleLocked.value = false
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除二级分类「${row.name}」吗？关联的工具将移除此分类关系。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  }
  catch {
    return
  }
  try {
    await useAdminFetch(`/api/admin/categories/level2/${row.id}`, { method: 'DELETE' })
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
  loadLevel1()
  loadList()
})
</script>

<template>
  <div class="cat-page">
    <el-card shadow="never" class="cat-filter-card">
      <el-form :inline="true" class="cat-filter-form" @submit.prevent="onSearch">
        <el-form-item label="关键词">
          <el-input
            v-model="filters.name"
            clearable
            placeholder="名称"
            style="width: 180px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item label="一级分类">
          <el-select
            v-model="filters.level1Id"
            clearable
            placeholder="全部"
            style="width: 200px"
            filterable
          >
            <el-option
              v-for="opt in level1Options"
              :key="opt.id"
              :label="opt.name"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.isActive" placeholder="全部" clearable style="width: 120px">
            <el-option
              v-for="opt in activeFilterOptions"
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

    <el-card shadow="never" class="cat-table-card">
      <div class="cat-toolbar">
        <el-button type="primary" @click="openCreate">
          新建二级分类
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
        <el-table-column prop="name" label="名称" min-width="120" show-overflow-tooltip />
        <el-table-column prop="handle" label="Handle" min-width="120" show-overflow-tooltip />
        <el-table-column label="一级分类" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.level1?.name || '—' }}
          </template>
        </el-table-column>
        <el-table-column prop="tool_count" label="工具数" width="80" align="center" />
        <el-table-column prop="sort" label="排序" width="72" align="center" />
        <el-table-column label="启用" width="88" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.is_active"
              :loading="!!switchLoading[row.id]"
              @change="(v) => onActiveChange(row, v)"
            />
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="168">
          <template #default="{ row }">
            {{ formatDt(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">
              编辑
            </el-button>
            <el-button
              v-if="canDeleteCategory"
              link
              type="danger"
              @click="onDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="cat-pagination">
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
      v-model="dialogVisible"
      :title="editingId == null ? '新建二级分类' : '编辑二级分类'"
      width="520px"
      destroy-on-close
      @closed="onDialogClosed"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
      >
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="Handle" prop="handle">
          <el-input v-model="form.handle" maxlength="120" show-word-limit @input="onHandleInput" />
        </el-form-item>
        <el-form-item label="一级分类" prop="level1Id">
          <el-select v-model="form.level1Id" filterable placeholder="请选择" style="width: 100%">
            <el-option
              v-for="opt in level1Options"
              :key="opt.id"
              :label="opt.name"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="999999" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.is_active" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">
          取消
        </el-button>
        <el-button type="primary" :loading="saving" @click="saveDialog">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.cat-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cat-filter-card :deep(.el-card__body) {
  padding-bottom: 4px;
}

.cat-filter-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

.cat-table-card :deep(.el-card__body) {
  padding-top: 12px;
}

.cat-toolbar {
  margin-bottom: 12px;
}

.cat-pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
