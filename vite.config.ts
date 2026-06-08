import { defineConfig } from 'vite'
import { viteConfig } from './config/vite-config'
import defaultSettings from './setting'

/** 解析开发代理目标：完整 http(s) URL 或 host[:port]（无协议时补 http://）；WS 由 http(s) 前缀替换为 ws(s) */
function resolveDevProxyTargets(devServer: string) {
	const base = /^https?:\/\//i.test(devServer) ? devServer : `http://${devServer}`
	const url = new URL(base)
	const httpTarget = `${url.protocol}//${url.host}`
	const wsTarget = httpTarget.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
	return { httpTarget, wsTarget }
}

const { devServer, proxySecure = false } = defaultSettings
const { httpTarget, wsTarget } = resolveDevProxyTargets(devServer)

export default defineConfig(({ command, mode }) => {
	const proxyServer = [
		{
			path: '^/v.+/auth/',
			target: httpTarget,
			rewrite: false,
			secure: proxySecure
		},
		{
			path: '^/v.+/rest/',
			target: httpTarget,
			rewrite: false,
			secure: proxySecure
		},
		{
			path: '/ws/',
			target: wsTarget,
			rewrite: false,
			ws: true,
			secure: proxySecure
		}
	]
	return viteConfig(command, mode, proxyServer, 3112, '0.0.0.0')
})
