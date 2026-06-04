import http from '@ai-system/http/loginInterceptor'
import { globalUrlPrefix, programTag } from '@/oem.js'

export const getAgentGlobalConfig = () => {
	return http.get<Record<string, unknown>>(
		`/v1${globalUrlPrefix}rest/${programTag}/agent/config`
	)
}

export const putAgentGlobalConfig = (config: Record<string, unknown>) => {
	return http.put<void>(
		`/v1${globalUrlPrefix}rest/${programTag}/agent/config`,
		config
	)
}
