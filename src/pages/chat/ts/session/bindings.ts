/**
 * 活跃会话 Vue 绑定层。
 * 将 chatSessionRegistry 中当前活跃会话的状态暴露为 ChatView 可用的 computed。
 */
import { computed } from 'vue'
import type { MessageDto } from '@/types/ai.types'
import { chatSessionRegistry } from './registry'
import type { PendingChatImage } from './types'

const EMPTY_MESSAGES: MessageDto[] = []
const EMPTY_ATTACHMENTS: PendingChatImage[] = []

/** 将 Registry 中当前活跃会话的状态暴露为 ChatView 可用的 computed 绑定 */
export const useActiveChatSessionBindings = () => {
	const activeSession = computed(() => chatSessionRegistry.getActiveSession())

	const contextId = computed({
		get: () => activeSession.value?.contextId.value ?? '',
		set: (value: string) => {
			const session = activeSession.value
			if (session) {
				session.contextId.value = value || undefined
			}
		}
	})

	const messageContext = computed(
		() => activeSession.value?.messageContext.value ?? EMPTY_MESSAGES
	)

	const inputMessage = computed({
		get: () => activeSession.value?.inputMessage.value ?? '',
		set: (value: string) => {
			const session = activeSession.value
			if (session) {
				session.inputMessage.value = value
			}
		}
	})

	const selectedAttachments = computed({
		get: () => activeSession.value?.selectedAttachments.value ?? EMPTY_ATTACHMENTS,
		set: (value: PendingChatImage[]) => {
			const session = activeSession.value
			if (session) {
				session.selectedAttachments.value = value
			}
		}
	})

	const sendingMessage = computed({
		get: () => activeSession.value?.sendingMessage.value ?? false,
		set: (value: boolean) => {
			const session = activeSession.value
			if (session) {
				session.sendingMessage.value = value
			}
		}
	})

	const isNewLlmResponse = computed({
		get: () => activeSession.value?.isNewLlmResponse.value ?? true,
		set: (value: boolean) => {
			const session = activeSession.value
			if (session) {
				session.isNewLlmResponse.value = value
			}
		}
	})

	const isBusyByState = computed(
		() => activeSession.value?.dispatcher.isBusyByState.value ?? false
	)

	const isTerminalState = computed(
		() => activeSession.value?.dispatcher.isTerminalState.value ?? true
	)

	const currentAgentState = computed(
		() => activeSession.value?.dispatcher.currentAgentState.value ?? null
	)

	const suggestedFollowUps = computed(
		() => activeSession.value?.dispatcher.suggestedFollowUps.value ?? []
	)

	const requireActiveSession = () => chatSessionRegistry.getActiveSession()

	return {
		activeSession,
		contextId,
		messageContext,
		inputMessage,
		selectedAttachments,
		sendingMessage,
		isNewLlmResponse,
		isBusyByState,
		isTerminalState,
		currentAgentState,
		suggestedFollowUps,
		requireActiveSession
	}
}
