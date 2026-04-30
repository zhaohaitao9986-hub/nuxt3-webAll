import sites from '~/config/sites.config'

export function useSiteConfig() {
  // 获取当前访问的域名（例如 localhost、de.appswm.com）
  const host = useRequestURL().host

  // 从配置里匹配当前域名
  const config = sites[host] || sites.default

  return config
}