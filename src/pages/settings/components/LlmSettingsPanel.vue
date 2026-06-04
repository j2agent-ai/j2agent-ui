<template>
	<ModelConfigListPanel api-type="llm" :default-hint="t('providerConfig.hint.llm')" />
</template>

<script setup lang="ts">
import { t } from '@ai-system/lib'
import ModelConfigListPanel from './ModelConfigListPanel.vue'
</script>
