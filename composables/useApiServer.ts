import type { UseFetchOptions } from 'nuxt/app'

// 1. 定义你的后端统一返回类型（关键！）
interface ApiResponse<T = any> {
  code: number
  data: T
  msg?: string
  [key: string]: any
}

// 日志上报
async function reportApiError(payload: Record<string, any>) {
  try {
    const pageUrl = process.client
      ? window.location.href
      : useRequestURL().href

    await $fetch('/api/log-client', {
      method: 'POST',
      body: { type: 'api', pageUrl, ...payload },
    })
  } catch (e) {}
}

// 封装请求
export function useApiServer<T = any>(
  url: string | (() => string),
  options: UseFetchOptions<ApiResponse<T>> = {}
) {
  const siteConfig = useSiteConfig()
  const baseURL = siteConfig?.apiBase || ''
  const fullUrl = baseURL + url || ''

  const defaultOptions: UseFetchOptions<ApiResponse<T>> = {
    headers: {
      ...useRequestHeaders(['user-agent', 'x-forwarded-for']),
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },

    onRequest({ request, options }) {},

    // 修复：指定 response._data 类型为 ApiResponse
    async onResponse({ response }) {
      const resData = response._data as ApiResponse<T>
      if (resData && resData.code !== 200) {
        await reportApiError({
          kind: 'business_error',
          message: resData.msg || '业务错误',
        })
      }
    },

    async onResponseError({ request, response, options }) {
      await reportApiError({
        kind: 'fetch_error',
        message: response.statusText,
        statusCode: response.status,
      })
    },
  }
  console.log(fullUrl,'fullUrl')
  return useFetch<ApiResponse<T>>(fullUrl, {
    ...defaultOptions,
    ...options,
  })
}