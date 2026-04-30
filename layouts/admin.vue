<script setup>
import {
  ArrowDown,
  FolderOpened,
  MagicStick,
  Odometer,
  User,
} from '@element-plus/icons-vue'

const userStore = useUserStore()

const route = useRoute()

const titleMap = {
  '/admin/dashboard': '仪表盘',
  '/admin/tools': 'AI 工具管理',
  '/admin/categories': '二级分类',
  '/admin/categories/level1': '一级分类',
  '/admin/users': '管理员设置',
}

const currentTitle = computed(() => {
  const full = route.path
  if (titleMap[full]) {
    return titleMap[full]
  }
  if (full.startsWith('/admin/tools')) {
    return 'AI 工具管理'
  }
  if (full.startsWith('/admin/categories/level1')) {
    return '一级分类'
  }
  if (full.startsWith('/admin/categories')) {
    return '二级分类'
  }
  return '页面'
})

const activeMenu = computed(() => {
  const p = route.path
  if (p.startsWith('/admin/tools')) {
    return '/admin/tools'
  }
  if (p.startsWith('/admin/categories/level1')) {
    return '/admin/categories/level1'
  }
  if (p.startsWith('/admin/categories')) {
    return '/admin/categories'
  }
  if (p.startsWith('/admin/users')) {
    return '/admin/users'
  }
  if (p.startsWith('/admin/dashboard')) {
    return '/admin/dashboard'
  }
  return p
})

const displayName = computed(() => {
  const u = userStore.user
  if (u?.name) {
    return u.name
  }
  if (u?.email) {
    return u.email
  }
  return '管理员'
})

function handleCommand(cmd) {
  if (cmd === 'logout') {
    userStore.logout()
    navigateTo('/admin/login')
  }
}
</script>

<template>
  <el-container class="admin-layout">
    <el-aside width="220px" class="admin-aside">
      <div class="admin-logo">
        管理后台
      </div>
      <el-menu
        :default-active="activeMenu"
        class="admin-menu"
        router
        background-color="#1f2937"
        text-color="#cbd5e1"
        active-text-color="#ffffff"
      >
        <el-menu-item index="/admin/dashboard">
          <el-icon><Odometer /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/admin/tools">
          <el-icon><MagicStick /></el-icon>
          <span>AI 工具管理</span>
        </el-menu-item>
        <el-sub-menu index="sub-categories">
          <template #title>
            <el-icon><FolderOpened /></el-icon>
            <span>分类管理</span>
          </template>
          <el-menu-item index="/admin/categories">
            二级分类
          </el-menu-item>
          <el-menu-item index="/admin/categories/level1">
            一级分类
          </el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/admin/users">
          <el-icon><User /></el-icon>
          <span>管理员设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container direction="vertical" class="admin-main-wrap">
      <el-header class="admin-header">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/admin/dashboard' }">
            管理后台
          </el-breadcrumb-item>
          <el-breadcrumb-item>
            {{ currentTitle }}
          </el-breadcrumb-item>
        </el-breadcrumb>

        <el-dropdown trigger="click" @command="handleCommand">
          <span class="admin-user-trigger">
            <el-avatar :size="32" class="admin-avatar">
              {{ displayName.slice(0, 1) }}
            </el-avatar>
            <span class="admin-user-name">{{ displayName }}</span>
            <el-icon class="admin-user-icon">
              <ArrowDown />
            </el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">
                退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>

      <el-main class="admin-main">
        <slot />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.admin-layout {
  min-height: 100vh;
}

.admin-aside {
  background-color: #1f2937;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #111827;
}

.admin-logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
  color: #f9fafb;
  letter-spacing: 0.02em;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.admin-menu {
  flex: 1;
  border-right: none;
}

.admin-menu :deep(.el-menu-item.is-active) {
  background-color: #374151 !important;
}

.admin-menu :deep(.el-sub-menu__title) {
  color: #cbd5e1;
}

.admin-menu :deep(.el-sub-menu.is-opened > .el-sub-menu__title),
.admin-menu :deep(.el-sub-menu__title:hover) {
  color: #f9fafb;
}

.admin-menu :deep(.el-menu-item) {
  background-color: transparent !important;
}

.admin-menu :deep(.el-sub-menu .el-menu-item) {
  background-color: transparent !important;
}

.admin-menu :deep(.el-sub-menu .el-menu-item.is-active) {
  background-color: #374151 !important;
}

.admin-main-wrap {
  flex: 1;
  min-width: 0;
}

.admin-header {
  height: 56px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  box-sizing: border-box;
}

.admin-main {
  background-color: #f3f4f6;
  padding: 20px;
  box-sizing: border-box;
}

.admin-user-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  outline: none;
}

.admin-avatar {
  background-color: #409eff;
  color: #fff;
  font-size: 14px;
}

.admin-user-name {
  font-size: 14px;
  color: #374151;
}

.admin-user-icon {
  font-size: 12px;
  color: #9ca3af;
}
</style>
