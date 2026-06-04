const ROLE_STORAGE_KEY = 'user-role'
const USERNAME_STORAGE_KEY = 'user-name'
const USERID_STORAGE_KEY = 'user-id'

export const ROLE_ADMIN = 1
export const ROLE_USER = 2

export const setUserRole = (role: number | null) => {
	if (role === null || role === undefined || Number.isNaN(role)) {
		localStorage.removeItem(ROLE_STORAGE_KEY)
		return
	}
	localStorage.setItem(ROLE_STORAGE_KEY, String(role))
}

export const getUserRole = (): number | null => {
	const raw = localStorage.getItem(ROLE_STORAGE_KEY)
	if (!raw) {
		return null
	}
	const parsed = Number(raw)
	return Number.isNaN(parsed) ? null : parsed
}

export const hasRoleAccess = (requiredRole: number): boolean => {
	const role = getUserRole()
	if (role === null) {
		return false
	}
	return role <= requiredRole
}

export const setSessionInfo = (info: {
	userId?: string
	username?: string
	role?: number | null
} | null) => {
	if (!info) {
		localStorage.removeItem(USERID_STORAGE_KEY)
		localStorage.removeItem(USERNAME_STORAGE_KEY)
		setUserRole(null)
		return
	}
	if (info.userId) {
		localStorage.setItem(USERID_STORAGE_KEY, info.userId)
	} else {
		localStorage.removeItem(USERID_STORAGE_KEY)
	}
	if (info.username) {
		localStorage.setItem(USERNAME_STORAGE_KEY, info.username)
	} else {
		localStorage.removeItem(USERNAME_STORAGE_KEY)
	}
	setUserRole(info.role ?? null)
}

export const getSessionInfo = () => {
	return {
		userId: localStorage.getItem(USERID_STORAGE_KEY) || '',
		username: localStorage.getItem(USERNAME_STORAGE_KEY) || '',
		role: getUserRole()
	}
}

export const isAdminUser = () => {
	return hasRoleAccess(ROLE_ADMIN)
}
