<script setup>
import { MagicStick, FolderOpened, User, Document } from '@element-plus/icons-vue'

definePageMeta({
  layout: 'admin',
})

const stats = ref(null)
const loading = ref(true)

async function loadStats() {
  loading.value = true
  try {
    stats.value = await useAdminFetch('/api/admin/stats')
  }
  catch {
    stats.value = null
  }
  finally {
    loading.value = false
  }
}

onMounted(loadStats)

const cards = computed(() => {
  const s = stats.value
  if (!s) {
    return []
  }
  return [
    { label: 'AI 工具总数', value: s.toolCount, sub: `已发布 ${s.publishedToolCount}`, path: '/admin/tools', icon: MagicStick },
    { label: '注册用户', value: s.userCount, sub: `后台账号 ${s.adminCount}`, path: '/admin/users', icon: User },
    { label: '一级分类', value: s.categoryLevel1Count, sub: `二级 ${s.categoryLevel2Count}`, path: '/admin/categories/level1', icon: FolderOpened },
  ]
})
</script>

<template>
  <div class="dash-page" v-loading="loading">
    <h2 class="dash-title">
      仪表盘
    </h2>
    <p class="dash-intro">
      数据概览与快捷入口。
    </p>

    <el-row v-if="stats" :gutter="16" class="dash-cards">
      <el-col v-for="(c, i) in cards" :key="i" :xs="24" :sm="12" :md="8">
        <el-card shadow="hover" class="stat-card" @click="navigateTo(c.path)">
          <div class="stat-card-inner">
            <el-icon class="stat-icon" :size="28">
              <component :is="c.icon" />
            </el-icon>
            <div class="stat-text">
              <div class="stat-value">
                {{ c.value }}
              </div>
              <div class="stat-label">
                {{ c.label }}
              </div>
              <div class="stat-sub">
                {{ c.sub }}
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card v-else-if="!loading" shadow="never" class="dash-empty">
      <el-empty description="无法加载统计数据" />
    </el-card>

    <el-card shadow="never" class="dash-quick">
      <template #header>
        <span class="quick-head">快捷操作</span>
      </template>
      <el-space wrap>
        <el-button type="primary" :icon="MagicStick" @click="navigateTo('/admin/tools')">
          工具列表
        </el-button>
        <el-button :icon="Document" @click="navigateTo('/admin/categories')">
          二级分类
        </el-button>
        <el-button :icon="FolderOpened" @click="navigateTo('/admin/categories/level1')">
          一级分类
        </el-button>
        <el-button :icon="User" @click="navigateTo('/admin/users')">
          用户管理
        </el-button>
      </el-space>
    </el-card>
  </div>
</template>

<style scoped>
.dash-page {
  max-width: 960px;
}

.dash-title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 600;
}

.dash-intro {
  margin: 0 0 20px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.dash-cards {
  margin-bottom: 20px;
}

.stat-card {
  cursor: pointer;
  margin-bottom: 16px;
  transition: transform 0.15s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-card :deep(.el-card__body) {
  padding: 16px 18px;
}

.stat-card-inner {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.stat-icon {
  color: var(--el-color-primary);
  flex-shrink: 0;
  margin-top: 4px;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--el-text-color-primary);
}

.stat-label {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin-top: 4px;
}

.stat-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.dash-empty {
  margin-bottom: 20px;
}

.dash-quick {
  max-width: 640px;
}

.quick-head {
  font-weight: 600;
}
</style>
