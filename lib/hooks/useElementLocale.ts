import zh from 'element-plus/dist/locale/zh-cn'
import en from 'element-plus/dist/locale/en'
import { computed } from 'vue'
import { locale } from '@ai-system/locale'
import { memo } from '@ai-system/utils'

const elLangs = {
	zh,
	en
}

export const useElementLocale = memo(() => {
	const elLocale = computed(() => elLangs[locale.lang.value] ?? zh)
	const switchLang = (lang: string) => {
		locale.lang.value = lang
	}
	return {
		elLocale,
		switchLang
	}
})
