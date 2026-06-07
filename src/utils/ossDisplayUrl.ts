import { globalUrlPrefix, programTag } from '@/oem.js'

/** 展示 URL 由后端 {@code chat-attachment-display} 配置决定，前端不再改写 host（避免 SigV4 签名失效）。 */

export function buildChatAttachmentContentUrl(objectKey: string): string {
	return `/v1${globalUrlPrefix}rest/${programTag}/chat/files/content?objectKey=${encodeURIComponent(objectKey)}`
}

export function buildObjectFileContentUrl(objectKey: string): string {
	return `/v1${globalUrlPrefix}rest/${programTag}/files/content?object-key=${encodeURIComponent(objectKey)}`
}

export function isChatAttachmentContentUrl(url?: string): boolean {
	return !!url?.includes('/chat/files/content?')
}

export function isObjectFileContentUrl(url?: string): boolean {
	return !!url?.includes('/files/content?')
}

export function isOssPresignedUrl(url?: string): boolean {
	return !!url && (url.includes('X-Amz-Algorithm=') || url.includes('X-Amz-Signature='))
}

/** 浏览器无法直连的内网 OSS 地址（如 Docker 内 minio:9000、127.0.0.1） */
export function isUnreachableOssUrl(url?: string): boolean {
	if (!url || isChatAttachmentContentUrl(url) || isObjectFileContentUrl(url)) {
		return false
	}
	if (isOssPresignedUrl(url)) {
		try {
			const { hostname } = new URL(url, window.location.origin)
			return (
				hostname === '127.0.0.1' ||
				hostname === 'localhost' ||
				hostname === 'minio'
			)
		} catch {
			return true
		}
	}
	return false
}

export function resolveObjectFilePreviewUrl(objectKey: string, url?: string): string {
	if (url && isObjectFileContentUrl(url)) {
		return url
	}
	if (!url || isUnreachableOssUrl(url)) {
		return buildObjectFileContentUrl(objectKey)
	}
	return url
}

export function resolveOssDisplayUrl(url?: string): string | undefined {
	return url
}
