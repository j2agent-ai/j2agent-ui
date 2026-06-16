<template></template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { logout } from '@/api/login.api'
import { goTo } from '@/routes'
import { setSessionInfo } from '@/utils/role'
import { clearAuthToken } from '@/utils/token'

onMounted(() => {
	logout().finally(() => {
		clearAuthToken()
		setSessionInfo(null)
		void goTo('/login')
	})
})
</script>
<style lang="scss" scoped></style>
