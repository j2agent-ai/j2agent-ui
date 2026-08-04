import axios from 'axios'
import { redirectToLogin } from '@/utils/auth'
import { getAuthToken } from '@/utils/token'
import { getLangStorage, resolveLangMode } from '@ai-system/utils'

declare module 'axios' {
	export interface AxiosRequestConfig {
		skipAuthRedirect?: boolean
	}
}

const http = axios.create({
	baseURL: '/',
	timeout: 60 * 1000
})

http.interceptors.request.use((config) => {
	const token = getAuthToken()
	const lang = resolveLangMode(getLangStorage() || window.webApp?.getLang?.() || 'system')
	const locale = lang === 'en' ? 'en_US' : 'zh_CN'
	config.headers = config.headers ?? {}
	config.headers['X-Locale'] = locale
	config.headers['Accept-Language'] = locale.replace('_', '-')
	if (token) {
		config.headers.Authorization = `Bearer ${token}`
	}
	return config
})

http.interceptors.response.use(
	(response) => response,
	(error) => {
		const { status } = error.response || {}
		const requestUrl = error.config?.url ?? ''
		const isPublicAuthApi = requestUrl.includes('/auth/')
		const skipAuthRedirect = error.config?.skipAuthRedirect === true
		const shouldRedirectAuthFailure =
			(status === 401 || status === 403) && !isPublicAuthApi && !skipAuthRedirect
		if (shouldRedirectAuthFailure) {
			// access_token 与外部系统共用，鉴权失败时不删除，避免破坏外部系统会话
			redirectToLogin()
		}
		return Promise.reject(error)
	}
)

export default http
