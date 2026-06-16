import axios from 'axios'
import { redirectToLogin } from '@/utils/auth'
import { clearAuthToken, getAuthToken } from '@/utils/token'

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
			clearAuthToken()
			redirectToLogin()
		}
		return Promise.reject(error)
	}
)

export default http
