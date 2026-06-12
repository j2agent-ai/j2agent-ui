import type { Router } from 'vue-router'

let appRouter: Router | undefined

/** 在 main.ts createRouter 之后绑定，供 goTo 等模块级导航使用 */
export const bindAppRouter = (router: Router) => {
	appRouter = router
}

export const getAppRouter = () => appRouter
