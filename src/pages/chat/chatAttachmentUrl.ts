import type { ChatAttachmentDto } from '@/types/ai.types'
import {
	buildChatAttachmentContentUrl,
	isChatAttachmentContentUrl,
	isUnreachableOssUrl,
	resolveOssDisplayUrl
} from '@/utils/ossDisplayUrl'

export {
	buildChatAttachmentContentUrl,
	isChatAttachmentContentUrl,
	isOssPresignedUrl,
	isUnreachableOssUrl,
	resolveOssDisplayUrl
} from '@/utils/ossDisplayUrl'

export function resolveAttachmentDisplayUrl(
	attachment: ChatAttachmentDto
): ChatAttachmentDto {
	if (attachment.objectKey) {
		const url = attachment.url
		if (url && isChatAttachmentContentUrl(url)) {
			return attachment
		}
		// 后端仍下发 MinIO 内网预签名（旧版本或未生效的 proxy 配置）时，改走 content 代理
		if (!url || isUnreachableOssUrl(url)) {
			return {
				...attachment,
				url: buildChatAttachmentContentUrl(attachment.objectKey)
			}
		}
	}
	if (attachment.url) {
		const resolved = resolveOssDisplayUrl(attachment.url)
		if (resolved !== attachment.url) {
			return { ...attachment, url: resolved }
		}
	}
	return attachment
}

/** 气泡 / 全屏预览共用的 img src */
export function resolveAttachmentImageSrc(attachment: ChatAttachmentDto): string {
	return resolveAttachmentDisplayUrl(attachment).url ?? ''
}

export function resolveAttachmentsDisplayUrls(
	attachments?: ChatAttachmentDto[]
): ChatAttachmentDto[] | undefined {
	if (!attachments?.length) {
		return attachments
	}
	return attachments.map(resolveAttachmentDisplayUrl)
}
