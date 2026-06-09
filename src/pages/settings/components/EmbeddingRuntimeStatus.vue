<template>
	<div class="embedding-runtime-status">
		<div class="status-header">
			<span class="title">{{ t('settings.embedding.runtime.title') }}</span>
			<el-button link type="primary" :loading="loading" @click="refresh">
				{{ t('common.refresh') }}
			</el-button>
		</div>

		<el-alert
			v-if="runtime?.fullRebuildRunning"
			type="warning"
			:closable="false"
			show-icon
			class="status-alert"
		>
			{{ t('settings.embedding.runtime.rebuilding') }}
		</el-alert>

		<el-alert
			v-if="runtime?.probeError"
			type="error"
			:closable="false"
			show-icon
			class="status-alert"
		>
			<div class="probe-error">
				<div>{{ runtime.probeError }}</div>
				<el-button type="primary" size="small" :loading="probing" @click="onReprobe">
					{{ t('settings.embedding.probe.retry') }}
				</el-button>
			</div>
		</el-alert>

		<el-descriptions v-loading="loading" :column="2" border size="small">
			<el-descriptions-item :label="t('settings.embedding.dimension.label')">
				{{ runtime?.dimension ?? '-' }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('providerConfig.col.model')">
				{{ runtime?.modelName ?? '-' }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('providerConfig.col.provider')">
				{{ providerLabel(runtime?.providerType) }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('providerConfig.field.embeddingBatchSize')">
				{{ runtime?.embeddingBatchSize ?? 10 }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('settings.embedding.runtime.lastProbe')">
				{{ formatProbeTime(runtime?.lastProbeTime) }}
			</el-descriptions-item>
		</el-descriptions>
	</div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElAlert, ElButton, ElDescriptions, ElDescriptionsItem, ElMessage } from 'element-plus'
import { t } from '@ai-system/lib'
import {
	getEmbeddingRuntime,
	probeEmbeddingRuntime,
	type EmbeddingRuntimeStatusDto
} from '@/api/embedding-runtime.api'

const runtime = ref<EmbeddingRuntimeStatusDto | null>(null)
const loading = ref(false)
const probing = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

const providerLabel = (raw?: string | null) => {
	switch (raw) {
		case 'open-ai':
			return t('providerConfig.provider.openai')
		case 'ollama':
			return t('providerConfig.provider.ollama')
		default:
			return raw ?? '-'
	}
}

const formatProbeTime = (value?: number | null) => {
	if (!value) {
		return '-'
	}
	return new Date(value).toLocaleString()
}

const unwrap = (res: any): EmbeddingRuntimeStatusDto => {
	return (res?.data as any)?.data ?? res?.data ?? res
}

const refresh = async () => {
	loading.value = true
	try {
		const res = await getEmbeddingRuntime()
		runtime.value = unwrap(res)
	} catch {
		ElMessage.error(t('settings.embedding.runtime.load.failed'))
	} finally {
		loading.value = false
	}
}

const onReprobe = async () => {
	probing.value = true
	try {
		const res = await probeEmbeddingRuntime()
		runtime.value = unwrap(res)
		if (runtime.value?.probeError) {
			ElMessage.error(runtime.value.probeError)
		} else {
			ElMessage.success(t('settings.embedding.probe.success'))
		}
	} catch {
		ElMessage.error(t('settings.embedding.probe.failed'))
	} finally {
		probing.value = false
	}
}

const startPolling = () => {
	stopPolling()
	pollTimer = setInterval(() => {
		if (runtime.value?.fullRebuildRunning) {
			void refresh()
		}
	}, 5000)
}

const stopPolling = () => {
	if (pollTimer) {
		clearInterval(pollTimer)
		pollTimer = null
	}
}

onMounted(async () => {
	await refresh()
	startPolling()
})

onUnmounted(stopPolling)

defineExpose({ refresh })
</script>

<style scoped lang="scss">
.embedding-runtime-status {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.status-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.title {
	font-size: 14px;
	font-weight: 600;
}

.status-alert {
	margin: 0;
}

.probe-error {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 8px;
}
</style>
