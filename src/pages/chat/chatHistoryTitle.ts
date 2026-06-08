/** 与后端 CompositeKeyChatMemoryRepository.IMAGE_ONLY_TITLE 一致，存库用、不直接展示。 */
export const IMAGE_ONLY_HISTORY_TITLE_KEY = '__image_only__'

const LEGACY_IMAGE_ONLY_TITLES = ['发送图片', IMAGE_ONLY_HISTORY_TITLE_KEY] as const

export const SESSION_TITLE_MAX_LENGTH = 64

export const isImageOnlyHistoryTitle = (title?: string | null) => {
	const raw = (title ?? '').trim()
	return (LEGACY_IMAGE_ONLY_TITLES as readonly string[]).includes(raw)
}

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
