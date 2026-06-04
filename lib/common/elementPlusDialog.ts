import { ElMessageBox } from 'element-plus'
import type { ElMessageBoxOptions, IElMessageBox } from 'element-plus'

/** 所有 Dialog / MessageBox 默认可拖动 */
const DRAGGABLE_OPTIONS: Pick<ElMessageBoxOptions, 'draggable'> = {
	draggable: true
}

/** 合并 MessageBox 选项，保证 draggable 默认开启且可被调用方覆盖 */
export function withDraggableMessageBoxOptions(
	options?: ElMessageBoxOptions
): ElMessageBoxOptions {
	return {
		...DRAGGABLE_OPTIONS,
		...options
	}
}

/**
 * 为 ElMessageBox 注入默认可拖动（Element Plus 2.9 无 ConfigProvider.dialog 全局项时使用）。
 */
export function installDraggableMessageBox(): void {
	const box = ElMessageBox as IElMessageBox & {
		_confirm?: IElMessageBox['confirm']
		_alert?: IElMessageBox['alert']
		_prompt?: IElMessageBox['prompt']
	}

	if (box._confirm) {
		return
	}

	box._confirm = box.confirm
	box._alert = box.alert
	box._prompt = box.prompt

	box.confirm = (
		message: string,
		titleOrOptions?: string | ElMessageBoxOptions,
		options?: ElMessageBoxOptions
	) => {
		if (typeof titleOrOptions === 'string') {
			return box._confirm!(message, titleOrOptions, withDraggableMessageBoxOptions(options))
		}
		return box._confirm!(message, withDraggableMessageBoxOptions(titleOrOptions))
	}

	box.alert = (message: string, titleOrOptions?: string | ElMessageBoxOptions, options?: ElMessageBoxOptions) => {
		if (typeof titleOrOptions === 'string') {
			return box._alert!(message, titleOrOptions, withDraggableMessageBoxOptions(options))
		}
		return box._alert!(message, withDraggableMessageBoxOptions(titleOrOptions))
	}

	if (box._prompt) {
		box.prompt = (
			message: string,
			titleOrOptions?: string | ElMessageBoxOptions,
			options?: ElMessageBoxOptions
		) => {
			if (typeof titleOrOptions === 'string') {
				return box._prompt!(message, titleOrOptions, withDraggableMessageBoxOptions(options))
			}
			return box._prompt!(message, withDraggableMessageBoxOptions(titleOrOptions))
		}
	}
}
