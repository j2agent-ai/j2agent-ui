/** Token 用量按用户聚合行 */
export type AuditTokenSummaryItem = {
	userId?: string
	username?: string
	callCount?: number
	inputTokens?: number
	outputTokens?: number
	billableTokens?: number
}

/** Token 用量总览 */
export type AuditTokenSummary = {
	data: AuditTokenSummaryItem[]
	total: number
	globalCallCount?: number
	globalInputTokens?: number
	globalOutputTokens?: number
	globalBillableTokens?: number
}

/** Token 调用明细行 */
export type AuditTokenRecord = {
	id?: string
	userId?: string
	username?: string
	contextId?: string
	agentId?: string
	turnId?: string
	callSeq?: number
	callKind?: string
	providerType?: string
	modelName?: string
	inputTokens?: number
	outputTokens?: number
	totalTokens?: number
	billableTokenCount?: number
	usageStatus?: string
	createTime?: number
}

export type AuditTokenRecordList = {
	data: AuditTokenRecord[]
	total: number
}

/** 审计会话列表项 */
export type AuditContextItem = {
	contextId: string
	agentId: string
	userId?: string
	username?: string
	title?: string
	lastUpdateTime?: number
}

export type AuditContextList = {
	data: AuditContextItem[]
	total: number
}

/** 审计会话消息（与后端 MessageDto 对齐的只读子集） */
export type AuditMessage = {
	index?: number
	role?: 'assistant' | 'user' | 'system' | 'tool'
	content?: string
	reasoningContent?: string
	displayInChat?: boolean
}

/** 审计会话详情 */
export type AuditContextDetail = {
	contextId?: string
	agentId?: string
	userId?: string
	username?: string
	title?: string
	lastUpdateTime?: number
	messages?: AuditMessage[]
}
