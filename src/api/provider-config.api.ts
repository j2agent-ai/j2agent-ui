import http from '@ai-system/http/loginInterceptor'
import { globalUrlPrefix, programTag } from '@/oem.js'

export type ProviderApiType = 'llm' | 'embedding'

// 提供商类型，前端校验保持与后端一致
export type LlmProviderType = 'open-ai' | 'vllm' | 'anthropic' | 'ollama'
export type EmbeddingProviderType = 'open-ai' | 'ollama'

export interface ProviderConfigDto {
	id: number
	apiType: ProviderApiType
	configName: string
	providerType: string
	config: Record<string, unknown>
	enabled: boolean
	isCurrent: boolean
	description?: string
	createTime?: number
	updateTime?: number
}

export interface ProviderConfigUpsertDto {
	apiType?: ProviderApiType
	configName: string
	providerType: string
	config: Record<string, unknown>
	description?: string
	enabled?: boolean
	makeCurrent?: boolean
}

const baseUrl = `/v1${globalUrlPrefix}rest/${programTag}/provider-config`

export const listProviderConfigs = (apiType: ProviderApiType) => {
	return http.get<ProviderConfigDto[]>(baseUrl, { params: { apiType } })
}

export const createProviderConfig = (body: ProviderConfigUpsertDto) => {
	return http.post<ProviderConfigDto>(baseUrl, body)
}

export const updateProviderConfig = (id: number, body: ProviderConfigUpsertDto) => {
	return http.put<ProviderConfigDto>(`${baseUrl}/${id}`, body)
}

export const deleteProviderConfig = (id: number) => {
	return http.delete<void>(`${baseUrl}/${id}`)
}

export const activateProviderConfig = (id: number) => {
	return http.post<ProviderConfigDto>(`${baseUrl}/${id}/activate`)
}

export const copyProviderConfig = (id: number) => {
	return http.post<ProviderConfigDto>(`${baseUrl}/${id}/copy`)
}
