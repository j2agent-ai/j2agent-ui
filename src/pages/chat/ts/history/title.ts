/**
 * 历史对话标题生成与展示解析。
 * 与后端 CompositeKeyChatMemoryRepository 的图片占位标题约定对齐。
 */

/** 与后端 CompositeKeyChatMemoryRepository.IMAGE_ONLY_TITLE 一致，存库用、不直接展示 */
export const IMAGE_ONLY_HISTORY_TITLE_KEY = '__image_only__'

const LEGACY_IMAGE_ONLY_TITLES = ['发送图片', IMAGE_ONLY_HISTORY_TITLE_KEY] as const

export const SESSION_TITLE_MAX_LENGTH = 64

/** 判断是否为「仅发图片」类占位标题 */
export const isImageOnlyHistoryTitle = (title?: string | null) => {
	const raw = (title ?? '').trim()
	return (LEGACY_IMAGE_ONLY_TITLES as readonly string[]).includes(raw)
}

/**
 * 根据用户消息正文与附件数量生成会话标题（写入历史列表）。
 * 纯图片消息使用占位 key，展示时由 resolveHistoryItemTitle 翻译。
 */
export const buildSessionTitle = (
	content?: string | null,
	attachmentCount = 0
) => {
	const text = (content ?? '').trim()
	if (text) {
		return text.slice(0, SESSION_TITLE_MAX_LENGTH)
	}
	if (attachmentCount > 0) {
		return IMAGE_ONLY_HISTORY_TITLE_KEY
	}
	return ''
}

/** 历史列表展示用标题（图片占位 key 转为 i18n 文案） */
export const resolveHistoryItemTitle = (
	title: string | null | undefined,
	translate: (key: string) => string
) => {
	const raw = (title ?? '').trim()
	if (isImageOnlyHistoryTitle(raw)) {
		return translate('ai.history.image.only')
	}
	return raw
}
