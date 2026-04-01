// app/plugins/nprogress.client.ts
import NProgress from 'nprogress'

export default defineNuxtPlugin((nuxtApp) => {
  // 配置NProgress
  NProgress.configure({
    minimum: 0.1,
    easing: 'ease',
    speed: 500,
    trickleSpeed: 200,
    showSpinner: false,
  })

  // 监听路由开始变化
  nuxtApp.hook('page:start', () => {
    NProgress.start()
  })

  // 监听路由完成
  nuxtApp.hook('page:finish', () => {
    NProgress.done()
  })
})
