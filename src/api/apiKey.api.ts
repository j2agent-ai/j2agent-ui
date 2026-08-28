import http from '@ai-system/http/loginInterceptor'
import { globalUrlPrefix, programTag } from '@/oem.js'

const base = `/v1${globalUrlPrefix}rest/${programTag}/api-keys`

export interface ApiKeyDto {
	id: string
	keyName: string
	userId: string
	username: string
	role: number
	maskedKey: string
	createTime?: number
	lastUsedTime?: number
}

export interface ApiKeyCreateResultDto {
	key: ApiKeyDto
	apiKey: string
}

export const getApiKeys = () => http.get<ApiKeyDto[]>(base)
export const createApiKey = (payload: { keyName: string; username: string; role: number }) =>
	http.post<ApiKeyCreateResultDto>(base, payload)
export const updateApiKeyRole = (id: string, role: number) =>
	http.put<void>(`${base}/${id}/role`, { role })
export const deleteApiKey = (id: string) => http.delete<void>(`${base}/${id}`)
