import type { RouteRecordRaw } from 'vue-router'
import { ROLE_USER } from '@/utils/role'
import { getAppRouter } from '@/routes/router-holder'

import chat from '@/routes/chat'
import kb from '@/routes/kb'
import mcp from '@/routes/mcp'
import settings from '@/routes/settings'
import account from '@/routes/account'
import files from '@/routes/files'

// 业务系统路由定义
const routes = [
	{
		path: '/login',
		name: 'Login',
		component: () => import('@/pages/login/Login.vue')
	},
	{
		path: '/logout',
		name: 'Logout',
		component: () => import('@/pages/login/Logout.vue')
	},
	{
		path: '/register',
		name: 'Register',
		component: () => import('@/pages/login/Register.vue')
	},
	{
		path: '/forgot-password',
		name: 'ForgotPassword',
		component: () => import('@/pages/login/ForgotPassword.vue')
	},
	{
		path: '/',
		name: 'Index',
		component: () => import('@/pages/HomePage.vue'),
		meta: { requiredRole: ROLE_USER }
	},
	...chat,
	...kb,
	...mcp,
	...settings,
	...account,
	...files
] as RouteRecordRaw[]

export default routes

/** 登录成功后回跳路径（auth guard 写入，Login 读取后清除） */
export const NAV_POST_LOGIN_PATH_KEY = 'app:postLoginPath'
/** 普通用户（非管理员）登录后的默认落点：首页 */
export const DEFAULT_USER_LANDING_PATH = '/'
/** 应用内 SPA 导航：只允许 router.push，禁止 replace / location / redirect */
export const goTo = (path: string) => {
	const router = getAppRouter()
	if (!router) {
		console.error('[nav] router not bound, navigation blocked:', path)
		return Promise.reject(new Error('router not ready'))
	}
	const normalized = path.startsWith('/') ? path : `/${path}`
	return router.push(normalized)
}
