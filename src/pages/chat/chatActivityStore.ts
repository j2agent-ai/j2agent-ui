import { computed, reactive } from 'vue'
import type { AgentState } from '@/types/ai.types'
import { buildSessionKey } from './chatSessionTypes'

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
