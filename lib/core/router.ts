import {
	createRouter,
	createWebHashHistory,
	createWebHistory
} from 'vue-router'
import {
	deepForEach,
	isFunction,
	joinUrl,
	routePathToPageName
} from '@ai-system/utils'
import { t } from '@ai-system/locale'
import { getUserRole, hasRoleAccess, ROLE_USER } from '@/utils/role'
import type { Router, RouteRecordRaw } from 'vue-router'

function optimizeRoutes(routes: RouteRecordRaw[]) {
	deepForEach(routes, (route, level, isLeaf, parent) => {
		route.path = parent ? joinUrl(parent.path, route.path) : route.path
		if (route.component) {
			if (isFunction(route.component)) {
				const componentLoader = route.component
				route.component = async () => {
					const module = await componentLoader()
					const component = module.default ? module.default : module
					component.name = component.name ?? routePathToPageName(route.path)
					return component
				}
			} else {
				route.component.name = routePathToPageName(route.path)
			}
		}
	})
}

export function createWebRouter({ routes, routeBase, routeType }): Router {
	if (routes) optimizeRoutes(routes)
	const router = createRouter({
		history:
			routeType === 'hash'
				? createWebHashHistory(routeBase)
				: createWebHistory(routeBase),
		routes: routes || []
	})

	router.beforeEach((to) => {
		if (to.meta.title) {
			document.title = `${t(to.meta.title as string)}`
		} else {
			document.title = `${t('APP_HOME', '', document.title)}`
		}
		const requiredRole = to.meta.requiredRole as number | undefined
		if (requiredRole === undefined) {
			return true
		}
		if (getUserRole() === null) {
			return {
				path: '/login',
				query: { redirect: to.fullPath }
			}
		}
		if (!hasRoleAccess(requiredRole)) {
			return { path: requiredRole <= ROLE_USER ? '/agents' : '/' }
		}
		return true
	})

	router.afterEach((to) => {
		if (to.meta.title) {
			document.title = `${t(to.meta.title as string)}`
		} else {
			document.title = `${t('APP_HOME', '', document.title)}`
		}
	})

	return router
}
