<template>
  <div>
    test111
    <div class="flex w-[100px] h-[100px] bg-black">
      22222
    </div>
    <div>
      <AppHeader />
    </div>
    <div>66666</div>

    <!-- 动态组件 -->
    <Suspense v-if="activeView">
      <component :is="activeView" />
      <template #fallback>
        <div>加载中...</div>
      </template>
    </Suspense>

    <div v-else>404 页面未找到</div>
  </div>
</template>

<script setup>
import { shallowRef, watch } from 'vue'

const siteConfig = useState('siteConfig')
const route = useRoute()
const activeView = shallowRef(null)

// 监听路由变化 → 重新匹配视图
watch(
  () => [route.path, siteConfig.value],
  async () => {
    activeView.value = null

    const path = route.path
    const rules = siteConfig.value?.routes || []
    const themeDir = siteConfig.value?.themeDir

    if (!themeDir || !rules.length) return

    // 1. 匹配路由规则
    const matched = rules.find((item) => {
      if (item.pattern instanceof RegExp) {
        return item.pattern.test(path)
      }
      return item.pattern === path
    })

    if (!matched) return

    // 2. 固定前缀 + 拼接组件名（安全！支持打包）
    const viewName = matched.view
    const theme = themeDir

    // 关键：Vite 安全动态导入
    try {
      const component = await import(
        `~/themes/${theme}/view/${viewName}.vue`
      )
      activeView.value = component.default
    } catch (err) {
      console.error('组件加载失败', err)
    }
  },
  { immediate: true }
)
</script>

<style>
.bg-black {
  background-color: #000;
  color: #fff;
}
</style>