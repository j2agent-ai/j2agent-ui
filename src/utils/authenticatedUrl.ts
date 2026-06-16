import { getAuthToken } from '@/utils/token'

const PROTECTED_PATH_MARKERS = [
	'/file/repo/',
	'/file/static/',
	'/chat/files/content',
	'/files/content',
	'/files/upload/content',
	'/knowledge/json-template'
]

const isOssPresignedUrl = (url: string): boolean =>
	url.includes('X-Amz-Algorithm=') || url.includes('X-Amz-Signature=')

const resolveUrlPath = (url: string): string | null => {
	try {
		return new URL(url, window.location.origin).pathname
	} catch {
		return null
	}
}

export function needsAuthInUrl(url: string): boolean {
	if (!url || url.startsWith('blob:') || url.startsWith('data:')) {
		return false
	}
	if (isOssPresignedUrl(url)) {
		return false
	}
	const path = resolveUrlPath(url)
	if (!path) {
		return false
	}
	if (!path.startsWith('/v1/') && !url.startsWith('/')) {
		return false
	}
	return PROTECTED_PATH_MARKERS.some((marker) => path.includes(marker))
}

export function appendAuthTokenToUrl(url: string): string {
	if (!needsAuthInUrl(url)) {
		return url
	}
	const token = getAuthToken()
	if (!token) {
		return url
	}
	const isRelative = url.startsWith('/')
	try {
		const parsed = new URL(url, window.location.origin)
		if (!isRelative && parsed.origin !== window.location.origin) {
			return url
		}
		parsed.searchParams.set('authorization', token)
		if (isRelative || parsed.origin === window.location.origin) {
			return `${parsed.pathname}${parsed.search}${parsed.hash}`
		}
		return parsed.toString()
	} catch {
		return url
	}
}

export function getBearerAuthHeaders(): Record<string, string> {
	const token = getAuthToken()
	if (!token) {
		return {}
	}
	return { Authorization: `Bearer ${token}` }
}

export function authenticatedFetch(
	url: string,
	init: RequestInit = {}
): Promise<Response> {
	const headers = new Headers(init.headers)
	for (const [key, value] of Object.entries(getBearerAuthHeaders())) {
		headers.set(key, value)
	}
	return fetch(url, { ...init, headers })
}
