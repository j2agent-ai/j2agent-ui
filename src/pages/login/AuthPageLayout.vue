<template>
	<div class="auth-page">
		<top-bar guest />
		<div class="auth-page__content">
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
import topBar from '@/pages/components/topBar.vue'
</script>

<style lang="scss" scoped>
.auth-page {
	min-height: 100vh;
	padding-top: var(--n-topbar-height, 50px);
	box-sizing: border-box;

	&__content {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: calc(100vh - var(--n-topbar-height, 50px));
		box-sizing: border-box;
	}
}
</style>
