import http from '@ai-system/http/loginInterceptor'
import { globalUrlPrefix, programTag } from '@/oem.js'

export interface UserDto {
	userId: string
	username: string
	role: number
	createTime?: number
	email?: string
}

export interface UserListDto {
	data: UserDto[]
}

export interface UserCreateRequestDto {
	username: string
	password: string
	role: number
}

export interface UserRoleUpdateRequestDto {
	userId: string
	role: number
}

export interface UserPasswordUpdateRequestDto {
	userId?: string
	oldPassword?: string
	newPassword: string
}

export const getUserList = () => {
	return http.get<UserListDto>(`/v1${globalUrlPrefix}rest/${programTag}/users`)
}

export const createUser = (payload: UserCreateRequestDto) => {
	return http.post<UserDto>(`/v1${globalUrlPrefix}rest/${programTag}/users`, payload)
}

export const deleteUser = (userId: string) => {
	return http.delete(`/v1${globalUrlPrefix}rest/${programTag}/users`, {
		params: {
			'user-id': userId
		}
	})
}

export const updateUserRole = (payload: UserRoleUpdateRequestDto) => {
	return http.put<void>(
		`/v1${globalUrlPrefix}rest/${programTag}/users/role`,
		payload
	)
}

export const updateUserPassword = (payload: UserPasswordUpdateRequestDto) => {
	return http.put<void>(
		`/v1${globalUrlPrefix}rest/${programTag}/users/password`,
		payload
	)
}
