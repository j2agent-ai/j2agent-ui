<template>
	<SidebarPageLayout v-model:active="activeMenuItem" @select="handleMenuSelect">
		<template #menu>
			<el-menu-item index="1">
				{{ t('kb.knowledge.list') }}
			</el-menu-item>
			<el-menu-item index="2">
				{{ t('kb.knowledge.hit.test') }}
			</el-menu-item>
			<el-menu-item index="3">
				{{ t('settings.rag.section') }}
			</el-menu-item>
		</template>

		<component :is="currentComponent" v-if="currentComponent" />
		<div v-else class="placeholder">
			<p>请选择一个菜单项</p>
		</div>
	</SidebarPageLayout>
</template>
<script setup lang="ts">
import { defineAsyncComponent, ref, shallowRef, type Component } from 'vue'
import { ElMenuItem } from 'element-plus'
import { t } from '@ai-system/lib'
import SidebarPageLayout from '@/pages/components/SidebarPageLayout.vue'

const KnowledgeBaseList = defineAsyncComponent(
	() => import('@/pages/kb/pages/KnowledgeBaseList.vue')
)
const HitTest = defineAsyncComponent(
	() => import('@/pages/kb/pages/HitTest.vue')
)
const RagSettings = defineAsyncComponent(
	() => import('@/pages/kb/pages/RagSettings.vue')
)

const activeMenuItem = ref('1')
const currentComponent = shallowRef<Component>(KnowledgeBaseList)

const handleMenuSelect = (key: string) => {
	activeMenuItem.value = key
	switch (key) {
		case '1':
			currentComponent.value = KnowledgeBaseList
			break
		case '2':
			currentComponent.value = HitTest
			break
		case '3':
			currentComponent.value = RagSettings
			break
		default:
			currentComponent.value = KnowledgeBaseList
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
