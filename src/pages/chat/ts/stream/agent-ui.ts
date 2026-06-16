/**
 * Agent 流式 UI 辅助：状态机文案、事件渲染路由、整轮失败错误映射。
 * 供 dispatcher、时间线组件与活动面板展示层使用。
 */
import type {
	AgentEventType,
	AgentState,
	TurnStepItem,
	TurnStepStatus
} from '@/types/ai.types'

// ---------------------------------------------------------------------------
// 状态机文案与步骤展示
// ---------------------------------------------------------------------------

/** 状态机非终态 busy 集合 */
export const BUSY_AGENT_STATES: AgentState[] = [
	'THINKING',
	'STREAMING_TEXT',
	'CALLING_TOOL',
	'LOAD_SKILL'
]

/** 状态机全量 8 态（时间线完整迁移链，与 AgentState 枚举一致） */
export const ALL_AGENT_STATES: AgentState[] = [
	'IDLE',
	...BUSY_AGENT_STATES,
	'COMPLETED',
	'FAILED',
	'CANCELLED'
]

/** 判断 Agent 状态是否处于进行中的非终态 */
export const isBusyAgentState = (state?: AgentState | null): state is AgentState =>
	state != null && BUSY_AGENT_STATES.includes(state)

/** 判断是否为终态（完成 / 失败 / 取消） */
export const isTerminalAgentState = (state?: AgentState | null) =>
	state === 'COMPLETED' || state === 'FAILED' || state === 'CANCELLED'

export const isFailedTerminalState = (state?: AgentState | null) =>
	state === 'FAILED' || state === 'CANCELLED'

const isStepRunningByStateMachine = (
	step: TurnStepItem,
	idx: number,
	steps: TurnStepItem[],
	opts: { active: boolean; currentState?: AgentState | null }
): boolean => {
	if (!opts.active || !opts.currentState) {
		return false
	}
	if (!isBusyAgentState(opts.currentState)) {
		return false
	}
	const isLast = idx === steps.length - 1
	if (!isLast) {
		return false
	}
	if (step.state === opts.currentState) {
		return true
	}
	// optimistic：仅 IDLE 已入库、envelope 已进入 THINKING 时，末步 IDLE 仍视为进行中
	return step.state === 'IDLE' && opts.currentState === 'THINKING'
}

/** 按状态机判定单步展示状态（与 envelope.state 对齐） */
export const resolveTurnStepStatus = (
	step: TurnStepItem,
	idx: number,
	steps: TurnStepItem[],
	opts: { active: boolean; currentState?: AgentState | null }
): TurnStepStatus => {
	if (step.state === 'FAILED' || step.state === 'CANCELLED') {
		return 'failed'
	}
	if (step.status === 'failed') {
		return 'failed'
	}
	if (step.status === 'running') {
		return 'running'
	}
	if (step.status === 'completed') {
		return 'completed'
	}
	if (isStepRunningByStateMachine(step, idx, steps, opts)) {
		return 'running'
	}
	return 'completed'
}

const STATE_MAP: Record<string, { zh: string; en: string }> = {
	IDLE: { zh: '空闲', en: 'Idle' },
	THINKING: { zh: '思考中', en: 'Thinking' },
	STREAMING_TEXT: { zh: '输出中', en: 'Streaming' },
	CALLING_TOOL: { zh: '调用工具', en: 'Calling Tool' },
	LOAD_SKILL: { zh: '加载技能', en: 'Loading skill' },
	COMPLETED: { zh: '已完成', en: 'Completed' },
	FAILED: { zh: '失败', en: 'Failed' },
	CANCELLED: { zh: '已取消', en: 'Cancelled' }
}

const TOOL_NAME_STATES: AgentState[] = ['CALLING_TOOL', 'LOAD_SKILL']

export const getCurrentLocale = () => {
	const browserLang = navigator.language?.toLowerCase?.() || 'zh-cn'
	return browserLang.startsWith('en') ? 'en' : 'zh'
}

export const getStateI18nText = (state?: string, locale?: 'zh' | 'en') => {
	if (!state) {
		return ''
	}
	const lang = locale ?? getCurrentLocale()
	return STATE_MAP[state]?.[lang] || state
}

export const formatStepLabelParts = (
	step: Pick<TurnStepItem, 'state' | 'toolName'>,
	locale?: 'zh' | 'en'
) => {
	const stateText = getStateI18nText(step.state, locale)
	const toolName =
		TOOL_NAME_STATES.includes(step.state) && step.toolName?.trim()
			? step.toolName.trim()
			: undefined
	return { stateText, toolName }
}

/** 折叠标题与步骤列表共用：状态词 + 可选工具/技能名（空格分隔） */
export const formatStepLabel = (
	step: Pick<TurnStepItem, 'state' | 'toolName'>,
	locale?: 'zh' | 'en'
) => {
	const { stateText, toolName } = formatStepLabelParts(step, locale)
	return toolName ? `${stateText} ${toolName}` : stateText
}

export const formatDurationSeconds = (ms: number) => {
	if (ms < 1000) {
		return '<1s'
	}
	const sec = Math.round(ms / 1000)
	return `${sec}s`
}

// ---------------------------------------------------------------------------
// 事件渲染路由
// ---------------------------------------------------------------------------

/** 基于 state + eventType 选择渲染器，避免在视图层大量 if/else 分支 */
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

/** 根据 Agent 状态与事件类型解析 UI 渲染器 key */
export const resolveRendererKey = (state: AgentState, eventType: AgentEventType) => {
	return STATE_EVENT_RENDERER[`${state}:${eventType}`] || 'notice'
}

// ---------------------------------------------------------------------------
// 整轮失败错误映射
// ---------------------------------------------------------------------------

/**
 * 整轮失败（FAILED + SYSTEM/ERROR）errorCode 与 i18n 键映射，与后端 §3.5 对齐。
 */
export const TURN_ERROR_I18N_KEYS: Record<string, string> = {
	providerError: 'ai.turn.error.provider',
	unsupportedAgent: 'ai.turn.error.unsupportedAgent',
	contextAccessDenied: 'ai.turn.error.contextAccessDenied',
	noUserMessage: 'ai.turn.error.noUserMessage',
	emptyMessages: 'ai.turn.error.emptyMessages',
	context_id_not_found: 'ai.turn.error.contextIdRequired',
	agent_id_not_found: 'ai.turn.error.agentIdRequired',
	loginMissing: 'ai.turn.error.loginMissing',
	handshakeError: 'ai.turn.error.handshake',
	internalError: 'ai.turn.error.internal'
}

/** 将服务端 errorCode / errorMessage 解析为界面展示文案 */
export const resolveTurnErrorDisplayText = (
	errorCode: string | undefined,
	errorMessage: string | undefined,
	t: (key: string) => string
): string => {
	if (errorCode && TURN_ERROR_I18N_KEYS[errorCode]) {
		return t(TURN_ERROR_I18N_KEYS[errorCode])
	}
	if (errorMessage?.trim()) {
		return errorMessage.trim()
	}
	return t('ai.turn.error.generic')
}
