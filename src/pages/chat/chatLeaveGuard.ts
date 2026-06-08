import { ElMessageBox } from 'element-plus'
import { t } from '@ai-system/lib'
import { chatActivityStore } from './chatActivityStore'

let confirmingLeave = false

export const hasActiveChatTasks = () =>
	chatActivityStore.activeEntries.value.length > 0

const showLeaveConfirm = () =>
	ElMessageBox.confirm(
		t('ai.activity.beforeunload'),
		t('ai.activity.beforeunload.title'),
		{
			customClass: 'n-dialog--danger',
			confirmButtonText: t('ai.activity.beforeunload.confirm'),
			cancelButtonText: t('common.cancel'),
			type: 'warning'
		}
	)

export const stopAllActiveChatTurns = async () => {
	const { chatSessionRegistry } = await import('./chatSessionRegistry')
	chatSessionRegistry.stopAllActiveTurns()
}

/**
 * 有进行中的任务时弹出离开确认；确认后停止所有任务。
 * @returns true 可继续离开；false 用户取消
 */
export const guardLeaveWithActiveTasks = async (): Promise<boolean> => {
	if (!hasActiveChatTasks()) {
		return true
	}
	if (confirmingLeave) {
		return false
	}
	confirmingLeave = true
	try {
		await showLeaveConfirm()
		await stopAllActiveChatTurns()
		return true
	} catch {
		return false
	} finally {
		confirmingLeave = false
	}
}
