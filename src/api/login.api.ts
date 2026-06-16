import http from '@ai-system/http/loginInterceptor'
import { globalUrlPrefix, programTag } from '@/oem.js'

export interface AuthResult {
	token: string
	expiresIn: number
}

export const login = (
	username: string,
	password: string,
	validateCode: string,
	hash: string
) => {
	return http.post<AuthResult>(`/v1${globalUrlPrefix}auth/${programTag}/login`, {
		username,
		password,
		validateCode,
		hash
	})
}

export const logout = () => {
	return http.get(`/v1${globalUrlPrefix}auth/${programTag}/logout`)
}

export interface SessionInfo {
	userId: string
	username: string
	role: number
}

export const getSessionInfo = () => {
	return http.get<SessionInfo>(`/v1${globalUrlPrefix}rest/${programTag}/session`)
}
