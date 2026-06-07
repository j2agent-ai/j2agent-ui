import type { RouteRecordRaw } from 'vue-router'
import { ROLE_USER } from '@/utils/role'

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
	...files,
	...account
] as RouteRecordRaw[]

export default routes

export const goTo = (path: string) => {
	location.hash = path
}
