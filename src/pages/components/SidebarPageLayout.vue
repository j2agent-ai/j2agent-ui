<template>
	<div class="sidebar-page-layout">
		<top-bar />
		<div class="sidebar-page-layout__body">
			<el-menu
				:default-active="active"
				class="sidebar-page-layout__menu"
				:collapse="collapse"
				@select="handleSelect"
			>
				<slot name="menu" />
			</el-menu>
			<main class="sidebar-page-layout__main">
				<div class="sidebar-page-layout__content">
					<slot />
				</div>
			</main>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ElMenu } from 'element-plus'
import topBar from '@/pages/components/topBar.vue'

withDefaults(
	defineProps<{
		collapse?: boolean
	}>(),
	{
		collapse: false,
	}
)

const active = defineModel<string>('active', { default: '1' })

const emit = defineEmits<{
	select: [key: string, keyPath: string[]]
}>()

const handleSelect = (key: string, keyPath: string[]) => {
	emit('select', key, keyPath)
}
</script>

<style scoped lang="scss">
@use '@/styles/platform' as *;

.sidebar-page-layout {
	display: flex;
	flex-direction: column;
	height: 100vh;
	overflow: hidden;

	&__body {
		display: flex;
		flex: 1;
		overflow: hidden;
		padding-top: var(--n-topbar-height, 50px);
		box-sizing: border-box;
	}

	&__menu {
		width: var(--n-sidebar-width, 152px);
		flex-shrink: 0;
		box-sizing: border-box;
		padding: var(--n-sidebar-padding-y, 16px) var(--n-sidebar-padding-x, 10px);
		border-right: none;
		height: 100%;
		--el-menu-bg-color: transparent;
		--el-menu-hover-bg-color: transparent;
		--el-menu-active-color: var(--n-color-text-inverse);
		@include n-glass-surface(2);

		&.el-menu--collapse {
			width: var(--n-sidebar-collapsed-width, 52px);
			padding-inline: 8px;
		}
	}

	:deep(.el-menu-item) {
		height: var(--n-sidebar-item-height, 40px);
		min-height: var(--n-sidebar-item-height, 40px);
		line-height: 1.2;
		padding: 0 8px !important;
		margin: 0 0 var(--n-sidebar-item-gap, 8px);
		font-size: var(--n-font-size-2);
		border-radius: 8px;
		transition:
			background-color 0.2s ease,
			color 0.2s ease;
		color: var(--n-color-text-primary);
		display: flex;
		justify-content: center;
		align-items: center;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;

		&:last-child {
			margin-bottom: 0;
		}

		&.is-active,
		&:hover {
			background-color: var(--el-color-primary);
			color: var(--n-color-text-inverse);
		}
	}

	:deep(.el-menu--collapse .el-menu-item) {
		margin-bottom: var(--n-sidebar-item-gap, 8px);
		padding: 0 !important;
		justify-content: center;
	}

	&__main {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-width: 0;
	}

	&__content {
		flex: 1;
		min-height: 0;
		min-width: 0;
		overflow: hidden;
		padding: 20px;
		display: flex;
		flex-direction: column;

		> * {
			flex: 1;
			min-height: 0;
			min-width: 0;
		}
	}
}
</style>
