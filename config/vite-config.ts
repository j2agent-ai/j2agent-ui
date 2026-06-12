import { loadEnv, UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import DefineOptions from 'unplugin-vue-define-options/vite'
import VueJsx from '@vitejs/plugin-vue-jsx'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import ElementPlus from 'unplugin-element-plus/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import fs from 'fs'
import { faviconUrl, primaryColor, primaryColorRgb } from '../src/oem.js'

const rootDir = path.join(__dirname, '../')
const oemVarsScssPath = path.join(rootDir, 'lib/common/styles/_oem-vars.scss')

function syncOemScssVars() {
	const content = [
		'// 由 oem.js 自动生成，请勿手动编辑',
		`$oem-primary: ${primaryColor};`,
		`$oem-primary-rgb: ${primaryColorRgb};`,
		''
	].join('\n')
	fs.writeFileSync(oemVarsScssPath, content, 'utf-8')
}

interface ProxyServer {
	path: string
	target: string
	rewrite?: boolean
	ws?: boolean
	/** false 时忽略 HTTPS 目标证书校验 */
	secure?: boolean
	headers?: { [header: string]: string }
}

/**
 * 将 node_modules 按功能合并为少量 chunk，避免按包名拆出数百个空 chunk
 * （d3、vega 等子包）导致 Rollup 在 CI 上 OOM。
 */
function resolveVendorChunk(id: string): string | undefined {
	if (!id.includes('node_modules')) {
		return undefined
	}
	const inNodeModules = id.split('node_modules/')[1]
	if (!inNodeModules) {
		return undefined
	}

	if (inNodeModules.startsWith('@')) {
		const scoped = inNodeModules.split('/').slice(0, 2).join('/')
		if (scoped === '@plantuml/core') {
			return 'plantuml-core'
		}
		if (scoped.startsWith('@vue/') || scoped === '@vue/reactivity') {
			return 'vue-vendor'
		}
		if (scoped.startsWith('@element-plus/')) {
			return 'element-plus'
		}
		return undefined
	}

	const pkg = inNodeModules.split('/')[0]
	if (pkg === 'vue' || pkg === 'vue-router' || pkg === 'pinia') {
		return 'vue-vendor'
	}
	if (pkg === 'element-plus') {
		return 'element-plus'
	}
	// mermaid 与 d3 互依赖，合并避免 circular chunk 警告
	if (
		pkg === 'mermaid' ||
		pkg === 'd3' ||
		pkg.startsWith('d3-') ||
		pkg === 'dagre' ||
		pkg === 'dagre-d3' ||
		pkg === 'cytoscape' ||
		pkg === 'cytoscape-fcose' ||
		pkg === 'katex'
	) {
		return 'mermaid'
	}
	if (pkg.startsWith('vega')) {
		return 'vega-vendor'
	}
	if (pkg === 'lodash-es' || pkg === 'lodash' || pkg === 'lodash-unified') {
		return 'lodash-vendor'
	}
	// 其余依赖交给 Rollup 默认拆分，避免 vendor 与 mermaid 循环引用
	return undefined
}

export function viteConfig(
	command: string,
	mode: string,
	proxyServer: Array<ProxyServer> = [],
	port: number = 3000,
	host: string = '0.0.0.0',
	isHttps: boolean = true
) {
	const env = loadEnv(mode, __dirname) || {}
	env.command = command
	env.mode = mode
	const isProductionBuild = command === 'build' && mode === 'production'
	const analyzeBundle = process.env.BUILD_ANALYZE === 'true'

	// 处理全局变量
	const defines: Record<string, string> = {}
	Object.keys(env).forEach((key) => {
		const envKey = '__' + key.toLocaleUpperCase() + '__'
		const envValue = JSON.stringify(env[key])
		defines[envKey] = envValue
		console.log(`全局变量：[${envKey}] => [${envValue}]`)
	})
	// 处理开发代理服务转发
	const proxyServers: Record<string, unknown> = {}
	proxyServer.forEach((server) => {
		const secure = server.secure ?? false
		if (server.ws) {
			proxyServers[server.path] = {
				target: server.target,
				ws: true,
				changeOrigin: true,
				secure,
				logLevel: 'debug',
				headers: server.headers
			}
		} else {
			proxyServers[server.path] = {
				target: server.target,
				changeOrigin: true,
				secure,
				rewrite: (url: string) => {
					const regex = new RegExp(`^${server.path}/`)
					const target = url.replace(regex, '')
					console.log(`Proxy [${new Date()}]`, target)
					return server.rewrite ? target : url
				},
				headers: server.headers
			}
		}
	})

	const viteBase =
		command === 'serve'
			? '/'
			: env.VITE_BASE?.trim() || './'

	let config = {
		base: viteBase,
		cacheDir: './node_modules/.vite',
		optimizeDeps: {
			include: ['vue', 'vue-router']
		},
		esbuild: {
			drop: isProductionBuild ? (['console', 'debugger'] as const) : []
		},
		css: {
			preprocessorOptions: {
				scss: {
					additionalData: `@use "sass:color";`,
					api: 'modern-compiler' as const,
					charset: false
				}
			},
			postcss: {
				plugins: [
					{
						postcssPlugin: 'internal:charset-removal',
						AtRule: {
							charset: (atRule: { name: string; remove: () => void }) => {
								if (atRule.name === 'charset') {
									atRule.remove()
								}
							}
						}
					}
				]
			}
		},
		plugins: [
			{
				name: 'oem-scss-vars',
				config() {
					syncOemScssVars()
				}
			},
			{
				name: 'oem-favicon-html',
				transformIndexHtml(html: string) {
					return html.replace(
						/<link rel="icon" href="[^"]*">/,
						`<link rel="icon" href="${faviconUrl}">`
					)
				}
			},
			AutoImport({
				resolvers: [ElementPlusResolver({ importStyle: 'sass' })]
			}),
			Components({
				resolvers: [ElementPlusResolver({ importStyle: 'sass' })]
			}),
			ElementPlus({
				useSource: true
			}),
			VueJsx(),
			DefineOptions(),
			vue(),
			...(analyzeBundle
				? [
						visualizer({
							open: false,
							gzipSize: true,
							brotliSize: true,
							filename: 'dist/report.html',
							template: 'treemap'
						})
					]
				: []),
			{
				name: 'copy-index-html-plugin',
				closeBundle() {
					const outDir = path.resolve(rootDir, env.VITE_OUT_DIR || 'dist')
					const indexPath = path.join(outDir, 'index.html')
					if (!fs.existsSync(indexPath)) {
						console.warn(
							`[copy-index-html-plugin] skip: ${indexPath} not found`
						)
						return
					}
					console.log('Vite 打包完成，执行自定义脚本...')
					const content = fs.readFileSync(indexPath, { encoding: 'utf-8' })
					// 这几个文件的长度不能一样,否则文件的etag相同
					fs.writeFileSync(path.join(outDir, 'index-zh.html'), content)
					fs.writeFileSync(
						path.join(outDir, 'index-en.html'),
						content
							.replace(
								'ai_system_language_variable = "zh"',
								'ai_system_language_variable = "en" // change file size.'
							)
							.replace('class="app-zh"', 'class="app-en"')
							.replace('lang="zh"', 'lang="en"')
					)
				}
			}
		],
		build: {
			outDir: env.VITE_OUT_DIR,
			emptyOutDir: isProductionBuild,
			assetsDir: './assets/',
			minify: 'esbuild' as const,
			reportCompressedSize: false,
			cssCodeSplit: true,
			sourcemap: mode === 'development',
			target: 'es2020',
			rollupOptions: {
				input: {
					index: path.join(rootDir, 'index.html')
				},
				output: {
					manualChunks(id) {
						return resolveVendorChunk(id)
					},
					dir: 'dist',
					format: 'es' as const,
					entryFileNames: `[name]-[hash].js`,
					chunkFileNames: `chunks/[name]-[hash].js`,
					assetFileNames: `assets/[name]-[hash].[ext]`
				},
				plugins: []
			}
		},
		resolve: {
			alias: {
				'@': path.join(rootDir, 'src'),
				'@ai-system/lib': path.join(rootDir, 'lib/index.ts'),
				'@ai-system': path.join(rootDir, 'lib')
			},
			dedupe: ['vue', 'vue-router']
		},
		server: {
			port: port,
			host: host,
			open: true,
			proxy: proxyServers
		},
		define: {
			...defines,
			VITE_APP_NAME: JSON.stringify(`main`)
		}
	}
	const moduleName = process.env['npm_config_project']
	// 构建子模块
	if (moduleName) {
		config = {
			...config,
			...{
				define: {
					...config.define,
					VITE_APP_NAME: JSON.stringify(`${moduleName}`)
				},
				root: `./src/pages/${moduleName}`,
				build: {
					...config.build,
					...{
						rollupOptions: {
							input: path.join(rootDir, `src/pages/${moduleName}/index.html`),
							output: {
								dir: `dist/${moduleName}`
							}
						}
					}
				}
			}
		}
	}
	return config as UserConfig
}
