/**
 * 聊天会话注册表（内存多会话管理）。
 * 负责创建/激活/淘汰会话，绑定事件分发器，并在删除时停止流式连接。
 */
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { t } from '@ai-system/lib'
import { getNewContextId } from '@/api/ai.api'
import type { MessageDto } from '@/types/ai.types'
import { chatActivityStore } from '../activity/store'
import { detachWebSocket } from '../stream/service'
import { createAgentEventDispatcher } from '../stream/dispatcher'
import { resolveTurnErrorDisplayText } from '../stream/agent-ui'
import { redirectToLogin } from '@/utils/auth'
import {
	MAX_CHAT_SESSIONS,
	buildSessionKey,
	type ChatSessionRuntime,
	type PendingChatImage
} from './types'
import { evictSessionRenderCaches } from '../render/session-render-cache'

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
				if (raw?.errorCode === 'loginMissing') {
					redirectToLogin()
					return
				}
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

	/** 切换当前活跃会话（历史列表点击、活动面板跳转） */
	activateSession(agentId: string, contextId: string): ChatSessionRuntime {
		const session = this.getOrCreateSession(agentId, contextId)
		this.activeSessionKey.value = session.key
		session.lastAccessedAt = Date.now()
		return session
	}

	/** 向后端申请新 contextId 并创建空白会话 */
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

	/** 确保当前智能体有可用活跃会话；无则恢复最近会话或新建 */
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

	/**
	 * 进入某智能体聊天页：若已通过 activateSession 预激活同 agent 则保留（活动面板/历史）；
	 * 否则新建空白会话（从智能体列表进入时不恢复该 agent 的上次内存会话）。
	 */
	async enterAgent(agentId: string): Promise<ChatSessionRuntime> {
		const current = this.getActiveSession()
		if (current?.agentId === agentId) {
			current.lastAccessedAt = Date.now()
			return current
		}
		return this.createNewSession(agentId)
	}

	private stopSessionStream(session: ChatSessionRuntime) {
		detachWebSocket(session.ws)
		session.ws = undefined
		if (!session.dispatcher.isTerminalState.value) {
			session.dispatcher.recordTerminalState('CANCELLED')
		}
		session.isNewLlmResponse.value = true
		session.sendingMessage.value = false
		const contextId = session.contextId.value
		if (contextId) {
			chatActivityStore.markInactive(session.agentId, contextId)
		}
	}

	/** 移除会话并释放 blob URL；若删除的是当前活跃会话则清空 activeSessionKey */
	removeSession(agentId: string, contextId: string) {
		const key = buildSessionKey(agentId, contextId)
		const session = this.sessions.get(key)
		if (!session) {
			return
		}
		this.stopSessionStream(session)
		revokeSessionBlobUrls(session)
		evictSessionRenderCaches(key)
		this.sessions.delete(key)
		if (this.activeSessionKey.value === key) {
			this.activeSessionKey.value = null
		}
	}

	/** 中断所有进行中的流式对话并清理活动状态（刷新/退出登录前调用） */
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

	/**
	 * 超出 MAX_CHAT_SESSIONS 时淘汰最久未访问的空闲非活跃会话。
	 * 进行中的流式会话不会被 prune。
	 */
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
			evictSessionRenderCaches(session.key)
			this.sessions.delete(session.key)
			toRemove -= 1
		}
	}
}

export const chatSessionRegistry = new ChatSessionRegistry()
