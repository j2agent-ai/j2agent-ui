/**
 * 聊天页布局常量与窄屏判定。
 * 与 chatManage 侧栏宽度、AIAssistantPage 响应式断点保持一致。
 */

/** 聊天记录栏容器宽度（与 chatManage.scss `.chat-manage-container` 一致） */
export const CHAT_HISTORY_SIDEBAR_WIDTH_PX = 340

/** 总界面宽度小于 3 倍侧栏宽时进入窄屏布局 */
export const CHAT_NARROW_LAYOUT_MAX_WIDTH_PX =
	CHAT_HISTORY_SIDEBAR_WIDTH_PX * 3

/** 与 CHAT_NARROW_LAYOUT_MAX_WIDTH_PX 配套的 max-width 媒体查询上界 */
export const CHAT_NARROW_LAYOUT_MEDIA_MAX_PX =
	CHAT_NARROW_LAYOUT_MAX_WIDTH_PX - 1

/** 手机紧凑布局断点（与 ChatView / topBar 600px 媒体查询同步） */
export const CHAT_MOBILE_COMPACT_MAX_WIDTH_PX = 600

/** 与 CHAT_MOBILE_COMPACT_MAX_WIDTH_PX 配套的 max-width 媒体查询上界 */
export const CHAT_MOBILE_COMPACT_MEDIA_MAX_PX =
	CHAT_MOBILE_COMPACT_MAX_WIDTH_PX - 1

/** 根据视口宽度判断是否使用窄屏（历史栏浮层）布局 */
export function isChatNarrowLayout(viewportWidth: number): boolean {
	return viewportWidth < CHAT_NARROW_LAYOUT_MAX_WIDTH_PX
}
