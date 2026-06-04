import {
	AgentInfoList,
	AgentPluginStatus,
	AgentReloadResult,
	ChatContextDto,
	ContextIdDto,
	HistoryContextList,
	MessageFeedbackRequest,
	QaTemplate
} from '@/types/ai.types'
import http from '@ai-system/http/loginInterceptor'
import { globalUrlPrefix, programTag } from '@/oem.js'

export const chatWebsocketClientApi = (contextId: string, agentId: string): WebSocket => {
	return new WebSocket(
		window.location.origin.replace('http', 'ws') +
			`/ws${globalUrlPrefix}rest/${programTag}/chat?context-id=` +
			contextId +
			'&agent-id=' +
			agentId
	)
}

/**
 * 获取一个新的对话上下文ID
 */
export const getNewContextId = () => {
	return http.get<ContextIdDto>(`/v1${globalUrlPrefix}rest/${programTag}/context/id`)
}

/**
 * 获取已注册的 LLM 智能体列表
 */
export const getAgentList = () => {
	return http.get<AgentInfoList>(`/v1${globalUrlPrefix}rest/${programTag}/agents`)
}

/**
 * 查询 智能体插件状态
 */
export const getAgentPlugins = () => {
	return http.get<AgentPluginStatus>(`/v1${globalUrlPrefix}rest/${programTag}/plugins/agents`)
}

/**
 * 重新加载插件目录下的 Agent JAR
 */
export const reloadAgentPlugins = () => {
	return http.post<AgentReloadResult>(`/v1${globalUrlPrefix}rest/${programTag}/agents/reload`)
}

/**
 * 获取历史对话列表（可选按 agent-id 过滤，与当前智能体侧边栏一致）
 */
export const getHistoryContextList = (offset?: number, limit?: number, agentId?: string) => {
	return http.get<HistoryContextList>(`/v1${globalUrlPrefix}rest/${programTag}/context/list`, {
		params: {
			offset,
			limit,
			...(agentId !== undefined ? { 'agent-id': agentId } : {})
		}
	})
}

/**
 * 获取历史对话（须带 agent-id，与 WebSocket 会话一致）
 */
export const getHistoryContext = (contextId: string, agentId: string) => {
	return http.get<ChatContextDto>(`/v1${globalUrlPrefix}rest/${programTag}/context`, {
		params: {
			'context-id': contextId,
			'agent-id': agentId
		}
	})
}

/**
 * 添加消息反馈
 */
export const addMessageFeedback = (feedback: MessageFeedbackRequest) => {
	return http.post(
		`/v1${globalUrlPrefix}rest/${programTag}/context/message/feedback`,
		feedback
	)
}

/**
 * 删除历史对话；传入 agentId 时仅删除该智能体下记忆，不传则删除各 context 下全部智能体行
 */
export const deleteHistoryContext = (contextId: string | string[], agentId?: string) => {
	return http.delete(`/v1${globalUrlPrefix}rest/${programTag}/context`, {
		params: {
			'context-id': Array.isArray(contextId) ? contextId.join(',') : contextId,
			...(agentId !== undefined ? { 'agent-id': agentId } : {})
		}
	})
}

/**
 * 获取指定智能体的热门问题
 */
export const getQaTemplate = (agentId: string, limit?: number) => {
	return http.get<QaTemplate>(`/v1${globalUrlPrefix}rest/${programTag}/qa-template`, {
		params: {
			'agent-id': agentId,
			limit
		}
	})
}
