import { getSessionInfo } from '@/api/login.api'
import { goTo } from '@/routes'
import { setSessionInfo } from '@/utils/role'
import { getAuthToken } from '@/utils/token'

export const isOnLoginPage = (): boolean => location.hash.includes('/login')

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
