import http from '@ai-system/http/loginInterceptor'
import { globalUrlPrefix, programTag } from '@/oem.js'

export interface RegisterEnabledDto {
	enabled: boolean
}

export interface RegisterSendCodeRequest {
	email: string
	validateCode: string
	hash: string
}

export interface RegisterRequest {
	username?: string
	password: string
	email: string
	code: string
}

export const getRegisterEnabled = () => {
	return http.get<RegisterEnabledDto>(
		`/v1${globalUrlPrefix}auth/${programTag}/register/enabled`
	)
}

export const sendRegisterCode = (payload: RegisterSendCodeRequest) => {
	return http.post<void>(
		`/v1${globalUrlPrefix}auth/${programTag}/register/send-code`,
		payload,
		{ suppressErrorToast: true }
	)
}

export const registerByEmail = (payload: RegisterRequest) => {
	return http.post<void>(`/v1${globalUrlPrefix}auth/${programTag}/register`, payload, {
		suppressErrorToast: true
	})
}
