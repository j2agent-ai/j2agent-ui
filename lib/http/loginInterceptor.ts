import axios from 'axios'
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

		// 业务错误由调用方统一展示，避免拦截器与页面 catch 重复弹出提示。
		return Promise.reject(error)
	}
)

export default http
