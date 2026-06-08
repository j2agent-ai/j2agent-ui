import { t } from '@ai-system/lib'
import type { ChatActivityEntry } from './chatActivityStore'
import { buildSessionTitle, resolveHistoryItemTitle } from './chatHistoryTitle'
import { chatSessionRegistry } from './chatSessionRegistry'
import { getStateI18nText } from './components/agentStateI18n'

export type ActiveEntryDisplay = {
	title: string
	agentName: string
	stateText: string
}

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

export function resolveActiveEntryDisplay(
	entry: ChatActivityEntry,
	agentNameMap: Map<string, string>
): ActiveEntryDisplay {
	return {
		title: resolveEntryTitle(entry),
		agentName: agentNameMap.get(entry.agentId) ?? entry.agentId,
		stateText: getStateI18nText(entry.agentState ?? undefined)
	}
}
