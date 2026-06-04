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
import { ref, shallowRef } from 'vue'
import { ElMenuItem } from 'element-plus'
import KnowledgeBaseList from '@/pages/kb/pages/KnowledgeBaseList.vue'
import { t } from '@ai-system/lib'
import SidebarPageLayout from '@/pages/components/SidebarPageLayout.vue'
import HitTest from '@/pages/kb/pages/HitTest.vue'
import RagSettings from '@/pages/kb/pages/RagSettings.vue'

const activeMenuItem = ref('1')
const currentComponent = shallowRef(KnowledgeBaseList)

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
