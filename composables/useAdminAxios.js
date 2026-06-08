import axios from 'axios'

export function useAdminAxios() {
  const store = useUserStore()
  const client = axios.create({
    baseURL: '/',
  })

  client.interceptors.request.use((config) => {
    if (store.token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${store.token}`
    }
    return config
  })

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const code = error?.response?.status
      if (import.meta.client && code === 401) {
        store.logout()
        const path = window.location.pathname + window.location.search
        await navigateTo({
          path: '/admin/login',
          query: { redirect: path },
        })
      }
      return Promise.reject(error)
    },
  )

  return client
}
