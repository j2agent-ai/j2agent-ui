/**
 * Chat 模块对外 barrel 导出。
 * 供 App 根组件、路由守卫等 chat 目录外模块引用。
 */
export { ensureAgentNamesLoaded, refreshAgentNames, getAgentDisplayName } from './agent/name-registry'
export { useWarnBeforeUnloadOnActiveTasks } from './guard/before-unload'
export {
	guardLeaveWithActiveTasks,
	hasActiveChatTasks,
	stopAllActiveChatTurns
} from './guard/leave'
