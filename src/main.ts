import routes from './routes'
import langLoaders from './locale'
import { App } from '@ai-system/lib'
import { ElLoading } from 'element-plus'
import { getSessionInfo } from '@/api/login.api'
import { setSessionInfo } from '@/utils/role'

import './styles/index.scss'
import './styles/markdown.scss'
import { installDraggableMessageBox } from '@ai-system/common/elementPlusDialog'
import { applyOemBranding } from '@/utils/applyOemBranding'

applyOemBranding()
installDraggableMessageBox()

document.documentElement.classList.remove('dark')
localStorage.removeItem('dark-mode')

async function APP() {
	const app = new App({
		routeType: 'hash',
		routes,
		routeBase: '/',
		langLoaders: [langLoaders],
		plugins: [ElLoading]
	})
	// 加载语言包
	const langMessage = await langLoaders(app.getLang())
	app.langMessage = langMessage
	// 国际化
	app.setUpLang([langLoaders])

	const isAuthRoute =
		location.hash.includes('/login') ||
		location.hash.includes('/logout') ||
		location.hash.includes('/register') ||
		location.hash.includes('/forgot-password')
	if (!isAuthRoute) {
		try {
			const sessionResponse = await getSessionInfo()
			setSessionInfo(sessionResponse.data)
		} catch (error) {
			setSessionInfo(null)
		}
	}

	// 挂载路由
	app.createRouter(routes)
	// 挂载应用
	app.mount('#app')
	console.log('---->main app')
}

APP()
