import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { t } from '@ai-system/lib'
import { getNewContextId } from '@/api/ai.api'
import type { MessageDto } from '@/types/ai.types'
import { createAgentEventDispatcher } from './components/useAgentEventDispatcher'
import { resolveTurnErrorDisplayText } from './components/agentTurnError'
import { chatActivityStore } from './chatActivityStore'
import { detachWebSocket } from './chatWebSocketUtils'
import {
	MAX_CHAT_SESSIONS,
	buildSessionKey,
	type ChatSessionRuntime,
	type PendingChatImage
} from './chatSessionTypes'

const revokeBlobUrl = (url?: string | null) => {
	if (url?.startsWith('blob:')) {
		URL.revokeObjectURL(url)
	}
}

const revokeSessionBlobUrls = (session: ChatSessionRuntime) => {
	for (const message of session.messageContext.value) {
		for (const attachment of message.attachments ?? []) {
			revokeBlobUrl(attachment.url)
		}
	}
	for (const item of session.selectedAttachments.value) {
		revokeBlobUrl(item.previewUrl)
	}
}

class ChatSessionRegistry {
	private sessions = new Map<string, ChatSessionRuntime>()
	readonly activeSessionKey = ref<string | null>(null)

	getActiveSession(): ChatSessionRuntime | null {
		const key = this.activeSessionKey.value
		if (!key) {
			return null
		}
		return this.sessions.get(key) ?? null
	}

	private createSessionRuntime(
		agentId: string,
		contextId: string
	): ChatSessionRuntime {
		const contextIdRef = ref<string | undefined>(contextId)
		const messageContext = ref<MessageDto[]>([])
		const isNewLlmResponse = ref(true)
		const dispatcher = createAgentEventDispatcher({
			messageContext,
			isNewLlmResponse,
			sessionContextId: contextIdRef,
			resolveTurnErrorMessage: (errorCode, errorMessage) =>
				resolveTurnErrorDisplayText(errorCode, errorMessage, t),
			onTurnFailure: (displayMessage, raw) => {
				let msg = displayMessage
				if (raw?.errorMessage?.trim()) {
					msg = `${displayMessage}: ${raw.errorMessage.trim()}`
				} else if (raw?.errorCode) {
					msg = `${displayMessage} (${raw.errorCode})`
				}
				ElMessage.error({
					message: msg,
					duration: 6000,
					showClose: true
				})
			}
		})

		return {
			key: buildSessionKey(agentId, contextId),
			agentId,
			contextId: contextIdRef,
			messageContext,
			inputMessage: ref(''),
			selectedAttachments: ref<PendingChatImage[]>([]),
			sendingMessage: ref(false),
			isNewLlmResponse,
			loadedFromServer: ref(false),
			pendingScroll: ref(false),
			lastAccessedAt: Date.now(),
			ws: undefined,
			dispatcher
		}
	}

	peekSession(agentId: string, contextId: string): ChatSessionRuntime | null {
		return this.sessions.get(buildSessionKey(agentId, contextId)) ?? null
	}

	getOrCreateSession(agentId: string, contextId: string): ChatSessionRuntime {
		const key = buildSessionKey(agentId, contextId)
		let session = this.sessions.get(key)
		if (!session) {
			session = this.createSessionRuntime(agentId, contextId)
			this.sessions.set(key, session)
		}
		session.lastAccessedAt = Date.now()
		this.pruneIdleSessions()
		return session
	}

	activateSession(agentId: string, contextId: string): ChatSessionRuntime {
		const session = this.getOrCreateSession(agentId, contextId)
		this.activeSessionKey.value = session.key
		session.lastAccessedAt = Date.now()
		return session
	}

	async createNewSession(agentId: string): Promise<ChatSessionRuntime> {
		const response = await getNewContextId()
		const contextId = response.data.contextId
		const session = this.getOrCreateSession(agentId, contextId)
		session.messageContext.value = []
		session.inputMessage.value = ''
		session.selectedAttachments.value = []
		session.loadedFromServer.value = false
		session.dispatcher.resetTurnStates()
		this.activeSessionKey.value = session.key
		return session
	}

	getLastActiveSessionForAgent(agentId: string): ChatSessionRuntime | null {
		let best: ChatSessionRuntime | null = null
		for (const session of this.sessions.values()) {
			if (session.agentId !== agentId) {
				continue
			}
			if (!best || session.lastAccessedAt > best.lastAccessedAt) {
				best = session
			}
		}
		return best
	}

	async ensureActiveSessionForAgent(
		agentId: string
	): Promise<ChatSessionRuntime> {
		const current = this.getActiveSession()
		if (current?.agentId === agentId) {
			current.lastAccessedAt = Date.now()
			return current
		}
		const existing = this.getLastActiveSessionForAgent(agentId)
		if (existing) {
			this.activeSessionKey.value = existing.key
			existing.lastAccessedAt = Date.now()
			return existing
		}
		return this.createNewSession(agentId)
	}

	private stopSessionStream(session: ChatSessionRuntime) {
		if (session.dispatcher.isBusyByState.value) {
			session.dispatcher.recordTerminalState('CANCELLED')
		}
		session.isNewLlmResponse.value = true
		detachWebSocket(session.ws)
		session.ws = undefined
		const contextId = session.contextId.value
		if (contextId) {
			chatActivityStore.markInactive(session.agentId, contextId)
		}
	}

	removeSession(agentId: string, contextId: string) {
		const key = buildSessionKey(agentId, contextId)
		const session = this.sessions.get(key)
		if (!session) {
			return
		}
		this.stopSessionStream(session)
		revokeSessionBlobUrls(session)
		this.sessions.delete(key)
		if (this.activeSessionKey.value === key) {
			this.activeSessionKey.value = null
		}
	}

	/** 中断所有进行中的流式对话并清理活动状态（刷新/退出登录前调用）。 */
	stopAllActiveTurns() {
		for (const entry of [...chatActivityStore.activeEntries.value]) {
			const session = this.peekSession(entry.agentId, entry.contextId)
			if (session) {
				this.stopSessionStream(session)
			} else {
				chatActivityStore.markInactive(entry.agentId, entry.contextId)
			}
		}
	}

	pruneIdleSessions(maxSize = MAX_CHAT_SESSIONS) {
		if (this.sessions.size <= maxSize) {
			return
		}
		const activeKey = this.activeSessionKey.value
		const candidates = [...this.sessions.values()]
			.filter(
				(session) =>
					session.key !== activeKey &&
					!session.dispatcher.isBusyByState.value
			)
			.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)

		let toRemove = this.sessions.size - maxSize
		for (const session of candidates) {
			if (toRemove <= 0) {
				break
			}
			this.stopSessionStream(session)
			revokeSessionBlobUrls(session)
			this.sessions.delete(session.key)
			toRemove -= 1
		}
	}
}

export const chatSessionRegistry = new ChatSessionRegistry()
