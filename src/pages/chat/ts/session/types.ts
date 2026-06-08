/**
 * 聊天会话运行时类型与 sessionKey 工具。
 * 被 session/registry、activity/store、stream 层共同引用。
 */
import type { Ref } from 'vue'
import type { MessageDto } from '@/types/ai.types'
import type { AgentEventDispatcher } from '../stream/dispatcher'

/** 输入区待发送图片占位（含处理中状态） */
export type PendingChatImage = {
	id: string
	file: File | null
	previewUrl: string | null
	contentType: string
	processing: boolean
	sourceName: string
}

/** 内存中单个对话会话的完整运行时状态 */
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

/** 内存中最多保留的会话数量，超出时 prune 最久未用的空闲会话 */
export const MAX_CHAT_SESSIONS = 30

/** 与 chatManage historyRowKey 一致：contextId 在前，agentId 在后 */
export const buildSessionKey = (agentId: string, contextId: string) =>
	`${contextId}\u0001${agentId}`
