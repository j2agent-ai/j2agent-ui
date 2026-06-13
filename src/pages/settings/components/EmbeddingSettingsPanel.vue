<template>
	<div class="embedding-settings">
		<KnowledgeMaintenanceStatusPanel ref="maintenanceStatusRef" show-probe-action />
		<ModelConfigListPanel
			ref="listRef"
			api-type="embedding"
			:default-hint="t('providerConfig.hint.embedding')"
			rebuild-on-embedding-change
			@embedding-changed="onEmbeddingChanged"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { t } from '@ai-system/lib'
import KnowledgeMaintenanceStatusPanel from '@/pages/kb/components/KnowledgeMaintenanceStatusPanel.vue'
import ModelConfigListPanel from './ModelConfigListPanel.vue'

const maintenanceStatusRef = ref<InstanceType<typeof KnowledgeMaintenanceStatusPanel> | null>(null)
const listRef = ref<InstanceType<typeof ModelConfigListPanel> | null>(null)

const onEmbeddingChanged = async () => {
	await maintenanceStatusRef.value?.refresh()
}
</script>

<style scoped lang="scss">
.embedding-settings {
	display: flex;
	flex-direction: column;
	gap: 16px;
}
</style>
