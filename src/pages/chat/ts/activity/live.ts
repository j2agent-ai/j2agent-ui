/**
 * 判断会话是否处于后台运行中。
 *
 * 页面刷新恢复后，运行中的后台任务在用户点进会话前不主动建立 WebSocket；
 * 因此这里只读取 activity store，不再因为本地没有 WS 就清理运行中标记。
 */
import { chatActivityStore } from './store'
import { buildSessionKey } from '../session/types'

/** 该 context 是否存在后台运行任务或已连接的流式观察。 */
export const isContextStreaming = (agentId: string, contextId: string): boolean => {
	const sessionKey = buildSessionKey(agentId, contextId)
	return chatActivityStore.isActiveByKey(sessionKey)
}
