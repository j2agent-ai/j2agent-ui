<template>
	<div class="embedding-settings">
		<EmbeddingRuntimeStatus ref="runtimeRef" />
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
import EmbeddingRuntimeStatus from './EmbeddingRuntimeStatus.vue'
import ModelConfigListPanel from './ModelConfigListPanel.vue'

const runtimeRef = ref<InstanceType<typeof EmbeddingRuntimeStatus> | null>(null)
const listRef = ref<InstanceType<typeof ModelConfigListPanel> | null>(null)

const onEmbeddingChanged = async () => {
	await runtimeRef.value?.refresh()
}
</script>

<style scoped lang="scss">
.embedding-settings {
	display: flex;
	flex-direction: column;
	gap: 16px;
}
</style>
