import { getSessionInfo } from '@/api/login.api'
import { goTo, NAV_POST_LOGIN_PATH_KEY } from '@/routes'
import { hasRoleAccess, ROLE_ADMIN, setSessionInfo } from '@/utils/role'
import { getAuthToken } from '@/utils/token'

export const isOnLoginPage = (): boolean => location.hash.includes('/login')

export const isDefaultLandingHash = (): boolean => {
	const h = location.hash.replace(/^#/, '') || '/'
	const path = h.split('?')[0]
	return path === '' || path === '/' || path === '/login'
}

export const resolvePostLoginPath = (): string => {
	try {
		const saved = sessionStorage.getItem(NAV_POST_LOGIN_PATH_KEY)
		sessionStorage.removeItem(NAV_POST_LOGIN_PATH_KEY)
		if (saved && saved !== '/login' && saved !== '/logout') {
			return saved
		}
	} catch {
		/* ignore */
	}
	return hasRoleAccess(ROLE_ADMIN) ? '/' : '/agents'
}

export async function bootstrapSessionFromToken(): Promise<boolean> {
	if (!getAuthToken()) {
		return false
	}
	try {
		const sessionResponse = await getSessionInfo()
		setSessionInfo(sessionResponse.data)
		return true
	} catch {
		setSessionInfo(null)
		return false
	}
}

export const redirectToLogin = () => {
	setSessionInfo(null)
	if (isOnLoginPage()) {
		return
	}
	void goTo('/login')
}
