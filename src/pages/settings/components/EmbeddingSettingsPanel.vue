<template>
	<ModelConfigListPanel
		api-type="embedding"
		:default-hint="t('providerConfig.hint.embedding')"
		rebuild-on-embedding-activate
	/>
</template>

<script setup lang="ts">
import { t } from '@ai-system/lib'
import ModelConfigListPanel from './ModelConfigListPanel.vue'
</script>
