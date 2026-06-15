/**
 * 键盘刷新拦截（F5 / Ctrl+R）。
 * 有进行中任务时弹出应用内确认框，避免无意刷新中断流式对话。
 */
import { onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'

const AUTH_ROUTE_PATHS = new Set([
	'/login',
	'/logout',
	'/register',
	'/forgot-password'
])

const isRefreshShortcut = (event: KeyboardEvent) => {
	if (event.key === 'F5') {
		return true
	}
	const key = event.key.toLowerCase()
	return key === 'r' && (event.ctrlKey || event.metaKey)
}

const handleKeydown = (event: KeyboardEvent) => {
	if (!isRefreshShortcut(event)) {
		return
	}
	void import('./leave').then(({ hasActiveChatTasks, guardLeaveWithActiveTasks }) => {
		if (!hasActiveChatTasks()) {
			return
		}
		event.preventDefault()
		event.stopPropagation()
		void guardLeaveWithActiveTasks().then((canLeave) => {
			if (canLeave) {
				window.location.reload()
			}
		})
	})
}

/** 有进行中的智能体任务时，拦截键盘刷新并弹出应用内确认框 */
export const useWarnBeforeUnloadOnActiveTasks = () => {
	const route = useRoute()

	const syncListener = () => {
		window.removeEventListener('keydown', handleKeydown, true)
		if (!AUTH_ROUTE_PATHS.has(route.path)) {
			window.addEventListener('keydown', handleKeydown, true)
		}
	}

	onMounted(syncListener)
	watch(() => route.path, syncListener)
	onUnmounted(() => {
		window.removeEventListener('keydown', handleKeydown, true)
	})
}
