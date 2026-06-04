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
	sessionMissing: 'ai.turn.error.sessionMissing',
	handshakeError: 'ai.turn.error.handshake',
	internalError: 'ai.turn.error.internal'
}

/**
 * 将服务端 errorCode / errorMessage 解析为界面展示文案。
 */
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
