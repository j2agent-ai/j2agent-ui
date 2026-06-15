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
/** 智能体列表进入聊天时强制新建会话（AgentListPage 写入，ChatView 读取后清除） */
export const NAV_FORCE_NEW_CHAT_KEY = 'app:forceNewChat'

export const setForceNewChatFlag = (agentId: string) => {
	sessionStorage.setItem(NAV_FORCE_NEW_CHAT_KEY, agentId)
}

/** 若 flag 与当前 agentId 匹配则消费并返回 true */
export const consumeForceNewChatFlag = (agentId: string): boolean => {
	const flagged = sessionStorage.getItem(NAV_FORCE_NEW_CHAT_KEY)
	if (flagged === agentId) {
		sessionStorage.removeItem(NAV_FORCE_NEW_CHAT_KEY)
		return true
	}
	return false
}

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

/** 退出登录：有进行中任务时先警告，确认后停止所有任务再跳转。 */
export const goToLogout = async () => {
	const { guardLeaveWithActiveTasks } = await import(
		'@/pages/chat/ts/guard/leave'
	)
	const canLeave = await guardLeaveWithActiveTasks()
	if (canLeave) {
		goTo('/logout')
	}
}
