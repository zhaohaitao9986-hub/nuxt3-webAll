export default defineNuxtRouteMiddleware((to) => {
  if (!to.path.startsWith('/admin')) {
    return
  }
  if (to.path === '/admin/login') {
    return
  }
  if (import.meta.server) {
    return
  }

  const userStore = useUserStore()
  userStore.hydrateFromStorage()

  if (!userStore.token) {
    return navigateTo({
      path: '/admin/login',
      query: { redirect: to.fullPath },
    })
  }
})
