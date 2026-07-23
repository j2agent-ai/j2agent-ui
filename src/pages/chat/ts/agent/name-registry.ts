/**
 * 智能体名称注册表。
 * 全局单例加载 agent 列表，供顶栏、活动面板、历史标题等展示智能体名称。
 */
import { ref } from 'vue'
import { getAgentList } from '@/api/ai.api'
import type { AgentInfoDto } from '@/types/ai.types'
import { t } from '@ai-system/lib'
import { hasRoleAccess, ROLE_USER } from '@/utils/role'
import {
	KNOWLEDGE_QA_ASSISTANT_ID,
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

/** 解析智能体展示名称（后端已按 X-Locale 返回） */
export const resolveAgentInfoName = (agent: Pick<AgentInfoDto, 'agentId' | 'name'>) =>
	agent.name?.trim() || agent.agentId

/** 解析智能体描述文案 */
export const resolveAgentInfoDescription = (agent: Pick<AgentInfoDto, 'description'>) =>
	agent.description?.trim() || ''

/** 判断文本是否匹配某智能体 id 或本地化名称 */
export const matchesAgentI18nName = (agent: Pick<AgentInfoDto, 'agentId' | 'name'>, text: string) => {
	const trimmed = text.trim()
	return (
		agent.agentId === trimmed ||
		agent.name?.trim() === trimmed
	)
}

const applyAgents = (agents: AgentInfoDto[]) => {
	registeredAgents.value = agents
	const map = new Map<string, string>()
	map.set(UNIVERSAL_ASSISTANT_ID, t('ai.hub'))
	map.set(KNOWLEDGE_QA_ASSISTANT_ID, t('ai.knowledge.qa'))
	for (const agent of agents) {
		map.set(agent.agentId, resolveAgentInfoName(agent))
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
export const getAgentDisplayName = (agentId: string) => {
	if (agentId === UNIVERSAL_ASSISTANT_ID) {
		return t('ai.hub')
	}
	if (agentId === KNOWLEDGE_QA_ASSISTANT_ID) {
		return t('ai.knowledge.qa')
	}
	const agent = registeredAgents.value.find((a) => a.agentId === agentId)
	if (agent) {
		return resolveAgentInfoName(agent)
	}
	return agentNameMap.value.get(agentId) ?? agentId
}

export const hasAgentDisplayName = (agentId: string) =>
	agentNameMap.value.has(agentId)

const DEFAULT_AGENT_LOGO = '🤖'

/** 获取智能体 emoji logo，未加载或未配置时回退默认 */
export const getAgentLogo = (agentId: string) => {
	if (agentId === KNOWLEDGE_QA_ASSISTANT_ID) {
		return '📚'
	}
	const agent = registeredAgents.value.find((a) => a.agentId === agentId)
	const logo = agent?.logo?.trim()
	return logo || DEFAULT_AGENT_LOGO
}
