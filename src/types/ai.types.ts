export type MessageDto = {
	index: number
	role: 'assistant' | 'user' | 'system' | 'tool'
	content: string
	/** 是否在会话气泡中展示；false 时仅用于上下文/记忆，UI 不渲染该行 */
	displayInChat?: boolean
	/** 消息语义类型（如 tool_round、tool_result），可选用于扩展展示 */
	messageKind?: string
	/** 该条 assistant 回复对应的 Agent 执行步骤轨迹 */
	turnSteps?: TurnStepItem[]
	/** Provider 深度思考推理正文（Anthropic/Ollama reasoningContent） */
	reasoningContent?: string
	// 当前轮次从开始到结束的完整状态轨迹
	stateHistory?: AgentState[]
	// 上一个状态（用于在气泡中展示状态迁移）
	prevState?: AgentState
	// 当前状态（用于在气泡中展示状态迁移）
	currentState?: AgentState
	// 用户反馈: 0: 无, 1: 赞, 2: 踩
	feedback?: 0 | 1 | 2
	srcFile?: FileDto[]
}

export type FileDto = {
	fullFileName: string
	url: string
}

/**
 * 将FileDto数组转换为Markdown格式的字符串
 * @param srcFiles 源文件数组
 * @returns Markdown格式的字符串
 */
export const convertSrcFilesToMd = (files?: FileDto[]) => {
	if (!files || files.length === 0) {
		return ''
	}
	return files
		.map((file) => {
			return `- [${file.fullFileName}](${file.url})`
		})
		.join('\n')
}

export type ChatRequestDto = {
	// 上下文ID
	contextId: string
	messages: MessageDto[]
	// 是否检索知识库
	retrievalKb: boolean;
	// 系统提示词
	systemPrompt: 'GENERAL_ASSISTANT' | 'TOOL_USE';
}

export type MessageFeedbackRequest = {
	// 上下文ID
	contextId: string
	// 智能体ID（与记忆隔离一致；可与后端空串 legacy 对齐）
	agentId?: string
	// 消息序号
	index: number
	// 用户反馈: 0: 无, 1: 赞, 2: 踩
	feedback: 0 | 1 | 2
}

export type ChatResponseDto = {
	message: MessageDto
	// 是否结束
	done: boolean
	// 上下文ID
	contextId: string
	// 错误标识
	error?: boolean
	errorCode?: string
	errorMessage?: string
}

export type WsResponse = {
	type: 'chat' | 'error'
	notice?: string
	chat?: ChatResponseDto
}

export type AgentState =
	| 'IDLE'
	| 'THINKING'
	| 'STREAMING_TEXT'
	| 'CALLING_TOOL'
	| 'LOAD_SKILL'
	| 'COMPLETED'
	| 'FAILED'
	| 'CANCELLED'

export type TurnStepStatus = 'running' | 'completed' | 'failed'

export type TurnStepItem = {
	state: AgentState
	toolName?: string
	ts?: number
	status?: TurnStepStatus
}

export type AgentEventPhase = 'START' | 'DELTA' | 'PATCH' | 'COMPLETE' | 'ERROR'
export type AgentEventType =
	| 'MESSAGE'
	| 'TOOL'
	| 'PROGRESS'
	| 'NOTICE'
	| 'SYSTEM'

export type AgentStateTransition = {
	from: AgentState
	to: AgentState
	reason: string
}

export type AgentUiEventEnvelope = {
	eventId: string
	contextId: string
	turnId: string
	seq: number
	state: AgentState
	transition?: AgentStateTransition
	phase: AgentEventPhase
	eventType: AgentEventType
	payload?: ChatResponseDto | Record<string, any>
	ts: number
}

/**
 * 回合成功后 `eventType=NOTICE` 且 `state=COMPLETED` 时的「建议追问」载荷（与后端一致）。
 * @see docs/agent-ui交互机制/README.md
 */
export type SuggestedFollowUpsNoticePayload = {
	notice: 'suggested-follow-ups'
	items: string[]
}

/**
 * 整轮失败 `FAILED` + `SYSTEM` + `phase=ERROR` 载荷（与后端 §3.5 一致）。
 */
export type AgentTurnFailurePayload = {
	error: true
	errorCode?: string
	errorMessage?: string
}

export type ContextIdDto = {
	// 上下文ID
	contextId: string
}

/** 已注册智能体摘要（与 OpenAPI AgentInfoDto 一致） */
export type AgentInfoDto = {
	agentId: string
	name: string
	description?: string
	showHotQuestions?: boolean
}

/** 智能体列表响应 */
export type AgentInfoList = {
	agents: AgentInfoDto[]
}

/** Agent 插件状态 */
export type AgentPluginStatus = {
	jarFiles?: string[]
	loadedAgentIds?: string[]
}

/** Agent 插件 JAR 重载结果 */
export type AgentReloadResult = {
	success?: boolean
	message?: string
	jarFiles?: string[]
	loadedAgentIds?: string[]
}

export type HistoryContextList = {
	data: HistoryContextItem[]
}

export type HistoryContextItem = {
	// 聊天上下文ID
	contextId: string
	// 智能体ID
	agentId?: string
	// 标题
	title?: string
	/** @deprecated 历史拼写，兼容旧接口 */
	tittle?: string
	// 最后访问时间
	lastUpdateTime?: number
	/** @deprecated 历史字段名 */
	lastAccessTime?: number
}

export type ChatContextDto = {
	// 聊天上下文ID
	contextId: string
	agentId?: string
	// 对话
	messages: MessageDto[]
}

export type QaTemplate = {
	data: {
		// 问题
		question: string
	}[]
}
