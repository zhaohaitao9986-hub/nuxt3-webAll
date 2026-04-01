import NProgress from 'nprogress'

// 1. 统一接口响应结构
export interface ApiResponse<T = any> {
  code: number
  data: T
  msg?: string
  [key: string]: any
}

// 2. 进度条计数器
let pendingRequests = 0

const handleProgressStart = () => {
  pendingRequests++
  if (pendingRequests === 1 && process.client) NProgress.start()
}

const handleProgressDone = () => {
  pendingRequests = Math.max(0, pendingRequests - 1)
  if (pendingRequests === 0 && process.client) NProgress.done()
}

export function useApiClient() {
  // 获取站点配置（如 apiBase）
  const siteConfig = useSiteConfig()
  const baseURL = (siteConfig as any)?.apiBase || ''

  // 3. 创建基础请求实例
  const apiClient = $fetch.create({
    baseURL,
    // 请求拦截
    onRequest() {
      handleProgressStart()
    },
    // 响应拦截
    onResponse({ response }) {
      handleProgressDone()
      const resData = response._data as ApiResponse
      // 业务错误逻辑：如果后端返回 code 不是 200，弹出提示
     
    },
    // 错误拦截（网络错误、404、500等）
    onResponseError({ response }) {
      handleProgressDone()
  
    }
  })

  /**
   * 封装的 request 方法
   * @param url 请求路径
   * @param method 方法名
   * @param data 数据（如果是 GET 则自动转为 query，非 GET 则转为 body）
   */
  const request = async <T = any>(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: Record<string, any>
  ): Promise<ApiResponse<T>> => {
    
    // 核心修复：通过强转 any 避开 Nitro 内部复杂的 Method 校验
    // 同时通过 uppercase 确保逻辑判断准确
    const upperMethod = method.toUpperCase()
    
    return apiClient<ApiResponse<T>>(url, {
      method: method as any, 
      query: upperMethod === 'GET' ? data : undefined,
      body: upperMethod !== 'GET' ? data : undefined,
    })
  }

  return { request, apiClient }
}