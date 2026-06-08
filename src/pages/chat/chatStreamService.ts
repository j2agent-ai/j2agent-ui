import { nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { t } from '@ai-system/lib'
import { chatWebsocketClientApi } from '@/api/ai.api'
import type { AgentUiEventEnvelope, ChatRequestDto } from '@/types/ai.types'
import { chatActivityStore } from './chatActivityStore'
import type { ChatSessionRuntime } from './chatSessionTypes'
import { detachWebSocket } from './chatWebSocketUtils'

export { detachWebSocket } from './chatWebSocketUtils'

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

/** 用户主动停止或删除会话时中断该会话的流式连接。 */
export const stopTurn = (session: ChatSessionRuntime) => {
	if (session.dispatcher.isBusyByState.value) {
		session.dispatcher.recordTerminalState('CANCELLED')
	}
	session.isNewLlmResponse.value = true
	clearActivity(session)
	detachWebSocket(session.ws)
	session.ws = undefined
}

export type StartTurnOptions = {
	onOpen?: () => void
	onScrollRequest?: () => void
}

/** 为指定会话开启一轮 WebSocket 流式对话。 */
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
			window.location.assign('/#/login')
		} else if (err.responseCode !== 0) {
			console.error(error)
			ElMessage.error(t('ai.assistant.service.unavailable'))
			session.isNewLlmResponse.value = true
			session.dispatcher.recordTerminalState('FAILED')
			clearActivity(session)
		}
	}

	ws.onclose = () => {
		onTurnClose(session)
	}
}
