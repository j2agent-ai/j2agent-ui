import { ref } from 'vue'
import { getRegisterEnabled } from '@/api/register.api'

/** 跨 Login/Register 路由复用，避免返回登录页时注册入口闪烁 */
const registerEnabled = ref<boolean | null>(null)

let loading: Promise<boolean> | null = null

export async function loadRegisterEnabled(): Promise<boolean> {
	if (registerEnabled.value !== null) {
		return registerEnabled.value
	}
	if (loading) {
		return loading
	}
	loading = getRegisterEnabled()
		.then((res) => {
			registerEnabled.value = !!res.data?.enabled
			return registerEnabled.value
		})
		.catch(() => {
			registerEnabled.value = false
			return false
		})
		.finally(() => {
			loading = null
		})
	return loading
}

export function useRegisterEnabled() {
	return { registerEnabled }
}
