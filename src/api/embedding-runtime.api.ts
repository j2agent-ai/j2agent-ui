import http from '@ai-system/http/loginInterceptor'
import { globalUrlPrefix, programTag } from '@/oem.js'

export interface EmbeddingRuntimeStatusDto {
	ready: boolean
	dimension?: number | null
	checkEmbeddingHash?: string | null
	modelName?: string | null
	providerType?: string | null
	lastProbeTime?: number | null
	probeError?: string | null
	fullRebuildRunning?: boolean
	embeddingBatchSize?: number | null
}

const baseUrl = `/v1${globalUrlPrefix}rest/${programTag}/provider-config/embedding`

export const getEmbeddingRuntime = () => {
	return http.get<EmbeddingRuntimeStatusDto>(`${baseUrl}/runtime`)
}

export const probeEmbeddingRuntime = () => {
	return http.post<EmbeddingRuntimeStatusDto>(`${baseUrl}/probe`)
}
