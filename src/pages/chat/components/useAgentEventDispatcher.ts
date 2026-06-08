import type { Ref } from 'vue'
import { computed, ref } from 'vue'
import type {
	AgentState,
	AgentTurnFailurePayload,
	AgentUiEventEnvelope,
	ChatAttachmentDto,
	ChatResponseDto,
	MessageDto,
	TurnStepItem
} from '@/types/ai.types'
import {
	ALL_AGENT_STATES,
	isBusyAgentState,
	isTerminalAgentState
} from './agentStateI18n'
import { resolveAttachmentsDisplayUrls } from '../chatAttachmentUrl'
import { resolveRendererKey } from './agentRendererRegistry'

type DispatcherOptions = {
	messageContext: Ref<MessageDto[]>
	isNewLlmResponse: Ref<boolean>
	/** 当前界面会话 ID；与信封 `contextId` 一致时才应用「建议追问」，避免换会话/新对话后迟到 NOTICE 污染 UI。 */
	sessionContextId?: Ref<string | undefined>
	/** 将 errorCode / errorMessage 转为展示文案（通常对接 i18n）。 */
	resolveTurnErrorMessage?: (
		errorCode?: string,
		errorMessage?: string
	) => string
	/** 整轮失败时的全局提示（如 ElMessage）；第二参数为服务端原始字段。 */
	onTurnFailure?: (
		displayMessage: string,
		raw?: { errorCode?: string; errorMessage?: string }
	) => void
}

type TurnStateItem = {
	state: AgentState
	toolName?: string
	ts?: number
}

// 仅在 payload 具备 message 字段时，按 ChatResponseDto 解析。
const isChatResponsePayload = (
	payload: unknown
): payload is ChatResponseDto => {
	return !!payload && typeof payload === 'object' && 'message' in payload
}

/** 是否为「建议追问」NOTICE 载荷（与后端 payload.notice 一致）。 */
const isSuggestedFollowUpsNotice = (event: AgentUiEventEnvelope) => {
	if (event.eventType !== 'NOTICE') {
		return false
	}
	const payload = (event.payload || {}) as Record<string, unknown>
	return (
		payload.notice === 'suggested-follow-ups' && Array.isArray(payload.items)
	)
}

/** 用户图片已上传 OSS，回传稳定直链供气泡展示。 */
const isUserAttachmentsReadyNotice = (event: AgentUiEventEnvelope) => {
	if (event.eventType !== 'NOTICE') {
		return false
	}
	const payload = (event.payload || {}) as Record<string, unknown>
	return (
		payload.notice === 'user-attachments-ready' &&
		typeof payload.messageIndex === 'number' &&
		Array.isArray(payload.attachments)
	)
}

/** 是否为整轮失败事件（与可恢复的 TOOL/ERROR 区分）。 */
const isTurnFailureEvent = (event: AgentUiEventEnvelope) => {
	if (event.state !== 'FAILED') {
		return false
	}
	return event.eventType === 'SYSTEM' && event.phase === 'ERROR'
}

const isTurnFailurePayload = (
	payload: unknown
): payload is AgentTurnFailurePayload => {
	return (
		!!payload &&
		typeof payload === 'object' &&
		(payload as AgentTurnFailurePayload).error === true
	)
}

