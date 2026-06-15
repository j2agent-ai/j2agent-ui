import { goTo } from '@/routes'
import { setSessionInfo } from '@/utils/role'

export const redirectToLogin = () => {
	setSessionInfo(null)
	void goTo('/login')
}
