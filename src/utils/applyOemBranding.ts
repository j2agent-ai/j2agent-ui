import { faviconUrl } from '@/oem.js'

export function applyOemBranding() {
	const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
	// 子路径 + hash 路由部署：favicon 走相对 ./，去掉前导 / 以免请求到域名根
	if (link) link.setAttribute('href', faviconUrl.replace(/^\//, ''))
}
