import { goTo } from '@/routes/index'
import { chatSessionRegistry } from './chatSessionRegistry'

export function openChatSession(
	agentId: string,
	contextId: string,
	options?: { currentRoutePath?: string; currentRouteAgentId?: string }
) {
	chatSessionRegistry.activateSession(agentId, contextId)
	const onChatPage = options?.currentRoutePath === '/chat/assistant'
	const sameAgent = options?.currentRouteAgentId === agentId
	if (!onChatPage || !sameAgent) {
		goTo(`/chat/assistant?agent-id=${encodeURIComponent(agentId)}`)
	}
}
