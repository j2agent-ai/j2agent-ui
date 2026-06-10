/**
 * WebSocket 流式对话服务。
 * 负责开启/停止单轮对话、维护 WS 生命周期，并与 activity/store 同步。
 */
import { nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { t } from '@ai-system/lib'
import { chatWebsocketClientApi } from '@/api/ai.api'
import type { AgentUiEventEnvelope, ChatRequestDto } from '@/types/ai.types'
import { chatActivityStore } from '../activity/store'
import type { ChatSessionRuntime } from '../session/types'

/** 拆除 WebSocket 回调并关闭连接，避免旧连接晚到的包被错误处理 */
export const detachWebSocket = (ws: WebSocket | undefined) => {
	if (!ws) {
		return
	}
	try {
		ws.onopen = null
		ws.onmessage = null
		ws.onerror = null
		ws.onclose = null
	} catch {
		/* ignore */
	}
	try {
		if (
			ws.readyState === WebSocket.OPEN ||
			ws.readyState === WebSocket.CONNECTING
		) {
			ws.close()
		}
	} catch {
		/* ignore */
	}
}

const clearActivity = (session: ChatSessionRuntime) => {
	const contextId = session.contextId.value
	if (!contextId) {
		return
	}
	chatActivityStore.markInactive(session.agentId, contextId)
}

const onTurnClose = (session: ChatSessionRuntime) => {
	if (!session.dispatcher.isTerminalState.value) {
		session.dispatcher.recordTerminalState('CANCELLED')
	}
	session.isNewLlmResponse.value = true
	clearActivity(session)
	nextTick(() => {
		detachWebSocket(session.ws)
		session.ws = undefined
	})
}

/** 用户主动停止或删除会话时中断该会话的流式连接 */
export const stopTurn = (session: ChatSessionRuntime) => {
	// 先断开 WS，避免 recordTerminalState 之后仍有晚到消息把状态写回 busy
	detachWebSocket(session.ws)
	session.ws = undefined
	if (!session.dispatcher.isTerminalState.value) {
		session.dispatcher.recordTerminalState('CANCELLED')
	}
	session.isNewLlmResponse.value = true
	session.sendingMessage.value = false
	clearActivity(session)
}

export type StartTurnOptions = {
	onOpen?: () => void
	onScrollRequest?: () => void
}

/** 为指定会话开启一轮 WebSocket 流式对话 */
export const startTurn = (
	session: ChatSessionRuntime,
	chatRequestDto: ChatRequestDto,
	options?: StartTurnOptions
) => {
	detachWebSocket(session.ws)
	session.ws = undefined

	chatActivityStore.markActive(
		session.agentId,
		chatRequestDto.contextId,
		'THINKING'
	)

	const ws = chatWebsocketClientApi(chatRequestDto.contextId, session.agentId)
	session.ws = ws

	ws.onopen = () => {
		ws.send(JSON.stringify(chatRequestDto))
		session.isNewLlmResponse.value = false
		session.pendingScroll.value = true
		options?.onOpen?.()
		options?.onScrollRequest?.()
	}

	ws.onmessage = (event) => {
		try {
			const payload: AgentUiEventEnvelope = JSON.parse(event.data)
			session.dispatcher.handleAgentEvent(payload)
			session.pendingScroll.value = true
			chatActivityStore.updateState(
				session.agentId,
				chatRequestDto.contextId,
				session.dispatcher.currentAgentState.value
			)
			options?.onScrollRequest?.()
		} catch (error) {
			console.error('解析Agent事件失败:', error)
		}
	}

	ws.onerror = (error: unknown) => {
		const err = error as { responseCode?: number }
		if (err.responseCode === 401) {
			location.hash = '/login'
			return
		}
		console.error(error)
		if (err.responseCode !== 0) {
			ElMessage.error(t('ai.assistant.service.unavailable'))
		}
		session.isNewLlmResponse.value = true
		if (!session.dispatcher.isTerminalState.value) {
			session.dispatcher.recordTerminalState('FAILED')
		}
		clearActivity(session)
	}

	ws.onclose = () => {
		onTurnClose(session)
	}
}
