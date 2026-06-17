import { appendAuthTokenToUrl } from '@/utils/authenticatedUrl'
import { globalUrlPrefix, programTag } from '@/oem.js'
import type { ObjectFileUploadInit } from '@/types/file.types'

/** 展示 URL 由后端 {@code access-mode} 配置决定，前端不再改写 host（避免 SigV4 签名失效）。 */

export function buildChatAttachmentContentUrl(objectKey: string): string {
	return appendAuthTokenToUrl(
		`/v1${globalUrlPrefix}rest/${programTag}/chat/files/content?objectKey=${encodeURIComponent(objectKey)}`
	)
}

export function buildObjectFileContentUrl(objectKey: string): string {
	return appendAuthTokenToUrl(
		`/v1${globalUrlPrefix}rest/${programTag}/files/content?object-key=${encodeURIComponent(objectKey)}`
	)
}

export function buildObjectFileUploadContentUrl(objectKey: string): string {
	return appendAuthTokenToUrl(
		`/v1${globalUrlPrefix}rest/${programTag}/files/upload/content?object-key=${encodeURIComponent(objectKey)}`
	)
}

export function isChatAttachmentContentUrl(url?: string): boolean {
	return !!url?.includes('/chat/files/content?')
}

export function isObjectFileContentUrl(url?: string): boolean {
	return !!url?.includes('/files/content?') && !url.includes('/files/upload/content?')
}

export function isObjectFileUploadContentUrl(url?: string): boolean {
	return !!url?.includes('/files/upload/content?')
}

export function isOssPresignedUrl(url?: string): boolean {
	return !!url && (url.includes('X-Amz-Algorithm=') || url.includes('X-Amz-Signature='))
}

/** 浏览器无法直连的内网 OSS 地址（如 Docker 内 minio:9000、127.0.0.1） */
export function isUnreachableOssUrl(url?: string): boolean {
	if (!url || isChatAttachmentContentUrl(url) || isObjectFileContentUrl(url) || isObjectFileUploadContentUrl(url)) {
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
		return appendAuthTokenToUrl(url)
	}
	if (!url || isUnreachableOssUrl(url)) {
		return buildObjectFileContentUrl(objectKey)
	}
	return url
}

export function resolveObjectFileUploadInit(init: ObjectFileUploadInit): ObjectFileUploadInit {
	if (isObjectFileUploadContentUrl(init.uploadUrl)) {
		return {
			...init,
			uploadUrl: appendAuthTokenToUrl(init.uploadUrl)
		}
	}
	if (isUnreachableOssUrl(init.uploadUrl)) {
		return {
			...init,
			uploadUrl: buildObjectFileUploadContentUrl(init.objectKey),
			method: 'PUT'
		}
	}
	return init
}

export function resolveOssDisplayUrl(url?: string): string | undefined {
	if (!url) {
		return url
	}
	return appendAuthTokenToUrl(url)
}
