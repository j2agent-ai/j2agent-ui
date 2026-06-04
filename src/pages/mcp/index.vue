<template>
	<SidebarPageLayout v-model:active="activeMenuItem" @select="handleMenuSelect">
		<template #menu>
			<el-menu-item index="1">
				{{ t('mcp.menu.status') }}
			</el-menu-item>
			<el-menu-item index="2">
				{{ t('mcp.menu.config') }}
			</el-menu-item>
		</template>

		<component :is="currentComponent" v-if="currentComponent" />
		<div v-else class="placeholder">
			<p>{{ t('common.placeholder') }}</p>
		</div>
	</SidebarPageLayout>
</template>

<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { ElMenuItem } from 'element-plus'
import { t } from '@ai-system/lib'
import SidebarPageLayout from '@/pages/components/SidebarPageLayout.vue'
import McpServerStatus from '@/pages/mcp/pages/McpServerStatus.vue'
import McpServerConfig from '@/pages/mcp/pages/McpServerConfig.vue'

const activeMenuItem = ref('1')
const currentComponent = shallowRef(McpServerStatus)

const handleMenuSelect = (key: string) => {
	activeMenuItem.value = key
	switch (key) {
		case '1':
			currentComponent.value = McpServerStatus
			break
		case '2':
			currentComponent.value = McpServerConfig
			break
		default:
			currentComponent.value = McpServerStatus
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
