<template></template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { logout } from '@/api/login.api'
import { createGlassLoading, goTo } from '@/routes'
import { setSessionInfo } from '@/utils/role'
import { clearAuthToken } from '@/utils/token'

/** 防止重复进入 /logout 时并行发起多次注销请求 */
let logoutInFlight = false

onMounted(() => {
	if (logoutInFlight) {
		return
	}
	logoutInFlight = true
	const loading = createGlassLoading()
	logout()
		.finally(async () => {
			clearAuthToken()
			setSessionInfo(null)
			try {
				await goTo('/login')
			} finally {
				loading.close()
				logoutInFlight = false
			}
		})
})
</script>
<style lang="scss" scoped></style>
