const TOKEN_KEY = 'access_token'
const LEGACY_TOKEN_KEY = 'j2agent-auth-token'
const LEGACY_EXPIRES_AT_KEY = 'j2agent-auth-expires-at'

function clearLegacyAuthKeys() {
	sessionStorage.removeItem(LEGACY_TOKEN_KEY)
	sessionStorage.removeItem(LEGACY_EXPIRES_AT_KEY)
	localStorage.removeItem(LEGACY_TOKEN_KEY)
	localStorage.removeItem(LEGACY_EXPIRES_AT_KEY)
}

export function setAuthToken(token: string, _expiresInSeconds?: number) {
	localStorage.setItem(TOKEN_KEY, token)
	clearLegacyAuthKeys()
}

export function getAuthToken(): string | null {
	const token = localStorage.getItem(TOKEN_KEY)
	if (token) {
		return token
	}
	const legacyToken = sessionStorage.getItem(LEGACY_TOKEN_KEY)
	if (legacyToken) {
		localStorage.setItem(TOKEN_KEY, legacyToken)
		clearLegacyAuthKeys()
		return legacyToken
	}
	return null
}

export function clearAuthToken() {
	localStorage.removeItem(TOKEN_KEY)
	clearLegacyAuthKeys()
}
