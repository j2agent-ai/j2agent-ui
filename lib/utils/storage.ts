import { STORAGE_LANG_KEY, STORAGE_PERMISSION_KEY } from './constants'

export function setStorageItem(key: string, value: any, session = false) {
	const storage = session ? sessionStorage : localStorage
	if (value !== null && value !== undefined) {
		storage.setItem(key, String(value))
	}
}
export function setLangStorage(lang: string | null | undefined) {
	const oldValue = getLangStorage()
	if (!oldValue || oldValue !== lang) {
		setStorageItem(STORAGE_LANG_KEY, lang)
	}
}

export function getLangStorage(): string | null {
	return localStorage.getItem(STORAGE_LANG_KEY)
}

/** 规范化语言模式：system / zh / en */
export function normalizeLangMode(lang: string | null | undefined): 'system' | 'zh' | 'en' {
	if (lang === 'zh' || lang === 'en' || lang === 'system') {
		return lang
	}
	return 'system'
}

/** 根据浏览器语言解析系统默认语言 */
export function resolveSystemLang(): 'zh' | 'en' {
	const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
	const systemLang = (languages.find(Boolean) || '').toLowerCase()
	return systemLang.startsWith('en') ? 'en' : 'zh'
}

/** 将语言模式解析为实际生效的 zh / en */
export function resolveLangMode(lang: string | null | undefined): 'zh' | 'en' {
	const mode = normalizeLangMode(lang)
	return mode === 'system' ? resolveSystemLang() : mode
}

export function getPermissionStorage(): any {
	return JSON.parse(localStorage.getItem(STORAGE_PERMISSION_KEY))
}

export function getPermissionAllStorage(): any {
	return JSON.parse(localStorage.getItem(STORAGE_PERMISSION_KEY + "_all"))
}