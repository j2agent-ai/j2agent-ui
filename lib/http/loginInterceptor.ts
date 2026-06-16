import axios from 'axios'
import { redirectToLogin } from '@/utils/auth'
import { getAuthToken } from '@/utils/token'

const http = axios.create({
	baseURL: '/',
	timeout: 60 * 1000
})

http.interceptors.request.use((config) => {
	const token = getAuthToken()
	if (token) {
		config.headers = config.headers ?? {}
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
		if ((status === 401 || status === 403) && !isPublicAuthApi) {
			// access_token 与外部系统共用，鉴权失败时不删除，避免破坏外部系统会话
			redirectToLogin()
		}
		return Promise.reject(error)
	}
)

export default http