export const createAgentEventDispatcher = (options: DispatcherOptions) => {
	const {
		messageContext,
		isNewLlmResponse,
		sessionContextId,
		resolveTurnErrorMessage,
		onTurnFailure
	} = options
	// 当前会话最近一次事件对应的 Agent 状态，用于驱动 UI 动效。
	const currentAgentState = ref<AgentState | null>(null)
	// 当前轮次ID（用于识别新一轮并重置轨迹）。
	const activeTurnId = ref<string | null>(null)
	/** 当前轮次唯一 assistant 气泡在 messageContext 中的下标。 */
	const activeTurnAssistantIndex = ref<number | null>(null)
	// 当前轮次状态轨迹：跟随事件实时累积，不直接用于展示。
	const currentTurnStates = ref<TurnStateItem[]>([])
	// 最近结束轮次状态轨迹：用于输入框上方展示。
	const lastTurnStates = ref<TurnStateItem[]>([])
	const isTerminalState = computed(
		() =>
			currentAgentState.value === 'COMPLETED' ||
			currentAgentState.value === 'FAILED' ||
			currentAgentState.value === 'CANCELLED'
	)
	const isBusyByState = computed(() =>
		isBusyAgentState(currentAgentState.value)
	)
	/** 回合结束后展示在输入框上方的建议追问（由 NOTICE 事件填充）。 */
	const suggestedFollowUps = ref<string[]>([])
	/** 最近一轮整轮失败的展示文案（供输入区上方等扩展展示）。 */
	const lastTurnFailureMessage = ref<string | null>(null)
	// 输入框上方状态链路：优先展示当前轮实时轨迹；无实时轨迹时回退上一轮结果。
	const displayTurnStates = computed(() =>
		currentTurnStates.value.length > 0
			? currentTurnStates.value
			: lastTurnStates.value
	)

	const isTurnStepsOnlyAssistant = (msg: MessageDto | undefined) =>
		msg?.role === 'assistant' &&
		!msg.content?.trim() &&
		!msg.reasoningContent?.trim() &&
		(msg.turnSteps?.length ?? 0) > 0

	const findLastUserIndex = () => {
		for (let i = messageContext.value.length - 1; i >= 0; i--) {
			if (messageContext.value[i].role === 'user') {
				return i
			}
		}
		return -1
	}

	/** 复用最后一条 user 之后、正文为空的 assistant（含 optimistic turnSteps 占位）。 */
	const findReusableEmptyAssistantIndex = () => {
		const lastUserIdx = findLastUserIndex()
		for (let i = messageContext.value.length - 1; i > lastUserIdx; i--) {
			const msg = messageContext.value[i]
			if (msg.role === 'assistant' && !msg.content?.trim() && !msg.reasoningContent?.trim()) {
				return i
			}
		}
		return null
	}

	const reindexMessages = () => {
		messageContext.value.forEach((msg, i) => {
			msg.index = i
		})
	}

	/**
	 * 合并同轮「仅 turnSteps、无正文」的孤儿 assistant 到当前锚点。
	 */
	const coalesceOrphanTurnStepAssistants = () => {
		const anchorIdx = activeTurnAssistantIndex.value
		if (anchorIdx === null || anchorIdx < 0) {
			return
		}
		const anchor = messageContext.value[anchorIdx]
		if (!anchor || anchor.role !== 'assistant') {
			return
		}
		const lastUserIdx = findLastUserIndex()
		for (let i = messageContext.value.length - 1; i > lastUserIdx; i--) {
			if (i === anchorIdx) {
				continue
			}
			const msg = messageContext.value[i]
			if (!isTurnStepsOnlyAssistant(msg)) {
				continue
			}
			if (!anchor.turnSteps?.length && msg.turnSteps?.length) {
				anchor.turnSteps = msg.turnSteps
			}
			messageContext.value.splice(i, 1)
			if (activeTurnAssistantIndex.value !== null && activeTurnAssistantIndex.value > i) {
				activeTurnAssistantIndex.value -= 1
			}
			reindexMessages()
		}
	}

	/**
	 * 确保当前轮次仅有一条 assistant 气泡（整轮锚点，避免 system 插入导致分裂）。
	 */
	const ensureTurnAssistant = (): MessageDto => {
		const idx = activeTurnAssistantIndex.value
		if (idx !== null && idx >= 0 && idx < messageContext.value.length) {
			const msg = messageContext.value[idx]
			if (msg?.role === 'assistant') {
				return msg
			}
		}
		const reusableIdx = findReusableEmptyAssistantIndex()
		if (reusableIdx !== null) {
			activeTurnAssistantIndex.value = reusableIdx
			return messageContext.value[reusableIdx]
		}
		const newMsg: MessageDto = {
			index: messageContext.value.length,
			role: 'assistant',
			content: ''
		}
		messageContext.value.push(newMsg)
		activeTurnAssistantIndex.value = messageContext.value.length - 1
		return newMsg
	}

	const clearActiveTurnAssistantIndex = () => {
		activeTurnAssistantIndex.value = null
	}

	const hasOptimisticTurnPlaceholder = () => {
		if (activeTurnAssistantIndex.value !== null) {
			return true
		}
		const tail = messageContext.value[messageContext.value.length - 1]
		return tail?.role === 'assistant' && !tail.content?.trim()
	}

	/**
	 * 向当前轮次轨迹追加状态：同 state 仅在新工具名出现时追加节点，避免 TOOL/COMPLETE 携带 transition.from 却无 toolName 时误判为新节点。
	 */
	const appendCurrentTurnState = (state?: AgentState, toolName?: string, ts?: number) => {
		if (!state || !ALL_AGENT_STATES.includes(state)) {
			return
		}
		const lastStateItem =
			currentTurnStates.value[currentTurnStates.value.length - 1]
		if (lastStateItem && lastStateItem.state === state) {
			if (toolName && !lastStateItem.toolName) {
				lastStateItem.toolName = toolName
				if (ts != null) {
					lastStateItem.ts = ts
				}
				return
			}
			if (toolName && lastStateItem.toolName !== toolName) {
				currentTurnStates.value.push({ state, toolName, ts })
			}
			return
		}
		currentTurnStates.value.push({ state, toolName, ts })
	}

	/**
	 * 从 TOOL 事件中提取工具名。
	 */
	const resolveToolName = (event: AgentUiEventEnvelope) => {
		if (event.eventType !== 'TOOL') {
			return undefined
		}
		const payload = (event.payload || {}) as Record<string, unknown>
		const toolName = payload.toolName
		return typeof toolName === 'string' && toolName.trim()
			? toolName.trim()
			: undefined
	}

	const TOOL_TRAIL_STATES: AgentState[] = ['CALLING_TOOL', 'LOAD_SKILL']

	const suffixNameForState = (
		state: AgentState | undefined,
		trailName?: string
	) =>
		state && TOOL_TRAIL_STATES.includes(state) ? trailName : undefined

	const parseRelativePathFromArguments = (
		argumentsJson: unknown
	): string | undefined => {
		if (typeof argumentsJson !== 'string' || !argumentsJson.trim()) {
			return undefined
		}
		try {
			const parsed = JSON.parse(argumentsJson) as Record<string, unknown>
			const relative =
				parsed.relative_path ?? parsed.relativePath
			return typeof relative === 'string' && relative.trim()
				? relative.trim()
				: undefined
		} catch {
			return undefined
		}
	}

	/** LOAD_SKILL 轨迹括号内优先展示 skillName（含 relative_path），否则回退 toolName。 */
	const resolveTrailDisplayName = (event: AgentUiEventEnvelope) => {
		if (event.eventType !== 'TOOL') {
			return undefined
		}
		const payload = (event.payload || {}) as Record<string, unknown>
		const inLoadSkill =
			event.state === 'LOAD_SKILL' ||
			event.transition?.to === 'LOAD_SKILL' ||
			event.transition?.from === 'LOAD_SKILL'
		if (inLoadSkill) {
			const sn = payload.skillName
			if (typeof sn === 'string' && sn.trim()) {
				const skillId = sn.trim()
				const relativePath = parseRelativePathFromArguments(
					payload.arguments
				)
				return relativePath ? `${skillId}/${relativePath}` : skillId
			}
		}
		return resolveToolName(event)
	}

	/**
	 * 技能/工具执行结束迁回 THINKING 时，不再重复追加 transition.from（避免裸「加载技能」节点）。
	 */
	const shouldSkipTransitionFromOnExit = (event: AgentUiEventEnvelope) => {
		if (!event.transition || event.transition.to !== 'THINKING') {
			return false
		}
		if (event.eventType !== 'TOOL') {
			return false
		}
		if (event.phase !== 'COMPLETE' && event.phase !== 'ERROR') {
			return false
		}
		const from = event.transition.from
		return from === 'LOAD_SKILL' || from === 'CALLING_TOOL'
	}

	/**
	 * 识别新轮次并重置实时轨迹。
	 */
	/** 清空建议追问（新轮次、中断或手动重置时调用）。 */
	const clearSuggestedFollowUps = () => {
		suggestedFollowUps.value = []
	}

	const clearTurnFailureMessage = () => {
		lastTurnFailureMessage.value = null
	}

	const ensureTurnContext = (event: AgentUiEventEnvelope) => {
		if (activeTurnId.value !== event.turnId) {
			const wasOptimistic =
				activeTurnId.value === null &&
				(currentTurnStates.value.length > 0 || hasOptimisticTurnPlaceholder())
			activeTurnId.value = event.turnId
			if (!wasOptimistic) {
				currentTurnStates.value = []
				clearActiveTurnAssistantIndex()
			}
			clearSuggestedFollowUps()
			clearTurnFailureMessage()
		}
	}

	/**
	 * 按状态机写入步骤 status：仅当 envelope.state 与末步 state 一致且处于 busy 时为 running。
	 */
	const toTurnSteps = (): TurnStepItem[] => {
		const current = currentAgentState.value
		const busy = isBusyByState.value
		return currentTurnStates.value.map((item, idx) => {
			const isLast = idx === currentTurnStates.value.length - 1
			const isRunning =
				busy &&
				isLast &&
				(item.state === current ||
					(item.state === 'IDLE' && current === 'THINKING'))
			let status: TurnStepItem['status']
			if (isRunning) {
				status = 'running'
			} else if (item.state === 'FAILED' || item.state === 'CANCELLED') {
				status = 'failed'
			} else {
				status = 'completed'
			}
			return {
				state: item.state,
				toolName: item.toolName,
				ts: item.ts,
				status
			}
		})
	}

	const syncTurnStepsToTailAssistant = () => {
		if (currentTurnStates.value.length === 0) {
			return
		}
		const msg = ensureTurnAssistant()
		msg.turnSteps = toTurnSteps()
		coalesceOrphanTurnStepAssistants()
	}

	const recordEventState = (event: AgentUiEventEnvelope) => {
		const trailName = resolveTrailDisplayName(event)
		const ts = event.ts
		if (event.transition) {
			if (!shouldSkipTransitionFromOnExit(event)) {
				appendCurrentTurnState(
					event.transition.from,
					suffixNameForState(event.transition.from, trailName),
					ts
				)
			}
			appendCurrentTurnState(
				event.transition.to,
				suffixNameForState(event.transition.to, trailName),
				ts
			)
			syncTurnStepsToTailAssistant()
			return
		}
		appendCurrentTurnState(
			event.state,
			suffixNameForState(event.state, trailName),
			ts
		)
		syncTurnStepsToTailAssistant()
	}

	/**
	 * 将当前轮次状态轨迹冻结为“上一轮展示轨迹”。
	 */
	const flushLastTurnStates = () => {
		if (currentTurnStates.value.length > 0) {
			lastTurnStates.value = [...currentTurnStates.value]
			syncTurnStepsToTailAssistant()
		}
	}

	/**
	 * 终态判定：用于决定何时冻结上一轮状态轨迹。
	 */
	const isTerminalEvent = (event: AgentUiEventEnvelope) => {
		return (
			event.state === 'COMPLETED' ||
			event.state === 'FAILED' ||
			event.state === 'CANCELLED'
		)
	}

	const applyMessageDelta = (payload: ChatResponseDto) => {
		const serverMessage = payload.message
		if (!serverMessage) {
			return
		}
		if (serverMessage.role === 'system') {
			// system 消息直接作为独立条目展示。
			messageContext.value.push(serverMessage)
			return
		}
		if (serverMessage.role !== 'assistant') {
			return
		}
		const msg = ensureTurnAssistant()
		if (serverMessage.srcFile?.length) {
			msg.srcFile = serverMessage.srcFile
		}
		if (serverMessage.reasoningContent) {
			msg.reasoningContent =
				(msg.reasoningContent ?? '') + serverMessage.reasoningContent
			coalesceOrphanTurnStepAssistants()
		}
		if (serverMessage.content) {
			msg.content = (msg.content ?? '') + serverMessage.content
			coalesceOrphanTurnStepAssistants()
		}
	}

	/**
	 * 解析服务端下发的建议追问列表，写入输入框上方展示用状态。
	 */
	const applySuggestedFollowUps = (event: AgentUiEventEnvelope) => {
		const expectedCtx = sessionContextId?.value
		if (
			!expectedCtx ||
			!event.contextId ||
			event.contextId !== expectedCtx
		) {
			return
		}
		const payload = (event.payload || {}) as Record<string, unknown>
		const raw = payload.items as unknown[]
		const maxLen = 120
		suggestedFollowUps.value = raw
			.filter((x): x is string => typeof x === 'string')
			.map((s) => s.trim())
			.filter(Boolean)
			.slice(0, 5)
			.map((s) => (s.length > maxLen ? `${s.slice(0, maxLen)}…` : s))
	}

	const applyUserAttachmentsReady = (event: AgentUiEventEnvelope) => {
		const expectedCtx = sessionContextId?.value
		if (
			!expectedCtx ||
			!event.contextId ||
			event.contextId !== expectedCtx
		) {
			return
		}
		const payload = (event.payload || {}) as Record<string, unknown>
		const messageIndex = payload.messageIndex as number
		const attachments = payload.attachments as ChatAttachmentDto[]
		const message = messageContext.value.find(
			(item) => item.role === 'user' && item.index === messageIndex
		)
		if (!message) {
			return
		}
		for (const attachment of message.attachments ?? []) {
			if (attachment.url?.startsWith('blob:')) {
				URL.revokeObjectURL(attachment.url)
			}
		}
		message.attachments =
			resolveAttachmentsDisplayUrls(attachments) ?? attachments
	}

	/** 移除 THINKING 阶段插入的无内容 assistant 占位，避免失败轮仍显示空气泡。 */
	const removeEmptyAssistantTail = () => {
		const tail = messageContext.value[messageContext.value.length - 1]
		const hasTurnSteps = (tail?.turnSteps?.length ?? 0) > 0
		const hasReasoning = !!tail?.reasoningContent?.trim()
		if (
			tail?.role === 'assistant' &&
			!tail.content?.trim() &&
			!hasTurnSteps &&
			!hasReasoning
		) {
			const popIdx = messageContext.value.length - 1
			messageContext.value.pop()
			if (activeTurnAssistantIndex.value === popIdx) {
				clearActiveTurnAssistantIndex()
			}
		}
	}

	/**
	 * 整轮 FAILED：不在模型气泡展示文案，仅通过弹窗提示用户。
	 */
	const applyTurnFailure = (event: AgentUiEventEnvelope) => {
		const payload = event.payload
		if (!isTurnFailurePayload(payload)) {
			return
		}
		const errorCode =
			typeof payload.errorCode === 'string' ? payload.errorCode : undefined
		const errorMessage =
			typeof payload.errorMessage === 'string'
				? payload.errorMessage
				: undefined
		const displayText = resolveTurnErrorMessage
			? resolveTurnErrorMessage(errorCode, errorMessage)
			: errorMessage || errorCode || 'Error'
		lastTurnFailureMessage.value = displayText
		removeEmptyAssistantTail()
		onTurnFailure?.(displayText, { errorCode, errorMessage })
	}

	const applySystemNotice = (event: AgentUiEventEnvelope) => {
		if (isTurnFailureEvent(event)) {
			applyTurnFailure(event)
			return
		}
		const payload = (event.payload || {}) as Record<string, any>
		const notice = payload.notice as string | undefined
		const key = resolveRendererKey(event.state, event.eventType)
		if (!notice || key === 'ignore') {
			return
		}
		// 当前先以系统文本兜底展示，后续可替换为独立 notice 组件。
		messageContext.value.push({
			index: messageContext.value.length,
			role: 'system',
			content: `[${key}] ${notice}`
		})
	}

	/**
	 * 手动写入终态（如前端主动中断），确保上一轮轨迹收敛到终态。
	 */
	const recordTerminalState = (terminalState: AgentState) => {
		currentAgentState.value = terminalState
		if (isTerminalAgentState(terminalState)) {
			const last =
				currentTurnStates.value[currentTurnStates.value.length - 1]
			if (!last || last.state !== terminalState) {
				appendCurrentTurnState(terminalState, undefined, Date.now())
			}
		}
		flushLastTurnStates()
		// 不清空锚点：终态后可能仍有跟随事件（如建议追问 NOTICE），需复用同一气泡；
		// 锚点会在下一轮 beginOptimisticTurn / resetTurnStates 时重置。
		clearSuggestedFollowUps()
	}

	/**
	 * 用户发送后、WS 首包到达前：立即 busy + 单条 assistant 占位与时间线（从 IDLE 起步）。
	 */
	const beginOptimisticTurn = () => {
		currentAgentState.value = 'THINKING'
		activeTurnId.value = null
		currentTurnStates.value = [{ state: 'IDLE', ts: Date.now() }]
		clearActiveTurnAssistantIndex()
		ensureTurnAssistant()
		syncTurnStepsToTailAssistant()
	}

	/**
	 * 重置状态历史缓存：用于新建会话或切换会话时清空展示。
	 */
	const resetTurnStates = () => {
		activeTurnId.value = null
		currentTurnStates.value = []
		lastTurnStates.value = []
		clearActiveTurnAssistantIndex()
		clearSuggestedFollowUps()
		clearTurnFailureMessage()
	}

	const handleAgentEvent = (event: AgentUiEventEnvelope) => {
		currentAgentState.value = event.state || null
		ensureTurnContext(event)
		recordEventState(event)
		const payload = event.payload
		if (event.eventType === 'MESSAGE' && isChatResponsePayload(payload)) {
			applyMessageDelta(payload)
		} else if (isSuggestedFollowUpsNotice(event)) {
			applySuggestedFollowUps(event)
		} else if (isUserAttachmentsReadyNotice(event)) {
			applyUserAttachmentsReady(event)
		} else {
			applySystemNotice(event)
		}

		// THINKING / 工具与技能加载态均需末尾 assistant 占位，供头像动效与后续 STREAMING_TEXT 共用气泡。
		if (
			event.state === 'THINKING' ||
			event.state === 'CALLING_TOOL' ||
			event.state === 'LOAD_SKILL'
		) {
			ensureTurnAssistant()
		}
		if (isTerminalEvent(event)) {
			// 冻结轨迹但保留锚点：终态后的跟随事件（建议追问 NOTICE 等）仍写入同一 bubble，
			// 避免生成只含步骤的孤儿气泡。锚点在下一轮发送时重置。
			flushLastTurnStates()
			coalesceOrphanTurnStepAssistants()
		}

		if (event.state === 'FAILED') {
			// 整轮失败终态：恢复输入区并结束等待态（可恢复的工具 ERROR 仍为 THINKING，不进入此分支）。
			isNewLlmResponse.value = true
			return
		}
		if (
			event.state === 'COMPLETED' ||
			event.state === 'CANCELLED' ||
			event.phase === 'COMPLETE'
		) {
			// 正常结束或取消：统一收敛 UI 状态。
			isNewLlmResponse.value = true
		}
	}

	return {
		handleAgentEvent,
		recordTerminalState,
		beginOptimisticTurn,
		resetTurnStates,
		currentAgentState,
		lastTurnStates,
		displayTurnStates,
		isBusyByState,
		isTerminalState,
		suggestedFollowUps,
		clearSuggestedFollowUps,
		lastTurnFailureMessage,
		clearTurnFailureMessage
	}
}

export type AgentEventDispatcher = ReturnType<typeof createAgentEventDispatcher>

export const useAgentEventDispatcher = (options: DispatcherOptions) =>
	createAgentEventDispatcher(options)
