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

/** 是否为后端 5xx 未预期错误（需展示 TRACE_ID） */
export function isSystemApiError(error: unknown): boolean {
	const status = readHttpStatus(error)
	return status !== undefined && status >= 500
}

/**
 * 解析 API 错误展示文案：4xx 业务错误保留后端 message；
 * 5xx 仅在后端提供 traceId 或 message 已含 TRACE_ID 时展示 TRACE_ID 格式。
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
		if (data?.message?.includes('TRACE_ID')) {
			return data.message.trim()
		}
		const traceId = extractTraceId(error)
		if (traceId) {
			return options.formatSystem(traceId)
		}
		return options.fallback
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
