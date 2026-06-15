<template>
	<div class="kb-maintenance-status">
		<div class="status-header">
			<span class="title">{{ t('kb.maintenance.title') }}</span>
			<el-button link type="primary" :loading="loading" @click="refresh">
				{{ t('common.refresh') }}
			</el-button>
		</div>

		<el-descriptions v-loading="loading" :column="2" border size="small">
			<el-descriptions-item :label="t('kb.maintenance.ready')">
				<el-tag size="small" :type="status?.ready ? 'success' : 'danger'">
					{{ status?.ready ? t('kb.maintenance.ready.yes') : t('kb.maintenance.ready.no') }}
				</el-tag>
			</el-descriptions-item>
			<el-descriptions-item :label="t('settings.embedding.dimension.label')">
				{{ status?.dimension ?? '-' }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('providerConfig.col.model')">
				{{ status?.modelName ?? '-' }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('providerConfig.col.provider')">
				{{ providerLabel(status?.providerType) }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('providerConfig.field.embeddingBatchSize')">
				{{ status?.embeddingBatchSize ?? 10 }}
			</el-descriptions-item>
			<el-descriptions-item :label="t('settings.embedding.runtime.lastProbe')">
				{{ formatProbeTime(status?.lastProbeTime) }}
			</el-descriptions-item>
		</el-descriptions>

		<el-alert
			v-if="status?.probeError"
			type="error"
			:closable="false"
			show-icon
			class="status-alert"
		>
			<div class="probe-error">
				<div>{{ status.probeError }}</div>
				<el-button
					v-if="showProbeAction"
					type="primary"
					size="small"
					:loading="probing"
					@click="onReprobe"
				>
					{{ t('settings.embedding.probe.retry') }}
				</el-button>
			</div>
		</el-alert>

		<el-alert
			v-if="status?.lastFailureMessage"
			type="error"
			:closable="false"
			show-icon
			class="status-alert"
		>
			{{ status.lastFailureMessage }}
		</el-alert>

		<el-alert
			v-else-if="status?.maintenanceActive"
			type="warning"
			:closable="false"
			show-icon
			class="status-alert"
		>
			<div class="running-alert">
				<span>{{ runningMessage }}</span>
				<span v-if="status?.currentFilePath" class="current-file">
					{{ status.currentFilePath }}
				</span>
			</div>
		</el-alert>

		<div class="sync-summary">
			<el-tag :type="taskTagType">{{ taskTypeLabel }}</el-tag>
			<span v-if="phaseLabel" class="phase-text">{{ phaseLabel }}</span>
			<span v-if="showProgress" class="progress-text">
				{{ status?.processedCount ?? 0 }} / {{ status?.totalCount ?? 0 }}
			</span>
		</div>

		<el-progress
			v-if="showProgress"
			:percentage="progressPercent"
			:stroke-width="8"
			:status="progressBarStatus"
		/>

		<div class="file-table-wrap">
			<el-table v-if="fileRows.length" :data="fileRows" size="small" max-height="240" stripe>
				<el-table-column
					:label="t('kb.sync.file.path')"
					prop="filePath"
					min-width="220"
					show-overflow-tooltip
				/>
				<el-table-column :label="t('kb.sync.file.changeType')" width="110">
					<template #default="{ row }">
						{{ changeTypeLabel(row.changeType) }}
					</template>
				</el-table-column>
				<el-table-column :label="t('kb.sync.file.status')" width="110">
					<template #default="{ row }">
						<el-tag size="small" :type="fileStatusTagType(row.status)">
							{{ fileStatusLabel(row.status) }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column
					label="Collection"
					prop="collection"
					width="140"
					show-overflow-tooltip
				/>
				<el-table-column :label="t('kb.sync.file.knowledgeCount')" width="100" align="center">
					<template #default="{ row }">
						<span v-if="row.knowledgeCount == null">-</span>
						<span v-else>{{ row.knowledgeCount }}</span>
					</template>
				</el-table-column>
				<el-table-column
					:label="t('kb.sync.file.error')"
					prop="errorMessage"
					min-width="160"
					show-overflow-tooltip
				/>
			</el-table>
			<div v-else class="empty-files">{{ t('kb.maintenance.noFiles') }}</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
	ElAlert,
	ElButton,
	ElDescriptions,
	ElDescriptionsItem,
	ElMessage,
	ElProgress,
	ElTable,
	ElTableColumn,
	ElTag
} from 'element-plus'
import { getKnowledgeSyncStatus } from '@/api/kb/kb.api'
import { probeEmbeddingRuntime } from '@/api/embedding-runtime.api'
import type {
	KnowledgeSyncFileChangeType,
	KnowledgeSyncFileStatus,
	KnowledgeSyncStatusDto
} from '@/types/kb.model'
import { t } from '@ai-system/lib'

const props = withDefaults(
	defineProps<{
		showProbeAction?: boolean
	}>(),
	{
		showProbeAction: false
	}
)

const emit = defineEmits<{
	(e: 'completed'): void
	(e: 'maintenance-change', active: boolean): void
}>()

const status = ref<KnowledgeSyncStatusDto | null>(null)
const loading = ref(false)
const probing = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null
let wasActive = false

const unwrap = (res: unknown): KnowledgeSyncStatusDto => {
	return (res as { data?: KnowledgeSyncStatusDto })?.data ?? (res as KnowledgeSyncStatusDto)
}

const fileRows = computed(() => status.value?.files ?? [])

const showProgress = computed(
	() => (status.value?.totalCount ?? 0) > 0 && !!status.value?.maintenanceActive
)

const progressPercent = computed(() => {
	const total = status.value?.totalCount ?? 0
	if (total <= 0) {
		return 0
	}
	return Math.min(100, Math.round(((status.value?.processedCount ?? 0) / total) * 100))
})

const progressBarStatus = computed(() => {
	if (status.value?.taskType === 'FAILED') {
		return 'exception'
	}
	if (!status.value?.maintenanceActive && progressPercent.value === 100) {
		return 'success'
	}
	return undefined
})

const taskTagType = computed(() => {
	switch (status.value?.taskType) {
		case 'FAILED':
			return 'danger'
		case 'FULL_REBUILD':
			return 'warning'
		case 'INCREMENTAL_SYNC':
		case 'INITIALIZING':
		case 'PROBING':
			return 'warning'
		default:
			return 'info'
	}
})

const taskTypeLabel = computed(() => {
	const type = status.value?.taskType ?? 'IDLE'
	return t(`kb.sync.taskType.${type}`)
})

const phaseLabel = computed(() => {
	const phase = status.value?.phase
	if (!phase || phase === 'IDLE') {
		return ''
	}
	return t(`kb.sync.phase.${phase}`)
})

const runningMessage = computed(() => {
	if (status.value?.fullRebuildRunning) {
		return t('kb.sync.running.fullRebuild')
	}
	return t('kb.sync.running.default')
})

const providerLabel = (raw?: string | null) => {
	switch (raw) {
		case 'open-ai':
			return t('providerConfig.provider.openai')
		case 'vllm':
			return t('providerConfig.provider.vllm')
		case 'anthropic':
			return t('providerConfig.provider.anthropic')
		case 'lm-studio':
			return t('providerConfig.provider.lmStudio')
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

const changeTypeLabel = (type?: KnowledgeSyncFileChangeType) => {
	if (!type) {
		return '-'
	}
	return t(`kb.sync.changeType.${type}`)
}

const fileStatusLabel = (value?: KnowledgeSyncFileStatus) => {
	if (!value) {
		return '-'
	}
	return t(`kb.sync.fileStatus.${value}`)
}

const fileStatusTagType = (value?: KnowledgeSyncFileStatus) => {
	switch (value) {
		case 'SYNCED':
		case 'DELETED':
			return 'success'
		case 'IN_PROGRESS':
			return 'warning'
		case 'FAILED':
			return 'danger'
		case 'SKIPPED':
			return 'info'
		default:
			return 'info'
	}
}

const shouldPoll = computed(
	() => !!status.value?.maintenanceActive || !!status.value?.probeError
)

const refresh = async () => {
	loading.value = true
	try {
		const res = await getKnowledgeSyncStatus()
		const next = unwrap(res)
		if (wasActive && !next.maintenanceActive && next.taskType !== 'FAILED') {
			emit('completed')
		}
		wasActive = !!next.maintenanceActive
		status.value = next
		emit('maintenance-change', !!next.maintenanceActive)
	} catch {
		ElMessage.error(t('kb.maintenance.load.failed'))
	} finally {
		loading.value = false
	}
}

const onReprobe = async () => {
	if (!props.showProbeAction) {
		return
	}
	probing.value = true
	try {
		await probeEmbeddingRuntime()
		await refresh()
		if (status.value?.probeError) {
			ElMessage.error(status.value.probeError)
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
		if (shouldPoll.value) {
			void refresh()
		}
	}, 2000)
}

const stopPolling = () => {
	if (pollTimer) {
		clearInterval(pollTimer)
		pollTimer = null
	}
}

watch(shouldPoll, (active) => {
	if (active) {
		startPolling()
	} else {
		stopPolling()
	}
})

onMounted(async () => {
	await refresh()
	if (shouldPoll.value) {
		startPolling()
	}
})

onUnmounted(stopPolling)

defineExpose({ refresh })
</script>

<style scoped lang="scss">
.kb-maintenance-status {
	display: flex;
	flex-direction: column;
	gap: 12px;
	margin-bottom: 12px;
	padding: 12px;
	border: 1px solid var(--n-color-border-soft);
	border-radius: 8px;
	background: var(--n-color-bg-soft, var(--el-fill-color-lighter));
}

.status-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
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

.sync-summary {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
}

.phase-text,
.progress-text,
.current-file {
	color: var(--n-color-text-muted, var(--el-text-color-secondary));
	font-size: 13px;
}

.running-alert {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.empty-files {
	padding: 12px 0;
	color: var(--n-color-text-muted, var(--el-text-color-secondary));
	font-size: 13px;
	text-align: center;
}

.file-table-wrap {
	min-height: 0;
}
</style>
