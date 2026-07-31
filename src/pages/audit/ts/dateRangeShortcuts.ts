import { t } from '@ai-system/lib'

/** 审计时间范围快捷选项（Element Plus DatePicker shortcuts） */
export function buildAuditDateRangeShortcuts() {
	return [
		{
			text: t('audit.filter.range.current'),
			value: () => {
				const end = new Date()
				const start = new Date()
				start.setHours(0, 0, 0, 0)
				return [start, end] as [Date, Date]
			}
		},
		{
			text: t('audit.filter.range.today'),
			value: () => {
				const start = new Date()
				start.setHours(0, 0, 0, 0)
				const end = new Date()
				end.setHours(23, 59, 59, 999)
				return [start, end] as [Date, Date]
			}
		},
		{
			text: t('audit.filter.range.last7days'),
			value: () => {
				const end = new Date()
				const start = new Date()
				start.setTime(end.getTime() - 7 * 24 * 60 * 60 * 1000)
				return [start, end] as [Date, Date]
			}
		},
		{
			text: t('audit.filter.range.last30days'),
			value: () => {
				const end = new Date()
				const start = new Date()
				start.setTime(end.getTime() - 30 * 24 * 60 * 60 * 1000)
				return [start, end] as [Date, Date]
			}
		}
	]
}
