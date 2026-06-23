type ApiErrorData = {
	message?: string
	error?: string
	traceId?: string
}

type AxiosLikeError = {
	response?: {
		status?: number
		data?: ApiErrorData
		headers?: Record<string, string | string[] | undefined>
	}
}

export type ApiErrorFormatOptions = {
	fallback: string
	formatSystem: (traceId: string) => string
}

function asAxiosError(error: unknown): AxiosLikeError | undefined {
	if (typeof error !== 'object' || error === null || !('response' in error)) {
		return undefined
	}
	return error as AxiosLikeError
}

/** 从 axios 错误体或响应头提取 traceId */
export function extractTraceId(error: unknown): string | undefined {
	const response = asAxiosError(error)?.response
	const fromBody = response?.data?.traceId?.trim()
	if (fromBody) {
		return fromBody
	}
	const header = response?.headers?.['x-trace-id']
	if (typeof header === 'string' && header.trim()) {
		return header.trim()
	}
	if (Array.isArray(header) && header[0]?.trim()) {
		return header[0].trim()
	}
	return undefined
}

function readApiErrorData(error: unknown): ApiErrorData | undefined {
	return asAxiosError(error)?.response?.data
}

function readHttpStatus(error: unknown): number | undefined {
	return asAxiosError(error)?.response?.status
}

/** 是否为系统/未预期错误（无 HTTP 响应或 5xx） */
export function isSystemApiError(error: unknown): boolean {
	const status = readHttpStatus(error)
	return status === undefined || status >= 500
}

/** 无 HTTP 上下文时的系统错误文案（如 WebSocket 握手失败且 session 仍有效） */
export function formatSystemErrorMessage(
	formatSystem: (traceId: string) => string,
	traceId?: string
): string {
	return formatSystem(traceId?.trim() || crypto.randomUUID())
}

/**
 * 解析 API 错误展示文案：4xx 业务错误保留后端 message；5xx/无响应走 TRACE_ID 格式。
 */
export function formatApiErrorMessage(
	error: unknown,
	options: ApiErrorFormatOptions
): string {
	const data = readApiErrorData(error)
	const status = readHttpStatus(error)

	if (status !== undefined && status >= 400 && status < 500 && data?.message?.trim()) {
		return data.message.trim()
	}

	if (isSystemApiError(error)) {
		const traceId = extractTraceId(error) ?? crypto.randomUUID()
		if (data?.message?.includes('TRACE_ID')) {
			return data.message.trim()
		}
		return options.formatSystem(traceId)
	}

	if (data?.message?.trim()) {
		return data.message.trim()
	}
	if (data?.error?.trim()) {
		return data.error.trim()
	}
	return options.fallback
}

/** 从 axios 错误体提取可读 message（业务错误优先） */
export function extractApiErrorMessage(
	error: unknown,
	fallback: string
): string {
	return formatApiErrorMessage(error, {
		fallback,
		formatSystem: (traceId) => `发生错误，TRACE_ID: ${traceId}`
	})
}
