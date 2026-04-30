export async function useAdminFetch(url, options = {}) {
  const store = useUserStore()
  const headers = {
    ...(options.headers || {}),
  }
  if (store.token) {
    headers.Authorization = `Bearer ${store.token}`
  }

  try {
    return await $fetch(url, {
      ...options,
      headers,
    })
  }
  catch (e) {
    const code = e?.statusCode ?? e?.status
    if (import.meta.client && code === 401) {
      store.logout()
      const path = window.location.pathname + window.location.search
      await navigateTo({
        path: '/admin/login',
        query: { redirect: path },
      })
    }
    throw e
  }
}
