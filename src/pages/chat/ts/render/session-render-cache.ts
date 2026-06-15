/** ChatView 注册会话 Markdown/图表缓存淘汰回调；registry prune 时调用 */

type EvictSessionRenderCacheFn = (sessionKey: string) => void

let evictSessionRenderCacheFn: EvictSessionRenderCacheFn | null = null

export const registerSessionRenderCacheEvict = (
  fn: EvictSessionRenderCacheFn
) => {
  evictSessionRenderCacheFn = fn
}

export const evictSessionRenderCaches = (sessionKey: string) => {
  evictSessionRenderCacheFn?.(sessionKey)
}
