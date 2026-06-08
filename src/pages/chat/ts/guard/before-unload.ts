/**
 * 键盘刷新拦截（F5 / Ctrl+R）。
 * 有进行中任务时弹出应用内确认框，避免无意刷新中断流式对话。
 */
import { onMounted, onUnmounted } from 'vue'
import {
	guardLeaveWithActiveTasks,
	hasActiveChatTasks
} from './leave'

const isRefreshShortcut = (event: KeyboardEvent) => {
	if (event.key === 'F5') {
		return true
	}
	const key = event.key.toLowerCase()
	return key === 'r' && (event.ctrlKey || event.metaKey)
}

const handleKeydown = (event: KeyboardEvent) => {
	if (!isRefreshShortcut(event) || !hasActiveChatTasks()) {
		return
	}
	event.preventDefault()
	event.stopPropagation()
	void guardLeaveWithActiveTasks().then((canLeave) => {
		if (canLeave) {
			window.location.reload()
		}
	})
}

/** 有进行中的智能体任务时，拦截键盘刷新并弹出应用内确认框 */
export const useWarnBeforeUnloadOnActiveTasks = () => {
	onMounted(() => {
		window.addEventListener('keydown', handleKeydown, true)
	})

	onUnmounted(() => {
		window.removeEventListener('keydown', handleKeydown, true)
	})
}
