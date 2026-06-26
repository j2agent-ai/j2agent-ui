/**
 * 智能体名称注册表。
 * 全局单例加载 agent 列表，供顶栏、活动面板、历史标题等展示智能体名称。
 */
import { ref } from 'vue'
import { getAgentList } from '@/api/ai.api'
import type { AgentInfoDto } from '@/types/ai.types'
import { hasRoleAccess, ROLE_USER } from '@/utils/role'
import {
	UNIVERSAL_ASSISTANT_DISPLAY_NAME,
	UNIVERSAL_ASSISTANT_ID
} from './universal-assistant'

const canLoadAgentNames = () => hasRoleAccess(ROLE_USER)

export const agentNameMap = ref(new Map<string, string>())
export const registeredAgents = ref<AgentInfoDto[]>([])

let loadPromise: Promise<void> | null = null

export function extractAgentsPayload(res: {
	data?: { agents?: AgentInfoDto[]; data?: { agents?: AgentInfoDto[] } }
}) {
	const body = res?.data as
		| { agents?: AgentInfoDto[]; data?: { agents?: AgentInfoDto[] } }
		| undefined
	return body?.agents ?? body?.data?.agents ?? []
}

const applyAgents = (agents: AgentInfoDto[]) => {
	registeredAgents.value = agents
	const map = new Map<string, string>()
	map.set(UNIVERSAL_ASSISTANT_ID, UNIVERSAL_ASSISTANT_DISPLAY_NAME)
	for (const agent of agents) {
		map.set(agent.agentId, agent.name?.trim() || agent.agentId)
	}
	agentNameMap.value = map
}

const fetchAgentNames = async () => {
	const res = await getAgentList()
	applyAgents(extractAgentsPayload(res))
}

/** 单例加载智能体名称，避免并发重复请求 */
export const ensureAgentNamesLoaded = () => {
	if (!canLoadAgentNames()) {
		return Promise.resolve()
	}
	if (!loadPromise) {
		loadPromise = fetchAgentNames().catch(() => {
			loadPromise = null
		})
	}
	return loadPromise
}

/** 强制刷新（面板打开或失败后重试） */
export const refreshAgentNames = async () => {
	if (!canLoadAgentNames()) {
		return
	}
	loadPromise = null
	try {
		await fetchAgentNames()
	} catch {
		loadPromise = null
	}
}

/** 获取智能体展示名称，未加载时回退 agentId */
export const getAgentDisplayName = (agentId: string) =>
	agentNameMap.value.get(agentId) ?? agentId

export const hasAgentDisplayName = (agentId: string) =>
	agentNameMap.value.has(agentId)

const DEFAULT_AGENT_LOGO = '🤖'

/** 获取智能体 emoji logo，未加载或未配置时回退默认 */
export const getAgentLogo = (agentId: string) => {
	const agent = registeredAgents.value.find((a) => a.agentId === agentId)
	const logo = agent?.logo?.trim()
	return logo || DEFAULT_AGENT_LOGO
}
