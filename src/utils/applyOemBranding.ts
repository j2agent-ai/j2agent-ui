import { faviconUrl } from '@/oem.js'

export function applyOemBranding() {
	const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
	if (link) link.href = faviconUrl
}
