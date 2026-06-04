import type { AgentEventType, AgentState } from '@/types/ai.types'

// 基于 state + eventType 选择渲染器，避免在视图层大量 if/else 分支。
const STATE_EVENT_RENDERER: Record<string, string> = {
	'STREAMING_TEXT:MESSAGE': 'message-text',
	'CALLING_TOOL:TOOL': 'tool-card',
	'LOAD_SKILL:TOOL': 'tool-card',
	'FAILED:SYSTEM': 'error-notice',
	/** 生命周期 SYSTEM 由分发器消费，不进入消息列表 */
	'THINKING:SYSTEM': 'ignore',
	'COMPLETED:SYSTEM': 'ignore',
	'CANCELLED:SYSTEM': 'ignore',
	/** 建议追问由分发器单独消费，不进入消息列表 */
	'COMPLETED:NOTICE': 'ignore'
}

export const resolveRendererKey = (state: AgentState, eventType: AgentEventType) => {
	return STATE_EVENT_RENDERER[`${state}:${eventType}`] || 'notice'
}
