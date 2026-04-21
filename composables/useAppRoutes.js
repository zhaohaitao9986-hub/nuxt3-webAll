/**
 * 全站路由 URL 生成器（单一事实源）
 *
 * 路由约定（与 config/sites.config.ts 保持一致）：
 *   - 一级分类: /{l1.handle}           → e.g. /video-ai
 *   - 二级分类: /{l1.handle}/{l2.handle} → e.g. /video-ai/text-to-video
 *   - 工具详情: /tools/{handle}         → e.g. /tools/chatgpt
 *   - 分类总枢纽: /ai-tools
 *
 * 这是流量仲裁站点的关键资产 —— 所有链接都必须走这里构建，
 * 避免不同组件自己拼字符串、造成链接不一致或 404。
 */
export const useAppRoutes = () => {
  const toolUrl = (handle) => (handle ? `/tools/${handle}` : '/ai-tools')

  const l1Url = (handle) => (handle ? `/${handle}` : '/ai-tools')

  /**
   * 二级分类链接。
   * - 正常情况 parentHandle + handle 齐全，直接拼接。
   * - 兜底：若找不到 parentHandle，降级到 /search?q=xxx
   *   （避免 404，至少承接流量）。
   */
  const l2Url = (parentHandle, handle) => {
    if (!handle) return '/ai-tools'
    if (!parentHandle) return `/search?q=${encodeURIComponent(handle)}`
    return `/${parentHandle}/${handle}`
  }

  /**
   * 通用分类链接。根据对象形状自动选择 l1 / l2：
   *   - 有 parentHandle 字段 → L2
   *   - 否则当作 L1
   */
  const categoryUrl = (entity) => {
    if (!entity || !entity.handle) return '/ai-tools'
    if (entity.parentHandle) return l2Url(entity.parentHandle, entity.handle)
    return l1Url(entity.handle)
  }

  /** 供 SSR JSON-LD 使用，返回完整 URL */
  const abs = (siteUrl, path) => {
    if (!path) return siteUrl
    return `${siteUrl.replace(/\/$/, '')}${path}`
  }

  return { toolUrl, l1Url, l2Url, categoryUrl, abs }
}
