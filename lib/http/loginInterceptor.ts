import axios from 'axios'
import { ElMessage } from 'element-plus'
import { goTo } from '@/routes'

const http = axios.create({
	baseURL: '/',
	timeout: 60 * 1000
})

// 响应拦截器
http.interceptors.response.use(
	(response) => {
		// 可以在这里统一处理响应数据
		return response
	},
	(error) => {
		const { status } = error.response || {}

		// 仅对已登录业务接口的 401/403 跳转登录；公开 auth（注册/登录/验证码等）不跳转
		const requestUrl = error.config?.url ?? ''
		const isPublicAuthApi = requestUrl.includes('/auth/')
		if ((status === 401 || status === 403) && !isPublicAuthApi) {
			goTo('/login')
		}

		const suppressErrorToast = (error.config as { suppressErrorToast?: boolean })
			?.suppressErrorToast
		if (
			!suppressErrorToast &&
			(status === 400 || status === 429 || status === 500 || status === 502 || status === 503)
		) {
			const data = error.response?.data
			const msg = data?.message || data?.error
			if (msg) {
				ElMessage.error(`${status}: ${msg}`)
			}
		}

		// 抛出错误
		return Promise.reject(error)
	}
)

export default http
