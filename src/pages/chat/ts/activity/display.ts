/**
 * 活动面板条目展示解析。
 * 从内存会话或 activity 条目推导标题、智能体名、当前步骤状态文案。
 */
import { t } from '@ai-system/lib'
import type { AgentState, TurnStepItem } from '@/types/ai.types'
import { getAgentDisplayName } from '../agent/name-registry'
import type { ChatActivityEntry } from './store'
import { buildSessionTitle, resolveHistoryItemTitle } from '../history/title'
import { chatSessionRegistry } from '../session/registry'
import {
	formatStepLabelParts,
	getCurrentLocale,
	getStateI18nText
} from '../stream/agent-ui'

/** 活动面板单条任务的展示结构 */
export type ActiveEntryDisplay = {
	title: string
	agentName: string
	stateText: string
	toolName?: string
	isTurnActive: boolean
}

const findLastAssistantTurnSteps = (
	messages: { role: string; turnSteps?: TurnStepItem[] }[]
): TurnStepItem[] | undefined => {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i]
		if (message.role !== 'assistant') {
			continue
		}
		if (message.turnSteps?.length) {
			return message.turnSteps
		}
		break
	}
	return undefined
}

const resolveCurrentStep = (entry: ChatActivityEntry): TurnStepItem | null => {
	const session = chatSessionRegistry.peekSession(entry.agentId, entry.contextId)
	if (!session) {
		return entry.agentState ? { state: entry.agentState } : null
	}

	const messageSteps = findLastAssistantTurnSteps(session.messageContext.value)
	const steps =
		messageSteps?.length
			? messageSteps
			: session.dispatcher.getDisplayTurnSteps()

	if (steps.length > 0) {
		return steps[steps.length - 1]
	}

	const state = session.dispatcher.currentAgentState.value ?? entry.agentState
	return state ? { state } : null
}

/** 解析活动条目标题（优先最近用户消息，否则 contextId 缩写） */
export function resolveEntryTitle(entry: ChatActivityEntry): string {
	const session = chatSessionRegistry.peekSession(entry.agentId, entry.contextId)
	if (session) {
		const messages = session.messageContext.value
		for (let i = messages.length - 1; i >= 0; i--) {
			const message = messages[i]
			if (message.role !== 'user') {
				continue
			}
			const sessionTitle = buildSessionTitle(
				message.content,
				message.attachments?.length ?? 0
			)
			if (sessionTitle) {
				return resolveHistoryItemTitle(sessionTitle, t)
			}
			break
		}
	}
	const shortId = entry.contextId.slice(0, 8)
	return shortId.length < entry.contextId.length ? `${shortId}…` : shortId
}

/** 将活动条目解析为面板展示所需的完整文案 */
export function resolveActiveEntryDisplay(
	entry: ChatActivityEntry
): ActiveEntryDisplay {
	const session = chatSessionRegistry.peekSession(entry.agentId, entry.contextId)
	const isTurnActive = session?.dispatcher.isBusyByState.value ?? false
	const currentStep = resolveCurrentStep(entry)
	const locale = getCurrentLocale()

	let stateText = ''
	let toolName: string | undefined

	if (currentStep) {
		const parts = formatStepLabelParts(currentStep, locale)
		stateText = parts.stateText
		toolName = parts.toolName
	} else {
		const state = session?.dispatcher.currentAgentState.value ?? entry.agentState
		stateText = getStateI18nText(state ?? undefined, locale)
	}

	return {
		title: resolveEntryTitle(entry),
		agentName: getAgentDisplayName(entry.agentId),
		stateText,
		toolName,
		isTurnActive
	}
}
