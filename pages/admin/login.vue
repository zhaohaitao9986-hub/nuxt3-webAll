<script setup>
import { ElMessage } from 'element-plus'

definePageMeta({
  layout: false,
})

const route = useRoute()
const userStore = useUserStore()

const form = reactive({
  email: '',
  password: '',
})

const loading = ref(false)
const formRef = ref(null)

const rules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '至少 6 位', trigger: 'blur' },
  ],
}

function redirectTarget() {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/admin') ? r : '/admin/dashboard'
}

async function onSubmit() {
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

  loading.value = true
  try {
    const res = await $fetch('/api/admin/auth/login', {
      method: 'POST',
      body: {
        email: form.email.trim(),
        password: form.password,
      },
    })
    userStore.setAuth(res.token, res.user)
    ElMessage.success('登录成功')
    await navigateTo(redirectTarget())
  }
  catch (e) {
    ElMessage.error(e?.data?.statusMessage || e?.data?.message || e?.message || '登录失败')
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  userStore.hydrateFromStorage()
  if (userStore.token) {
    navigateTo(redirectTarget())
  }
})
</script>

<template>
  <div class="login-page">
    <el-card class="login-card" shadow="always">
      <template #header>
        <div class="login-header">
          管理后台登录
        </div>
      </template>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="login-form"
        @submit.prevent="onSubmit"
      >
        <el-form-item label="邮箱" prop="email">
          <el-input
            v-model="form.email"
            clearable
            autocomplete="username"
            placeholder="admin@example.com"
          />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            clearable
            autocomplete="current-password"
            placeholder="密码"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            native-type="submit"
            class="login-submit"
            :loading="loading"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #1e3a5f 0%, #0f172a 45%, #1e293b 100%);
  padding: 24px;
  box-sizing: border-box;
}

.login-card {
  width: 100%;
  max-width: 400px;
  border-radius: 12px;
}

.login-header {
  font-size: 18px;
  font-weight: 600;
  text-align: center;
  color: var(--el-text-color-primary);
}

.login-form :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.login-submit {
  width: 100%;
}
</style>
