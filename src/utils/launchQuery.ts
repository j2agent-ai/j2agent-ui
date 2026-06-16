import { setAuthToken } from '@/utils/token'

export type LaunchQueryConsumeResult = {
	/** 本次 URL 写入了 authorization / access_token */
	ssoEntry: boolean
	consumedKeys: string[]
}

type LaunchQueryHandler = (
	value: string
) => Partial<LaunchQueryConsumeResult> | void

export type ParsedLaunchQuery = {
	url: URL
	params: URLSearchParams
	hashPath: string
	hashParams: URLSearchParams | null
}

/** 解析 search 与 hash 内 query；读取时 hash 同名 key 优先于 search。 */
export function parseLaunchQuery(
	href: string = window.location.href
): ParsedLaunchQuery {
	const url = new URL(href)
	const hashBody = url.hash.slice(1)
	let hashPath = hashBody
	let hashParams: URLSearchParams | null = null

	if (hashBody.includes('?')) {
		const qIndex = hashBody.indexOf('?')
		hashPath = hashBody.slice(0, qIndex)
		hashParams = new URLSearchParams(hashBody.slice(qIndex + 1))
	}

	return {
		url,
		params: url.searchParams,
		hashPath,
		hashParams
	}
}

/** 从 URL 中删除已消费 key，返回 replaceState 用的路径字符串。 */
export function buildUrlWithoutKeys(
	parsed: ParsedLaunchQuery,
	keys: string[]
): string {
	const { url, hashPath, hashParams } = parsed

	for (const key of keys) {
		url.searchParams.delete(key)
		hashParams?.delete(key)
	}

	const search = url.search && url.search !== '?' ? url.search : ''
	const hashQuery = hashParams?.toString() ?? ''
	const hash =
		hashPath || hashQuery
			? `#${hashPath}${hashQuery ? `?${hashQuery}` : ''}`
			: ''

	return `${url.pathname}${search}${hash}`
}

const LAUNCH_QUERY_HANDLERS: Record<string, LaunchQueryHandler> = {
	authorization: (value) => {
		const token = value.trim()
		if (!token) {
			return
		}
		setAuthToken(token)
		return { ssoEntry: true }
	}
}

/** 外部跳转启动 query 的统一入口：解析、处理、剥离地址栏。 */
export function consumeLaunchQueryFromUrl(): LaunchQueryConsumeResult {
	const parsed = parseLaunchQuery()
	const result: LaunchQueryConsumeResult = {
		ssoEntry: false,
		consumedKeys: []
	}

	for (const [key, handler] of Object.entries(LAUNCH_QUERY_HANDLERS)) {
		const raw = parsed.hashParams?.get(key) ?? parsed.params.get(key)
		if (!raw) {
			continue
		}
		const partial = handler(raw)
		if (!partial) {
			continue
		}
		if (partial.ssoEntry) {
			result.ssoEntry = true
		}
		result.consumedKeys.push(key)
	}

	if (result.consumedKeys.length > 0) {
		window.history.replaceState(
			null,
			'',
			buildUrlWithoutKeys(parsed, result.consumedKeys)
		)
	}

	return result
}
