/**
 * 跨页面打开指定聊天会话。
 * 活动面板点击任务时激活内存会话并按需路由到聊天页。
 */
import { goTo } from '@/routes/index'
import { chatSessionRegistry } from './registry'

/** 激活会话；若不在对应智能体聊天页则跳转路由 */
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
