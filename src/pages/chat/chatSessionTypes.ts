import type { Ref } from 'vue'
import type { MessageDto } from '@/types/ai.types'
import type { AgentEventDispatcher } from './components/useAgentEventDispatcher'

export type PendingChatImage = {
	id: string
	file: File | null
	previewUrl: string | null
	contentType: string
	processing: boolean
	sourceName: string
}

export type ChatSessionRuntime = {
	key: string
	agentId: string
	contextId: Ref<string | undefined>
	messageContext: Ref<MessageDto[]>
	inputMessage: Ref<string>
	selectedAttachments: Ref<PendingChatImage[]>
	sendingMessage: Ref<boolean>
	isNewLlmResponse: Ref<boolean>
	loadedFromServer: Ref<boolean>
	pendingScroll: Ref<boolean>
	lastAccessedAt: number
	ws: WebSocket | undefined
	dispatcher: AgentEventDispatcher
}

export const MAX_CHAT_SESSIONS = 30

/** 与 chatManage historyRowKey 一致：contextId 在前，agentId 在后。 */
export const buildSessionKey = (agentId: string, contextId: string) =>
	`${contextId}\u0001${agentId}`
