// app/plugins/lazy.server.ts
export default defineNuxtPlugin((nuxtApp) => {
  // SSR 只注册指令名，不做任何事情, 消除ssr告警
  nuxtApp.vueApp.directive('lazy', {})
})
