/** 编排器合成的子智能体调用工具名。 */
export const SUB_AGENT_CALL_TOOL_NAME = 'call_sub_agent'

/** 是否为编排器合成的 call_sub_agent 工具名。 */
export const isSyntheticSubAgentCallToolName = (name?: string) => {
	if (!name?.trim()) {
		return false
	}
	return name.trim() === SUB_AGENT_CALL_TOOL_NAME
}

/**
 * 从 TOOL payload.arguments 解析 agentId。
 * 兼容：JSON 字符串、已解析对象；JSON.parse 失败时用正则兜底。
 */
export const parseAgentIdFromArguments = (
	argumentsJson: unknown
): string | undefined => {
	if (argumentsJson == null) {
		return undefined
	}
	if (typeof argumentsJson === 'object' && !Array.isArray(argumentsJson)) {
		const agentId = (argumentsJson as Record<string, unknown>).agentId
		return typeof agentId === 'string' && agentId.trim()
			? agentId.trim()
			: undefined
	}
	if (typeof argumentsJson !== 'string' || !argumentsJson.trim()) {
		return undefined
	}
	const raw = argumentsJson.trim()
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>
		const agentId = parsed.agentId
		return typeof agentId === 'string' && agentId.trim()
			? agentId.trim()
			: undefined
	} catch {
		// 手工拼接 arguments 在 query 含控制字符时可能令 JSON.parse 失败；仍尽量抽出 agentId
		const match = raw.match(/"agentId"\s*:\s*"((?:\\.|[^"\\])*)"/)
		if (!match?.[1]) {
			return undefined
		}
		try {
			return JSON.parse(`"${match[1]}"`) as string
		} catch {
			return match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim() || undefined
		}
	}
}

/**
 * 末步已是合成工具名、后续得到真实 agent 展示名时，应就地升级而非追加新节点。
 */
export const shouldUpgradeSubAgentTrailName = (
	currentToolName: string | undefined,
	nextToolName: string | undefined
) => {
	if (!nextToolName?.trim() || !currentToolName?.trim()) {
		return false
	}
	if (currentToolName.trim() === nextToolName.trim()) {
		return false
	}
	return (
		isSyntheticSubAgentCallToolName(currentToolName) &&
		!isSyntheticSubAgentCallToolName(nextToolName)
	)
}
