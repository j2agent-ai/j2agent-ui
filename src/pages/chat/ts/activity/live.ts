/**
 * 判断会话是否仍在真实流式中。
 * 后端被 kill 时 WebSocket 可能长期不触发 onclose，需结合连接状态清理本地活动登记。
 */
import { chatActivityStore } from './store'
import { chatSessionRegistry } from '../session/registry'
import { buildSessionKey } from '../session/types'

const isWebSocketLive = (ws: WebSocket | undefined): boolean => {
	if (!ws) {
		return false
	}
	return ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING
}

/** 该 context 是否仍有活跃流式连接（会顺带清理已断连的本地活动登记） */
export const isContextStreaming = (agentId: string, contextId: string): boolean => {
	const sessionKey = buildSessionKey(agentId, contextId)
	if (!chatActivityStore.isActiveByKey(sessionKey)) {
		return false
	}
	const session = chatSessionRegistry.peekSession(agentId, contextId)
	if (!isWebSocketLive(session?.ws)) {
		chatActivityStore.markInactive(agentId, contextId)
		return false
	}
	return true
}
