import http from '@ai-system/http/loginInterceptor'
import { globalUrlPrefix, programTag } from '@/oem.js'

export const getNmsConfig = () => {
	return http.get<Record<string, unknown>>(
		`/v1${globalUrlPrefix}rest/${programTag}/nms/config`
	)
}

export const putNmsConfig = (config: Record<string, unknown>) => {
	return http.put<void>(
		`/v1${globalUrlPrefix}rest/${programTag}/nms/config`,
		config
	)
}
