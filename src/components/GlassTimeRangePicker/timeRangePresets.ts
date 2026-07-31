import { t } from '@ai-system/lib'

/** 快捷预设键；custom 表示切到日历自定义 */
export type GlassTimeRangePreset =
	| '3h'
	| '6h'
	| '12h'
	| '24h'
	| 'today'
	| 'yesterday'
	| 'week'
	| 'custom'

/** 毫秒 → YYYY-MM-DD HH:mm:ss（本地时区） */
export function formatGlassDateTime(ms: string | number): string {
	const d = new Date(Number(ms))
	if (Number.isNaN(d.getTime())) {
		return ''
	}
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 区间展示文案 */
export function formatGlassTimeRangeLabel(range: [string, string] | null | undefined): string {
	if (!range || range.length !== 2) {
		return ''
	}
	const from = formatGlassDateTime(range[0])
	const to = formatGlassDateTime(range[1])
	if (!from || !to) {
		return ''
	}
	return `${from} ~ ${to}`
}

/** 计算快捷预设起止毫秒 */
export function resolveGlassTimeRangePreset(
	preset: Exclude<GlassTimeRangePreset, 'custom'>
): [string, string] {
	const end = new Date()
	const start = new Date()
	switch (preset) {
		case '3h':
			start.setTime(end.getTime() - 3 * 60 * 60 * 1000)
			break
		case '6h':
			start.setTime(end.getTime() - 6 * 60 * 60 * 1000)
			break
		case '12h':
			start.setTime(end.getTime() - 12 * 60 * 60 * 1000)
			break
		case '24h':
			start.setTime(end.getTime() - 24 * 60 * 60 * 1000)
			break
		case 'today':
			start.setHours(0, 0, 0, 0)
			end.setHours(23, 59, 59, 999)
			break
		case 'yesterday': {
			start.setDate(start.getDate() - 1)
			start.setHours(0, 0, 0, 0)
			end.setDate(end.getDate() - 1)
			end.setHours(23, 59, 59, 999)
			break
		}
		case 'week':
			start.setTime(end.getTime() - 6 * 24 * 60 * 60 * 1000)
			start.setHours(0, 0, 0, 0)
			end.setHours(23, 59, 59, 999)
			break
	}
	return [String(start.getTime()), String(end.getTime())]
}

/** 默认快捷选项（自定义请走「日历中选择」Tab） */
export function buildGlassTimeRangePresetOptions() {
	return [
		{ value: '3h' as const, label: t('common.timeRange.3h') },
		{ value: '6h' as const, label: t('common.timeRange.6h') },
		{ value: '12h' as const, label: t('common.timeRange.12h') },
		{ value: '24h' as const, label: t('common.timeRange.24h') },
		{ value: 'today' as const, label: t('common.timeRange.today') },
		{ value: 'yesterday' as const, label: t('common.timeRange.yesterday') },
		{ value: 'week' as const, label: t('common.timeRange.week') }
	]
}
