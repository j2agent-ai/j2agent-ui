/**
 * WebSocket 流式对话服务。
 * 负责开启/停止单轮对话、维护 WS 生命周期，并与 activity/store 同步。
 */
import { nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { t } from '@ai-system/lib'
import { chatWebsocketClientApi } from '@/api/ai.api'
import type {
	AgentUiEventEnvelope,
	ChatRequestDto
} from '@/types/ai.types'
import { chatActivityStore } from '../activity/store'
import type { ChatSessionRuntime } from '../session/types'

const activeTurnTokens = new WeakMap<ChatSessionRuntime, symbol>()
const ACTIVE_TURN_STORAGE_KEY = 'ai.chat.activeTurns.v1'
const ACTIVE_TURN_MAX_AGE_MS = 30 * 60 * 1000

type StoredActiveTurn = {
	agentId: string
	contextId: string
	updatedAt: number
}

const buildStoredActiveTurnKey = (agentId: string, contextId: string) =>
	`${agentId}\u0001${contextId}`

const readStoredActiveTurns = (): Record<string, StoredActiveTurn> => {
	try {
		const raw = window.localStorage.getItem(ACTIVE_TURN_STORAGE_KEY)
		if (!raw) {
			return {}
		}
		const parsed = JSON.parse(raw) as Record<string, StoredActiveTurn>
		const now = Date.now()
		return Object.fromEntries(
			Object.values(parsed)
				.filter((item) => {
					return (
						!!item?.agentId &&
						!!item?.contextId &&
						now - Number(item.updatedAt || 0) <= ACTIVE_TURN_MAX_AGE_MS
					)
				})
				.map((item) => [buildStoredActiveTurnKey(item.agentId, item.contextId), item])
		)
	} catch {
		return {}
	}
}

const writeStoredActiveTurns = (turns: Record<string, StoredActiveTurn>) => {
	try {
		window.localStorage.setItem(ACTIVE_TURN_STORAGE_KEY, JSON.stringify(turns))
	} catch {
		/* ignore */
	}
}

const rememberActiveTurn = (agentId: string, contextId: string) => {
	const turns = readStoredActiveTurns()
	turns[buildStoredActiveTurnKey(agentId, contextId)] = {
		agentId,
		contextId,
		updatedAt: Date.now()
	}
	writeStoredActiveTurns(turns)
}

/** 清除本地记录的进行中对话轮次 */
export const forgetActiveTurn = (agentId: string, contextId?: string) => {
	const turns = readStoredActiveTurns()
	if (contextId) {
		delete turns[buildStoredActiveTurnKey(agentId, contextId)]
		writeStoredActiveTurns(turns)
		return
	}
	for (const [key, item] of Object.entries(turns)) {
		if (item.agentId === agentId) {
			delete turns[key]
		}
	}
	writeStoredActiveTurns(turns)
}

const forgetActiveTurnsByContext = (contextId: string) => {
	const turns = readStoredActiveTurns()
	for (const [key, item] of Object.entries(turns)) {
		if (item.contextId === contextId) {
			delete turns[key]
		}
	}
	writeStoredActiveTurns(turns)
}

export const isRememberedActiveTurn = (agentId: string, contextId: string) =>
	!!readStoredActiveTurns()[buildStoredActiveTurnKey(agentId, contextId)]

export const getRememberedActiveTurnsForAgent = (
	agentId: string
): StoredActiveTurn[] =>
	Object.values(readStoredActiveTurns())
		.filter((item) => item.agentId === agentId)
		.sort((a, b) => b.updatedAt - a.updatedAt)

export const getRememberedActiveTurnForAgent = (
	agentId: string
): StoredActiveTurn | null => getRememberedActiveTurnsForAgent(agentId)[0] ?? null

/** 拆除 WebSocket 回调并关闭连接，避免旧连接晚到的包被错误处理 */
export const detachWebSocket = (
	ws: WebSocket | undefined,
	options?: { interrupt?: boolean }
) => {
	if (!ws) {
		return
	}
	try {
		if (
			ws.readyState === WebSocket.OPEN ||
			ws.readyState === WebSocket.CONNECTING
		) {
			ws.close(1000, options?.interrupt ? 'user interrupt' : 'client detach')
		}
	} catch {
		/* ignore */
	}
	try {
		ws.onopen = null
		ws.onmessage = null
		ws.onerror = null
		ws.onclose = null
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

const clearActivityForContext = (contextId: string) => {
	forgetActiveTurnsByContext(contextId)
	chatActivityStore.markInactiveByContext(contextId)
}

/** 后端 Redis 判定无运行中 turn / snapshot / 队列时下发，是清理本地 running 标记的唯一权威信号 */
const isResumeEmptyEvent = (event: AgentUiEventEnvelope) => {
	const payload = event.payload
	return (
		event.state === 'COMPLETED' &&
		event.eventType === 'SYSTEM' &&
		!!payload &&
		typeof payload === 'object' &&
		(payload as Record<string, unknown>).notice === 'resume-empty'
	)
}

const isConnectedNoticeEvent = (event: AgentUiEventEnvelope) => {
	const payload = event.payload
	return (
		event.state === 'IDLE' &&
		event.eventType === 'SYSTEM' &&
		!!payload &&
		typeof payload === 'object' &&
		(payload as Record<string, unknown>).notice === 'connected'
	)
}

const onTurnClose = (session: ChatSessionRuntime) => {
	const contextId = session.contextId.value
	if (contextId) {
		forgetActiveTurn(session.agentId, contextId)
	}
	session.isNewLlmResponse.value = true
	clearActivity(session)
	nextTick(() => {
		detachWebSocket(session.ws)
		session.ws = undefined
	})
}

const WS_HANDSHAKE_RETRY_DELAYS = [500, 1500, 3000] as const

/** 用户主动停止或删除会话时中断该会话的流式连接 */
export const stopTurn = (session: ChatSessionRuntime) => {
	activeTurnTokens.set(session, Symbol('stopped'))
	const contextId = session.contextId.value
	if (contextId) {
		forgetActiveTurn(session.agentId, contextId)
	}
	// 先断开 WS，避免 recordTerminalState 之后仍有晚到消息把状态写回 busy
	detachWebSocket(session.ws, { interrupt: true })
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
	const turnToken = Symbol('chat-ws-turn')
	activeTurnTokens.set(session, turnToken)
	detachWebSocket(session.ws)
	session.ws = undefined

	chatActivityStore.markActive(
		session.agentId,
		chatRequestDto.contextId,
		'THINKING'
	)
	rememberActiveTurn(session.agentId, chatRequestDto.contextId)

	let retryTimer: ReturnType<typeof window.setTimeout> | undefined

	const isCurrentTurn = () => activeTurnTokens.get(session) === turnToken

	const failHandshake = () => {
		if (!isCurrentTurn()) {
			return
		}
		if (retryTimer) {
			window.clearTimeout(retryTimer)
			retryTimer = undefined
		}
		session.isNewLlmResponse.value = true
		session.ws = undefined
		if (!session.dispatcher.isTerminalState.value) {
			session.dispatcher.recordTerminalState('FAILED')
		}
		session.sendingMessage.value = false
		forgetActiveTurn(session.agentId, chatRequestDto.contextId)
		clearActivity(session)
		ElMessage.error(t('ai.turn.error.handshake'))
	}

	const connect = (attempt: number, resume = false) => {
		if (!isCurrentTurn() || session.dispatcher.isTerminalState.value) {
			return
		}

		detachWebSocket(session.ws)

		const ws = chatWebsocketClientApi(chatRequestDto.contextId, session.agentId, {
			resume
		})
		session.ws = ws
		let opened = false

		ws.onopen = () => {
			if (!isCurrentTurn() || session.ws !== ws || session.dispatcher.isTerminalState.value) {
				return
			}
			opened = true
			if (!resume) {
				ws.send(JSON.stringify(chatRequestDto))
			}
			session.isNewLlmResponse.value = false
			session.pendingScroll.value = true
			options?.onOpen?.()
			options?.onScrollRequest?.()
		}

		ws.onmessage = (event) => {
			if (!isCurrentTurn() || session.ws !== ws) {
				return
			}
			try {
				const payload: AgentUiEventEnvelope = JSON.parse(event.data)
				session.dispatcher.handleAgentEvent(payload)
				if (session.dispatcher.isTerminalState.value) {
					forgetActiveTurn(session.agentId, chatRequestDto.contextId)
				}
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
			console.error(error)
			if (!isCurrentTurn() || session.ws !== ws) {
				return
			}
			if (!opened) {
				return
			}
		}

		ws.onclose = () => {
			if (!isCurrentTurn() || session.ws !== ws) {
				return
			}
			if (!opened) {
				const delay = resume
					? WS_HANDSHAKE_RETRY_DELAYS[
							Math.min(attempt, WS_HANDSHAKE_RETRY_DELAYS.length - 1)
						]
					: WS_HANDSHAKE_RETRY_DELAYS[attempt]
				if (delay !== undefined && !session.dispatcher.isTerminalState.value) {
					session.ws = undefined
					retryTimer = window.setTimeout(() => {
						retryTimer = undefined
						connect(attempt + 1, resume)
					}, delay)
					return
				}
				failHandshake()
				return
			}
			if (session.dispatcher.isTerminalState.value) {
				onTurnClose(session)
				return
			}
			session.ws = undefined
			const delay = WS_HANDSHAKE_RETRY_DELAYS[
				Math.min(attempt, WS_HANDSHAKE_RETRY_DELAYS.length - 1)
			]
			retryTimer = window.setTimeout(() => {
				retryTimer = undefined
				connect(attempt + 1, true)
			}, delay)
		}
	}

	connect(0)
}

/** 刷新页面后恢复进行中的对话：只连接 resume WS，不重新发送用户问题 */
export const resumeTurn = (
	session: ChatSessionRuntime,
	contextId: string,
	options?: StartTurnOptions
) => {
	if (
		session.ws &&
		(session.ws.readyState === WebSocket.OPEN ||
			session.ws.readyState === WebSocket.CONNECTING)
	) {
		return
	}
	const turnToken = Symbol('chat-ws-resume')
	activeTurnTokens.set(session, turnToken)
	rememberActiveTurn(session.agentId, contextId)
	chatActivityStore.markActive(session.agentId, contextId, 'THINKING')
	session.isNewLlmResponse.value = false

	let reconnectAttempt = 0
	let retryTimer: ReturnType<typeof window.setTimeout> | undefined
	const isCurrentTurn = () => activeTurnTokens.get(session) === turnToken

	const clearFailedResume = () => {
		if (retryTimer) {
			window.clearTimeout(retryTimer)
			retryTimer = undefined
		}
		clearActivityForContext(contextId)
		session.isNewLlmResponse.value = true
		session.sendingMessage.value = false
		session.ws = undefined
	}

	const connect = () => {
		if (!isCurrentTurn() || session.dispatcher.isTerminalState.value) {
			return
		}
		detachWebSocket(session.ws)
		const ws = chatWebsocketClientApi(contextId, session.agentId, {
			resume: true
		})
		session.ws = ws

		ws.onopen = () => {
			if (!isCurrentTurn() || session.ws !== ws || session.dispatcher.isTerminalState.value) {
				return
			}
			session.isNewLlmResponse.value = false
			session.pendingScroll.value = true
			options?.onOpen?.()
			options?.onScrollRequest?.()
		}

		ws.onmessage = (event) => {
			if (!isCurrentTurn() || session.ws !== ws) {
				return
			}
			try {
				const payload: AgentUiEventEnvelope = JSON.parse(event.data)
				const resumeEmpty = isResumeEmptyEvent(payload)
				if (resumeEmpty) {
					// 服务端确认没有可恢复回合；不要把探测响应写入状态机，
					// 否则会把仍可用的页面状态误标为终态。
					clearFailedResume()
					return
				}
				if (!isConnectedNoticeEvent(payload)) {
					reconnectAttempt = 0
				}
				session.dispatcher.handleAgentEvent(payload)
				if (session.dispatcher.isTerminalState.value) {
					forgetActiveTurn(session.agentId, contextId)
				}
				session.pendingScroll.value = true
				chatActivityStore.updateState(
					session.agentId,
					contextId,
					session.dispatcher.currentAgentState.value
				)
				options?.onScrollRequest?.()
			} catch (error) {
				console.error('解析Agent事件失败:', error)
			}
		}

		ws.onerror = (error: unknown) => {
			console.error(error)
		}

		ws.onclose = () => {
			if (!isCurrentTurn() || session.ws !== ws) {
				return
			}
			if (session.dispatcher.isTerminalState.value) {
				onTurnClose(session)
				return
			}
			session.ws = undefined
			const delay = WS_HANDSHAKE_RETRY_DELAYS[
				Math.min(reconnectAttempt, WS_HANDSHAKE_RETRY_DELAYS.length - 1)
			]
			reconnectAttempt += 1
			retryTimer = window.setTimeout(() => {
				retryTimer = undefined
				connect()
			}, delay)
		}
	}

	connect()
}
