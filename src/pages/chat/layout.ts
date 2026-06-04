/** 聊天记录栏容器宽度（与 chatManage.scss `.chat-manage-container` 一致） */
export const CHAT_HISTORY_SIDEBAR_WIDTH_PX = 340

/** 总界面宽度小于 3 倍侧栏宽时进入窄屏布局 */
export const CHAT_NARROW_LAYOUT_MAX_WIDTH_PX =
	CHAT_HISTORY_SIDEBAR_WIDTH_PX * 3

/** 与 CHAT_NARROW_LAYOUT_MAX_WIDTH_PX 配套的 max-width 媒体查询上界 */
export const CHAT_NARROW_LAYOUT_MEDIA_MAX_PX =
	CHAT_NARROW_LAYOUT_MAX_WIDTH_PX - 1

export function isChatNarrowLayout(viewportWidth: number): boolean {
	return viewportWidth < CHAT_NARROW_LAYOUT_MAX_WIDTH_PX
}
