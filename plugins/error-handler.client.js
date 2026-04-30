import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {

  const report = async (payload) => {
    try {
      await $fetch('/api/log-client', {
        method: 'POST',
        body: payload,
      })
    } catch {
      // 上报失败不影响用户体验
    }
  }

  // 捕获 Vue 运行时错误（组件渲染/事件等）
  nuxtApp.vueApp.config.errorHandler = async (err, vm, info) => {
    await report({
      type: 'vue',
      message: err?.message || String(err),
      stack: err?.stack,
      info,
      component: vm?.$options?.name || 'unknown',
      url: window.location.href,
    })
  }

  // 捕获 Nuxt 级错误（包含 showError / createError，例如 404）
  nuxtApp.hook('app:error', async (err) => {
    await report({
      type: 'nuxt',
      message: err?.message || String(err),
      stack: err?.stack,
      statusCode: err?.statusCode,
      statusMessage: err?.statusMessage,
      url: window.location.href,
    })
  })
})