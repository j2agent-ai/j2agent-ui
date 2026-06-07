import http from '@ai-system/http/loginInterceptor'
import { globalUrlPrefix, programTag } from '@/oem.js'

export interface ResetPasswordSendCodeRequest {
	email: string
	validateCode: string
	hash: string
}

export interface ResetPasswordRequest {
	email: string
	newPassword: string
	code: string
}

export const sendResetPasswordCode = (payload: ResetPasswordSendCodeRequest) => {
	return http.post<void>(
		`/v1${globalUrlPrefix}auth/${programTag}/reset-password/send-code`,
		payload
	)
}

export const resetPasswordByEmail = (payload: ResetPasswordRequest) => {
	return http.post<void>(`/v1${globalUrlPrefix}auth/${programTag}/reset-password`, payload)
}
