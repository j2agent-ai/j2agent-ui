<template>
	<SidebarPageLayout v-model:active="activeMenuItem" @select="handleMenuSelect">
		<template #menu>
			<el-menu-item index="token">
				{{ t('audit.menu.token') }}
			</el-menu-item>
			<el-menu-item index="chat">
				{{ t('audit.menu.chat') }}
			</el-menu-item>
		</template>

		<keep-alive>
			<component :is="currentComponent" v-if="currentComponent" :key="activeMenuItem" />
		</keep-alive>
		<div v-if="!currentComponent" class="placeholder">
			<p>{{ t('common.placeholder') }}</p>
		</div>
	</SidebarPageLayout>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref, shallowRef, type Component } from 'vue'
import { ElMenuItem } from 'element-plus'
import { t } from '@ai-system/lib'
import SidebarPageLayout from '@/pages/components/SidebarPageLayout.vue'

const TokenUsagePanel = defineAsyncComponent(
	() => import('@/pages/audit/pages/TokenUsagePanel.vue')
)
const ChatRecordPanel = defineAsyncComponent(
	() => import('@/pages/audit/pages/ChatRecordPanel.vue')
)

const activeMenuItem = ref('token')
const currentComponent = shallowRef<Component>(TokenUsagePanel)

/** 切换左侧菜单面板 */
const handleMenuSelect = (key: string) => {
	activeMenuItem.value = key
	switch (key) {
		case 'token':
			currentComponent.value = TokenUsagePanel
			break
		case 'chat':
			currentComponent.value = ChatRecordPanel
			break
		default:
			currentComponent.value = TokenUsagePanel
	}
}
</script>

<style scoped lang="scss">
.placeholder {
	display: flex;
	justify-content: center;
	align-items: center;
	height: 100%;
	font-size: 18px;
	color: var(--n-color-text-muted);
}
</style>
