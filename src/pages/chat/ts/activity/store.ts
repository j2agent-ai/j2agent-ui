/**
 * 全局聊天活动状态仓库。
 * 跟踪所有进行中的流式会话，供历史列表「运行中」标记与活动面板使用。
 */
import { computed, reactive } from 'vue'
import type { AgentState } from '@/types/ai.types'
import { buildSessionKey } from '../session/types'

/** 单条进行中的会话活动记录 */
export type ChatActivityEntry = {
	sessionKey: string
	agentId: string
	contextId: string
	agentState: AgentState | null
	startedAt: number
	updatedAt: number
}

const entries = reactive(new Map<string, ChatActivityEntry>())

const activeKeySet = computed(() => new Set(entries.keys()))

const activeEntries = computed(() => [...entries.values()])

const resolveKey = (agentId: string, contextId: string) =>
	buildSessionKey(agentId, contextId)

/** 标记会话开始流式（或更新其 Agent 状态） */
const markActive = (
	agentId: string,
	contextId: string,
	agentState: AgentState | null = null
) => {
	const sessionKey = resolveKey(agentId, contextId)
	const now = Date.now()
	const existing = entries.get(sessionKey)
	if (existing) {
		existing.agentState = agentState
		existing.updatedAt = now
		return
	}
	entries.set(sessionKey, {
		sessionKey,
		agentId,
		contextId,
		agentState,
		startedAt: now,
		updatedAt: now
	})
}

/** 流式过程中更新 Agent 状态 */
const updateState = (
	agentId: string,
	contextId: string,
	agentState: AgentState | null
) => {
	const sessionKey = resolveKey(agentId, contextId)
	const existing = entries.get(sessionKey)
	if (!existing) {
		markActive(agentId, contextId, agentState)
		return
	}
	existing.agentState = agentState
}

/** 会话流式结束或中断时移除活动记录 */
const markInactive = (agentId: string, contextId: string) => {
	entries.delete(resolveKey(agentId, contextId))
}

const isActive = (agentId: string, contextId: string) =>
	entries.has(resolveKey(agentId, contextId))

const isActiveByKey = (sessionKey: string) => entries.has(sessionKey)

const getEntry = (agentId: string, contextId: string) =>
	entries.get(resolveKey(agentId, contextId))

export const chatActivityStore = {
	activeKeySet,
	activeEntries,
	markActive,
	updateState,
	markInactive,
	isActive,
	isActiveByKey,
	getEntry
}
