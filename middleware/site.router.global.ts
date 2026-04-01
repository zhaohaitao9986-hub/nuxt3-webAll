import type { SiteConfig, RouteRule } from '~/config/sites.config'

export default defineNuxtRouteMiddleware(async (to, from) => {
  const config = useSiteConfig()
  if (!config || !config.routes) return

  // 找到匹配的路由规则
  const matched = config.routes.find((rule: RouteRule) => {
    if (rule.pattern instanceof RegExp) {
      return rule.pattern.test(to.path)
    }
    return rule.pattern === to.path
  })

  if (!matched) return

  // 关键：不使用 name！直接放行，让页面去渲染动态组件
  return
})