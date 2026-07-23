import type { App as VueApp, Component, Plugin, Ref } from 'vue'
import { createApp, ref } from 'vue'
import type { Router, RouteRecordRaw } from 'vue-router'
import defaultRootComponent from './App.vue'
import type { LangLoader } from '@ai-system/locale'
import { locale, t } from '@ai-system/locale'
import { createWebRouter } from './router'
import {
	eventbus,
	getLangStorage,
	normalizeLangMode,
	resolveLangMode,
	setLangStorage,
	wrapFunction
} from '@ai-system/utils'

declare global {
	interface Window {
		webApp: App
	}
}

type GlobalConfig = {
	[key: string]: any
}
export interface AppI {
	app: VueApp
	// 路由实例
	router?: Router
	// 设置是否加载完成
	isLoading: Ref<boolean>
	// 自定义配置
	setGlobalConfig(config: GlobalConfig): App
	// 注册路由信息
	registerRoutes(routes: RouteRecordRaw[]): App
	// 注册vue插件
	registerPlugin(plugins: Plugin, ...args: any[]): App
	// 注册语言加载器
	registerLangLoader(langLoaders: LangLoader | LangLoader[]): App
	// 切换语言
	setLang(lang: string): App
	// 挂载vue应用
	mount(el: string | HTMLElement): App
	onLaunch(callback: Function): App
	onBeforeLaunch(callback: Function): App
	onSwitchLang(callback: Function): App
	onSwitchTheme(callback: Function): App
}

export interface AppOptions {
	// 挂载节点
	el?: string | HTMLElement
	// 根组件
	root?: Component
	// 默认语言
	lang?: string
	// 语言加载器
	langLoaders?: LangLoader[]
	// 注入依赖
	dependencies?: {}
	// 跳过认证
	noAuth?: boolean
	// 默认主题
	theme?: string
	template?: string | number
	// 路由
	routes?: RouteRecordRaw[]
	// 路由基础路径
	routeBase?: string
	// 路由模式
	routeType?: string
	// 全局配置
	config?: GlobalConfig
	// 全局插件
	plugins?: any
	// 语言包
	langMessage?: Record<string, any>
	// 切换语言钩子
	onSwitchLang?: (lang: string) => void
	// 切换主题
	onSwitchTheme?: (lang: string) => void
	onBeforeLaunch?: (instance: App) => void
	onAfterLaunch?: (instance: App) => void
}

export class App implements AppI {
	private options: AppOptions = {}
	public lang: Ref<string> = ref('zh')
	public theme: Ref<string> = ref('primary')
	public isLoading: Ref<boolean> = ref(false)
	public app: VueApp<Element>
	public router: Router
	public plugins
	public langMessage: Record<string, any> = {}
	private systemLangChangeHandler?: () => void
	constructor(options?: AppOptions) {
		this.initOptions(options)
	}

	private  initOptions(options?: AppOptions) {
		this.options = options || {}
		this.create(options?.root)
		this.initBuildInGlobalConfig()
		this.setGlobalConfig(options?.config)
		// this.registerPlugin(directiveInstaller)
		if (options?.plugins) {
			options.plugins.forEach((plugin: any) => {
				this.registerPlugin(plugin)
			})
		}

	}

	// 创建vue实例
	private create(root?: Component): App {
		const Com = root || defaultRootComponent
		this.app = createApp(Com)
		this.options.onBeforeLaunch && this.options.onBeforeLaunch(this)
		window.webApp = this
		return this
	}

	// 国际化
	public setUpLang(langLoaders: LangLoader | LangLoader[]){
		langLoaders && this.registerLangLoader(langLoaders)
		this.lang.value = this.getLang()
		// 设置默认语言（不走 setLang，避免把 system 模式覆盖成 zh/en）
		locale.use(this.lang.value, this.langMessage)
		this.watchSystemLang()
	}

	// 创建路由
	public createRouter(routes?: RouteRecordRaw[]) {
		this.router = createWebRouter({
			routes: routes || [],
			routeBase: this.options.routeBase || '',
			routeType: this.options.routeType || 'hash'
		})
		this.registerPlugin(this.router)
	}

	// 初始化内置全局状态
	private initBuildInGlobalConfig() {
		const globalConfig = this.app.config.globalProperties
		// 加载状态
		Object.defineProperty(globalConfig, '$appLoading', {
			writable: false,
			value: this.isLoading
		})
		Object.defineProperty(globalConfig, '$lang', {
			writable: false,
			value: this.lang
		})
		Object.defineProperty(globalConfig, '$t', { writable: false, value: t })
		Object.defineProperty(globalConfig, '$eventbus', { writable: false, value: eventbus })
	}

	// 自定义全局变量/方法
	public setGlobalConfig(config?: GlobalConfig): App {
		const globalConfig = this.app.config.globalProperties
		for (const key in config) {
			if (config.hasOwnProperty(key)) {
				globalConfig[key] = config[key]
			}
		}
		return this
	}

	// 注册语言加载器
	public registerLangLoader(loaders: LangLoader | LangLoader[]): App {
		locale.registerLangLoader(loaders)
		return this
	}

	// 注册插件
	public registerPlugin(plugins: Plugin, ...args: any[]): App {
		this.app.use(plugins, ...args)
		return this
	}

	// 注册路由信息
	public registerRoutes(routes: RouteRecordRaw[]): App {
		routes.forEach((route) => {
			this.router.addRoute(route)
		})
		return this
	}

	public setLang(lang: string): App {
		setLangStorage(lang)
		const actualLang = resolveLangMode(lang)
		locale.use(actualLang)
		this.lang.value = actualLang
		const onSwitchLang = this.options.onSwitchLang
		onSwitchLang && onSwitchLang(actualLang)
		return this
	}

	public getLang(): string {
		return resolveLangMode(getLangStorage() || this.options.lang || 'system')
	}

	public switchLang(lang: string): App {
		this.setLang(lang)
		return this
	}

	private watchSystemLang() {
		if (this.systemLangChangeHandler) {
			return
		}
		this.systemLangChangeHandler = () => {
			if (normalizeLangMode(getLangStorage()) === 'system') {
				this.setLang('system')
			}
		}
		window.addEventListener('languagechange', this.systemLangChangeHandler)
	}

	// 挂载vue应用
	public mount(el: string | HTMLElement): App {
		this.isLoading.value = true
		this.isLoading.value = false
		this.app.mount(el)
		this.options.onAfterLaunch && this.options.onAfterLaunch(this)
		return this
	}

	public onLaunch(callback: Function) {
		this.options.onAfterLaunch = wrapFunction(
			this.options.onAfterLaunch,
			callback
		)
		return this
	}

	public onBeforeLaunch(callback: Function) {
		this.options.onBeforeLaunch = wrapFunction(
			this.options.onBeforeLaunch,
			callback
		)
		return this
	}

	public onSwitchLang(callback: Function) {
		this.options.onSwitchLang = wrapFunction(
			this.options.onSwitchLang,
			callback
		)
		return this
	}

	public onSwitchTheme(callback: Function) {
		this.options.onSwitchTheme = wrapFunction(
			this.options.onSwitchTheme,
			callback
		)
		return this
	}
}
