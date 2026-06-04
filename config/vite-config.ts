import { loadEnv, UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import legacy from '@vitejs/plugin-legacy'
import path from 'path'
import DefineOptions from 'unplugin-vue-define-options/vite'
import VueJsx from '@vitejs/plugin-vue-jsx'
import fs from 'fs'

const rootDir = path.join(__dirname, '../')

interface ProxyServer {
	path: string
	target: string
	rewrite?: boolean
	ws?: boolean
	/** false 时忽略 HTTPS 目标证书校验 */
	secure?: boolean
	headers?: { [header: string]: string }
}

export function viteConfig(
	command,
	mode,
	proxyServer: Array<ProxyServer> = [],
	port: number = 3000,
	host: string = '0.0.0.0',
	isHttps: boolean = true
) {
	const env = loadEnv(mode, __dirname) || {}
	env.command = command
	env.mode = mode
	// 处理全局变量
	const defines = {}
	Object.keys(env).forEach((key) => {
		const envKey = '__' + key.toLocaleUpperCase() + '__'
		const envValue = JSON.stringify(env[key])
		defines[envKey] = envValue
		console.log(`全局变量：[${envKey}] => [${envValue}]`)
	})
	// 处理开发代理服务转发
	const proxyServers = {}
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
				rewrite: (url) => {
					const regex = new RegExp(`^${server.path}/`)
					const target = url.replace(regex, '')
					console.log(`Proxy [${new Date()}]`, target)
					return server.rewrite ? target : url
				},
				headers: server.headers
			}
		}
	})

	let config = {
		// 指定在构建生产版本时，HTML文件所在的基础路径，默认情况下为相对路径（./）
		base: env.VITE_BASE,
		cacheDir: './node_modules/.vite',
		optimizeDeps: {
			include: ['vue', 'vue-router'] // 预构建核心依赖
		},
		css: {
			preprocessorOptions: {
				scss: {
					additionalData: `@use "sass:color";`,
					charset: false
				}
			},
			postcss: {
				plugins: [
					{
						postcssPlugin: 'internal:charset-removal',
						AtRule: {
							charset: (atRule) => {
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
			VueJsx(),
			DefineOptions(),
			vue({
				refTransform: true
			}),
			legacy({
				targets: ['ie >= 11'],
				additionalLegacyPolyfills: ['regenerator-runtime/runtime']
			}),
			{
				name: 'copy-index-html-plugin',
				closeBundle() {
					console.log('Vite 打包完成，执行自定义脚本...')
					// 复制 index.html
					const content = fs.readFileSync('dist/index.html', {
						encoding: 'utf-8'
					})
					// 这几个文件的长度不能一样,否则文件的etag相同
					fs.writeFileSync('dist/index-zh.html', content)
					fs.writeFileSync(
						'dist/index-en.html',
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
			// visualizer({
			// 	open: false,
			// 	gzipSize: true,
			// 	brotliSize: true,
			// 	filename: 'report.html',
			// 	template: 'treemap'
			// }),
			// compression({
			// 	algorithm: "gzip", // 指定压缩算法为gzip,[ 'gzip' , 'brotliCompress' ,'deflate' , 'deflateRaw']
			// 	ext: ".gz", // 指定压缩后的文件扩展名为.gz
			// 	threshold: 10240, // 仅对文件大小大于threshold的文件进行压缩，默认为10KB
			// 	deleteOriginFile: true, // 是否删除原始文件，默认为false
			// 	filter: /\.(js|css|json|html|ico|svg)(\?.*)?$/i, // 匹配要压缩的文件的正则表达式，默认为匹配.js、.css、.json、.html、.ico和.svg文件
			// 	compressionOptions: { level: 9 }, // 指定gzip压缩级别，默认为9（最高级别）
			// 	verbose: true, // 是否在控制台输出压缩结果
			// 	disable: false, // 是否禁用插件
			// }),
		],
		build: {
			outDir: env.VITE_OUT_DIR,
			emptyOutDir: false,
			assetsDir: './assets/',
			minify: 'terser',
			terserOptions: {
				compress: {
					drop_console: true,
					drop_debugger: true
				}
			},
			sourcemap: mode === 'development',
			target: 'es2020',
			rollupOptions: {
				input: {
					index: path.join(rootDir, 'index.html')
				},
				output: {
					// 最小化拆分包
					manualChunks(id) {
						if (id.includes('node_modules')) {
							// 通过拆分包的方式将所有来自node_modules的模块打包到单独的chunk中
							return id
								.toString()
								.split('node_modules/')[1]
								.split('/')[0]
								.toString()
						}
					},
					dir: 'dist', // 输出目录
					format: 'es', // 输出格式
					entryFileNames: `[name]-[hash].js`, // 根据入口文件名称生成输出文件名
					chunkFileNames: `chunks/[name]-[hash].js`, // 动态导入的代码块文件名模式
					assetFileNames: `assets/[name]-[hash].[ext]` // 资源文件（如CSS、图片等）的文件名模式
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
			// https: isHttps,
			proxy: proxyServers
		},
		// 全局变量
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
				// 指定项目根目录，默认为当前工作目录
				root: `./src/pages/${moduleName}`,
				build: {
					...config.build,
					...{
						// https://cn.vitejs.dev/guide/build.html
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
