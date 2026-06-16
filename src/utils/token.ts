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
