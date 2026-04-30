<script setup>
import { ElMessage } from 'element-plus'

definePageMeta({
  layout: 'admin',
})

const userStore = useUserStore()

const isSuper = computed(() => userStore.user?.role === 'SUPERADMIN')

const filters = reactive({
  keyword: '',
  role: '',
})

const roleFilterOptions = [
  { label: '全部角色', value: '' },
  { label: 'USER', value: 'USER' },
  { label: 'ADMIN', value: 'ADMIN' },
  { label: 'SUPERADMIN', value: 'SUPERADMIN' },
]

const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)

const dialogVisible = ref(false)
const editingRow = ref(null)
const formRef = ref(null)
const saving = ref(false)

const form = reactive({
  name: '',
  role: 'USER',
  isActive: true,
  password: '',
})

const rules = {
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
}

async function loadList() {
  loading.value = true
  try {
    const query = { page: page.value, pageSize: pageSize.value }
    if (filters.keyword.trim()) {
      query.keyword = filters.keyword.trim()
    }
    if (filters.role) {
      query.role = filters.role
    }
    const res = await useAdminFetch('/api/admin/users', { query })
    list.value = res.data || []
    total.value = res.total ?? 0
  }
  catch (e) {
    if (e?.statusCode === 401 || e?.status === 401) {
      return
    }
    ElMessage.error(e?.data?.statusMessage || e?.message || '加载失败')
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
  filters.role = ''
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

function roleTagType(role) {
  if (role === 'SUPERADMIN') {
    return 'danger'
  }
  if (role === 'ADMIN') {
    return 'warning'
  }
  return 'info'
}

function openEdit(row) {
  editingRow.value = row
  form.name = row.name ?? ''
  form.role = row.role
  form.isActive = row.isActive
  form.password = ''
  dialogVisible.value = true
  nextTick(() => formRef.value?.clearValidate?.())
}

async function saveUser() {
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

  const id = editingRow.value?.id
  if (id == null) {
    return
  }

  saving.value = true
  try {
    const body = {
      name: form.name.trim() || null,
      role: form.role,
      isActive: form.isActive,
    }
    if (form.password.trim()) {
      body.password = form.password.trim()
    }
    const updated = await useAdminFetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      body,
    })
    ElMessage.success('已保存')
    dialogVisible.value = false
    if (id === userStore.user?.id && userStore.token) {
      userStore.setAuth(userStore.token, {
        ...userStore.user,
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        avatar: updated.avatar,
      })
    }
    await loadList()
  }
  catch (e) {
    if (e?.statusCode === 401 || e?.status === 401) {
      return
    }
    ElMessage.error(e?.data?.statusMessage || e?.message || '保存失败')
  }
  finally {
    saving.value = false
  }
}

function formatDt(iso) {
  if (!iso) {
    return '—'
  }
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('zh-CN')
}

onMounted(loadList)
</script>

<template>
  <div class="users-page">
    <el-alert
      v-if="!isSuper"
      title="仅超级管理员可修改用户角色、状态与密码；您可查看列表。"
      type="info"
      show-icon
      :closable="false"
      class="users-tip"
    />

    <el-card shadow="never" class="users-filter-card">
      <el-form :inline="true" @submit.prevent="onSearch">
        <el-form-item label="关键词">
          <el-input
            v-model="filters.keyword"
            clearable
            placeholder="邮箱或姓名"
            style="width: 200px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="filters.role" placeholder="全部" clearable style="width: 160px">
            <el-option
              v-for="opt in roleFilterOptions"
              :key="opt.value || 'all'"
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

    <el-card shadow="never">
      <el-table v-loading="loading" :data="list" row-key="id" border stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="72" />
        <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip />
        <el-table-column prop="name" label="姓名" min-width="100" show-overflow-tooltip />
        <el-table-column label="角色" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="roleTagType(row.role)" size="small">
              {{ row.role }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="88" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
              {{ row.isActive ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="168">
          <template #default="{ row }">
            {{ formatDt(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <el-button v-if="isSuper" link type="primary" @click="openEdit(row)">
              编辑
            </el-button>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="users-pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="onPageChange"
          @size-change="onSizeChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" title="编辑用户" width="480px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
        <el-form-item label="邮箱">
          <el-input :model-value="editingRow?.email" disabled />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="form.name" clearable placeholder="可选" maxlength="100" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="USER" value="USER" />
            <el-option label="ADMIN" value="ADMIN" />
            <el-option label="SUPERADMIN" value="SUPERADMIN" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.isActive" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            clearable
            autocomplete="new-password"
            placeholder="不修改请留空"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">
          取消
        </el-button>
        <el-button type="primary" :loading="saving" @click="saveUser">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.users-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.users-tip {
  max-width: 720px;
}

.users-filter-card :deep(.el-card__body) {
  padding-bottom: 4px;
}

.users-pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.muted {
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}
</style>
