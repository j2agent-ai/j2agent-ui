const TOKEN_KEY = 'access_token'

export function setAuthToken(token: string, _expiresInSeconds?: number) {
	localStorage.setItem(TOKEN_KEY, token)
}

export function getAuthToken(): string | null {
	return localStorage.getItem(TOKEN_KEY)
}

export function clearAuthToken() {
	localStorage.removeItem(TOKEN_KEY)
}

/** 从 URL 读取 authorization，写入 access_token 并从地址栏剥离（不刷新页面）。 */
export function consumeAuthorizationFromUrl(): boolean {
	let token: string | null = null
	const url = new URL(window.location.href)

	token = url.searchParams.get('authorization')
	if (token) {
		url.searchParams.delete('authorization')
	}

	if (!token && url.hash.includes('?')) {
		const hashBody = url.hash.slice(1)
		const qIndex = hashBody.indexOf('?')
		const hashPath = hashBody.slice(0, qIndex)
		const hashParams = new URLSearchParams(hashBody.slice(qIndex + 1))
		token = hashParams.get('authorization')
		if (token) {
			hashParams.delete('authorization')
			const rest = hashParams.toString()
			url.hash = '#' + hashPath + (rest ? '?' + rest : '')
		}
	}

	if (!token?.trim()) {
		return false
	}

	setAuthToken(token.trim())

	const next =
		url.pathname +
		(url.search && url.search !== '?' ? url.search : '') +
		url.hash
	window.history.replaceState(null, '', next)
	return true
}
