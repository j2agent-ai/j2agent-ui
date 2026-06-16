<template>
	<SidebarPageLayout v-model:active="activePanel">
		<template #menu>
			<el-menu-item index="files" @click="activePanel = 'files'">
				{{ t('files.menu.manage') }}
			</el-menu-item>
			<el-menu-item index="sync" @click="openSyncPanel">
				{{ t('files.menu.sync') }}
			</el-menu-item>
		</template>

		<section v-if="activePanel === 'files'" class="files-panel">
			<div class="toolbar">
				<div class="toolbar__group">
					<input
						ref="fileInput"
						type="file"
						multiple
						hidden
						@change="handleFilesSelected"
					/>
					<el-button
						type="primary"
						:loading="uploading && uploadProgress === 0"
						:disabled="uploading"
						@click="fileInput?.click()"
					>
						{{ t('files.upload') }}
					</el-button>
					<el-progress
						v-if="uploading"
						class="upload-progress"
						:percentage="uploadProgress"
						:stroke-width="8"
						@click="uploadDialogVisible = true"
					/>
					<button
						v-if="uploading"
						type="button"
						class="upload-count"
						@click="uploadDialogVisible = true"
					>
						{{ uploadCompletedCount }}/{{ uploadQueue.length }}
					</button>
					<el-button
						v-if="uploadQueue.length"
						link
						type="primary"
						@click="uploadDialogVisible = true"
					>
						{{ t('files.upload.batch.details') }}
					</el-button>
					<el-button
						type="danger"
						:disabled="selectedFiles.length === 0"
						@click="confirmBatchDelete"
					>
						{{ t('files.batch.delete') }}
					</el-button>
					<el-button @click="loadFiles">{{ t('common.refresh') }}</el-button>
				</div>
				<div class="toolbar__group toolbar__filters">
					<el-select
						v-model="fileStatus"
						clearable
						:placeholder="t('files.status')"
						@change="resetAndLoadFiles"
					>
						<el-option label="READY" value="READY" />
						<el-option label="UPLOADING" value="UPLOADING" />
						<el-option label="DELETING" value="DELETING" />
						<el-option label="ERROR" value="ERROR" />
					</el-select>
					<el-input
						v-model="keyword"
						clearable
						:placeholder="t('common.search.placeholder.keyword')"
						@keyup.enter="resetAndLoadFiles"
						@clear="resetAndLoadFiles"
					/>
					<el-button type="primary" @click="resetAndLoadFiles">
						{{ t('common.search') }}
					</el-button>
				</div>
			</div>

			<el-breadcrumb class="breadcrumbs" separator="/">
				<el-breadcrumb-item>
					<a @click.prevent="navigateTo('')">{{ t('files.root') }}</a>
				</el-breadcrumb-item>
				<el-breadcrumb-item v-for="part in breadcrumbParts" :key="part.prefix">
					<a @click.prevent="navigateTo(part.prefix)">{{ part.name }}</a>
				</el-breadcrumb-item>
			</el-breadcrumb>

			<div class="table-wrap">
				<el-table
					v-loading="fileLoading"
					:data="files"
					height="100%"
					@selection-change="selectedFiles = $event"
					@row-dblclick="openRow"
				>
					<el-table-column
						type="selection"
						width="48"
						:selectable="(row) => !row.directory"
					/>
					<el-table-column :label="t('files.name')" min-width="260">
						<template #default="{ row }">
							<a
								v-if="row.directory"
								class="file-link"
								@click="navigateTo(row.objectKey)"
							>
								📁 {{ row.name }}
							</a>
							<span v-else>📄 {{ row.name }}</span>
						</template>
					</el-table-column>
					<el-table-column :label="t('files.size')" width="120">
						<template #default="{ row }">{{
							row.directory ? '-' : formatSize(row.size)
						}}</template>
					</el-table-column>
					<el-table-column
						prop="contentType"
						:label="t('files.type')"
						min-width="160"
					/>
					<el-table-column :label="t('files.modified')" width="180">
						<template #default="{ row }">{{
							formatTime(row.lastModified)
						}}</template>
					</el-table-column>
					<el-table-column
						prop="operationStatus"
						:label="t('files.status')"
						width="120"
					/>
					<el-table-column
						:label="t('common.action')"
						width="190"
						fixed="right"
					>
						<template #default="{ row }">
							<template v-if="!row.directory">
								<el-button link type="primary" @click="preview(row)">
									{{ t('files.preview') }}
								</el-button>
								<el-button link type="danger" @click="confirmDelete(row)">
									{{ t('common.delete') }}
								</el-button>
							</template>
						</template>
					</el-table-column>
				</el-table>
			</div>
			<el-pagination
				v-model:current-page="filePage"
				v-model:page-size="filePageSize"
				:page-sizes="[10, 20, 50, 100]"
				:total="fileTotal"
				layout="total, sizes, prev, pager, next"
				@current-change="loadFiles"
				@size-change="resetAndLoadFiles"
			/>
		</section>

		<section v-else class="sync-panel">
			<div class="toolbar">
				<div class="toolbar__group">
					<el-button type="primary" :disabled="scanRunning" @click="startScan">
						{{ t('files.sync.scan') }}
					</el-button>
					<el-button
						v-if="scanRunning"
						type="danger"
						:loading="syncTask?.status === 'CANCEL_REQUESTED'"
						@click="cancelCheck"
					>
						{{ t('files.sync.cancel') }}
					</el-button>
					<el-button :disabled="!diffTaskId" @click="loadDiffs">
						{{ t('common.refresh') }}
					</el-button>
				</div>
				<div class="toolbar__group toolbar__filters">
					<el-select
						v-model="diffType"
						clearable
						:placeholder="t('files.sync.diff.type')"
						@change="resetAndLoadDiffs"
					>
						<el-option
							v-for="item in diffTypeOptions"
							:key="item.value"
							:label="item.value"
							:value="item.value"
						>
							<div class="option-with-help">
								<span>{{ item.value }}</span>
								<el-tooltip :content="item.description" placement="right">
									<el-icon class="help-icon" @click.stop>
										<InfoFilled />
									</el-icon>
								</el-tooltip>
							</div>
						</el-option>
					</el-select>
					<el-select
						v-model="resolutionStatus"
						clearable
						:placeholder="t('files.sync.resolution')"
						@change="resetAndLoadDiffs"
					>
						<el-option
							v-for="status in resolutionStatusOptions"
							:key="status"
							:label="resolutionStatusLabel(status)"
							:value="status"
						/>
					</el-select>
				</div>
			</div>

			<div v-if="syncTask" class="sync-summary">
				<div>
					<strong>{{ syncTask.provider }}</strong> / {{ syncTask.bucket }}
				</div>
				<el-tag :type="taskTagType">{{ syncTask.status }}</el-tag>
				<span>{{ t('files.sync.scanned') }}: {{ syncTask.scannedCount }}</span>
				<span
					v-for="item in diffSummaryOptions"
					:key="item.value"
					class="type-with-help"
				>
					{{ item.value }}: {{ diffTypeCount(item.value) }}
					<el-tooltip :content="item.description" placement="top">
						<el-icon class="help-icon"><InfoFilled /></el-icon>
					</el-tooltip>
				</span>
				<span v-if="syncTask.errorMessage" class="error-text">{{
					syncTask.errorMessage
				}}</span>
			</div>

			<div class="bulk-resolution">
				<el-select
					v-model="bulkAction"
					:disabled="selectedDiffs.length === 0"
					:placeholder="t('files.sync.action')"
				>
					<el-option
						v-for="action in bulkActions"
						:key="action"
						:label="actionLabel(action)"
						:value="action"
					/>
				</el-select>
				<el-button
					type="warning"
					:disabled="!bulkAction || selectedDiffs.length === 0"
					@click="
						confirmResolve(
							selectedDiffs.map((item) => item.id),
							bulkAction
						)
					"
				>
					{{ t('files.sync.execute') }}
				</el-button>
			</div>

			<div class="table-wrap">
				<el-table
					v-loading="diffLoading"
					:data="diffs"
					height="100%"
					@selection-change="selectedDiffs = $event"
				>
					<el-table-column
						type="selection"
						width="48"
						:selectable="
							(row) => ['PENDING', 'FAILED'].includes(row.resolutionStatus)
						"
					/>
					<el-table-column
						prop="objectKey"
						:label="t('files.object.key')"
						min-width="260"
						show-overflow-tooltip
					/>
					<el-table-column :label="t('files.sync.diff.type')" width="220">
						<template #default="{ row }">
							<span class="type-with-help">
								{{ row.diffType }}
								<el-tooltip
									:content="diffTypeDescription(row.diffType)"
									placement="top"
								>
									<el-icon class="help-icon"><InfoFilled /></el-icon>
								</el-tooltip>
							</span>
						</template>
					</el-table-column>
					<el-table-column :label="t('files.sync.resolution')" width="130">
						<template #default="{ row }">
							<el-tag :type="resolutionStatusTagType(row.resolutionStatus)">
								{{ resolutionStatusLabel(row.resolutionStatus) }}
							</el-tag>
						</template>
					</el-table-column>
					<el-table-column :label="t('files.sync.oss.info')" align="center">
						<el-table-column
							:label="t('files.sync.etag')"
							min-width="170"
							show-overflow-tooltip
						>
							<template #default="{ row }">{{ row.ossEtag || '-' }}</template>
						</el-table-column>
						<el-table-column :label="t('files.size')" width="110">
							<template #default="{ row }">{{
								formatSize(row.ossSize)
							}}</template>
						</el-table-column>
						<el-table-column :label="t('files.modified')" width="180">
							<template #default="{ row }">{{
								formatTime(row.ossModifiedAt)
							}}</template>
						</el-table-column>
					</el-table-column>
					<el-table-column :label="t('files.sync.db.info')" align="center">
						<el-table-column
							:label="t('files.sync.etag')"
							min-width="170"
							show-overflow-tooltip
						>
							<template #default="{ row }">{{ row.dbEtag || '-' }}</template>
						</el-table-column>
						<el-table-column :label="t('files.size')" width="110">
							<template #default="{ row }">{{
								formatSize(row.dbSize)
							}}</template>
						</el-table-column>
						<el-table-column :label="t('files.modified')" width="180">
							<template #default="{ row }">{{
								formatTime(row.dbModifiedAt)
							}}</template>
						</el-table-column>
					</el-table-column>
					<el-table-column
						:label="t('common.action')"
						width="280"
						fixed="right"
					>
						<template #default="{ row }">
							<template
								v-if="['PENDING', 'FAILED'].includes(row.resolutionStatus)"
							>
								<el-button
									v-for="action in actionsFor(row.diffType)"
									:key="action"
									link
									:type="action.startsWith('DELETE') ? 'danger' : 'primary'"
									@click="confirmResolve([row.id], action)"
								>
									{{ actionLabel(action) }}
								</el-button>
							</template>
							<span v-else>
								{{
									row.resolutionAction ? actionLabel(row.resolutionAction) : '-'
								}}
							</span>
						</template>
					</el-table-column>
				</el-table>
			</div>
			<el-pagination
				v-model:current-page="diffPage"
				v-model:page-size="diffPageSize"
				:page-sizes="[10, 20, 50, 100]"
				:total="diffTotal"
				layout="total, sizes, prev, pager, next"
				@current-change="loadDiffs"
				@size-change="resetAndLoadDiffs"
			/>
		</section>

		<el-dialog
			v-model="uploadDialogVisible"
			:title="t('files.upload.batch.details')"
			width="720px"
		>
			<div class="upload-dialog-summary">
				<el-progress :percentage="uploadProgress" :stroke-width="10" />
				<span> {{ uploadCompletedCount }}/{{ uploadQueue.length }} </span>
			</div>
			<el-table :data="uploadQueue" max-height="420">
				<el-table-column
					prop="file.name"
					:label="t('files.name')"
					min-width="260"
					show-overflow-tooltip
				/>
				<el-table-column :label="t('files.size')" width="120">
					<template #default="{ row }">
						{{ formatSize(row.file.size) }}
					</template>
				</el-table-column>
				<el-table-column :label="t('files.status')" width="120">
					<template #default="{ row }">
						<el-tag :type="uploadStatusTagType(row.status)">
							{{ t(`files.upload.status.${row.status}`) }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column :label="t('files.upload.progress')" min-width="150">
					<template #default="{ row }">
						<el-progress
							:percentage="row.progress"
							:status="row.status === 'FAILED' ? 'exception' : undefined"
						/>
					</template>
				</el-table-column>
			</el-table>
		</el-dialog>
	</SidebarPageLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
	ElBreadcrumb,
	ElBreadcrumbItem,
	ElButton,
	ElDialog,
	ElIcon,
	ElInput,
	ElMenuItem,
	ElMessage,
	ElMessageBox,
	ElOption,
	ElPagination,
	ElProgress,
	ElSelect,
	ElTable,
	ElTableColumn,
	ElTag,
	ElTooltip
} from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import { t } from '@ai-system/lib'
import SidebarPageLayout from '@/pages/components/SidebarPageLayout.vue'
import type {
	ObjectFileItem,
	ObjectStorageSyncDiff,
	ObjectStorageSyncTask
} from '@/types/file.types'
import {
	cancelObjectStorageDifferenceCheck,
	createObjectStorageScanTask,
	deleteObjectFile,
	deleteObjectFiles,
	getLatestObjectStorageDifferenceCheck,
	getObjectFilePreviewUrl,
	getObjectFiles,
	getObjectStorageScanDiffs,
	getObjectStorageScanTask,
	resolveObjectStorageDiffs,
	uploadObjectFileDirect
} from '@/api/file.api'
import { resolveObjectFilePreviewUrl } from '@/utils/ossDisplayUrl'
import { appendAuthTokenToUrl } from '@/utils/authenticatedUrl'

const activePanel = ref('files')
const files = ref<ObjectFileItem[]>([])
const selectedFiles = ref<ObjectFileItem[]>([])
const currentPrefix = ref('')
const keyword = ref('')
const fileStatus = ref('')
const filePage = ref(1)
const filePageSize = ref(20)
const fileTotal = ref(0)
const fileLoading = ref(false)
const uploading = ref(false)
const uploadDialogVisible = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const uploadQueue = ref<BatchUploadItem[]>([])

type BatchUploadStatus = 'PENDING' | 'UPLOADING' | 'SUCCESS' | 'FAILED'
type BatchUploadItem = {
	file: File
	progress: number
	status: BatchUploadStatus
}

const BATCH_UPLOAD_CONCURRENCY = 3

const uploadProgress = computed(() => {
	const totalBytes = uploadQueue.value.reduce(
		(total, item) => total + item.file.size,
		0
	)
	if (totalBytes === 0) {
		return uploadQueue.value.length
			? Math.round(
					uploadQueue.value.reduce((total, item) => total + item.progress, 0) /
						uploadQueue.value.length
			  )
			: 0
	}
	const uploadedBytes = uploadQueue.value.reduce(
		(total, item) => total + item.file.size * (item.progress / 100),
		0
	)
	return Math.round((uploadedBytes / totalBytes) * 100)
})

const uploadCompletedCount = computed(
	() =>
		uploadQueue.value.filter((item) =>
			['SUCCESS', 'FAILED'].includes(item.status)
		).length
)

const syncTask = ref<ObjectStorageSyncTask | null>(null)
const diffTaskId = ref('')
const diffs = ref<ObjectStorageSyncDiff[]>([])
const selectedDiffs = ref<ObjectStorageSyncDiff[]>([])
const diffType = ref('')
const resolutionStatus = ref('')
const diffPage = ref(1)
const diffPageSize = ref(20)
const diffTotal = ref(0)
const diffLoading = ref(false)
const bulkAction = ref('')
let pollTimer: number | undefined

const resolutionStatusOptions = ['PENDING', 'RESOLVED', 'STALE', 'FAILED']

const diffSummaryOptions = computed(() => [
	{ value: 'IN_SYNC', description: t('files.sync.diff.IN_SYNC.help') },
	{ value: 'OSS_ONLY', description: t('files.sync.diff.OSS_ONLY.help') },
	{ value: 'DB_ONLY', description: t('files.sync.diff.DB_ONLY.help') },
	{
		value: 'METADATA_MISMATCH',
		description: t('files.sync.diff.METADATA_MISMATCH.help')
	},
	{
		value: 'IN_PROGRESS',
		description: t('files.sync.diff.IN_PROGRESS.help')
	}
])

const diffTypeOptions = computed(() =>
	diffSummaryOptions.value.filter((item) => item.value !== 'IN_SYNC')
)

const scanRunning = computed(() =>
	['PENDING', 'RUNNING', 'CANCEL_REQUESTED'].includes(
		syncTask.value?.status || ''
	)
)

const taskTagType = computed(() => {
	if (syncTask.value?.status === 'SUCCESS') return 'success'
	if (syncTask.value?.status === 'FAILED') return 'danger'
	if (syncTask.value?.status === 'CANCELLED') return 'info'
	return 'warning'
})

const breadcrumbParts = computed(() => {
	const parts = currentPrefix.value.split('/').filter(Boolean)
	return parts.map((name, index) => ({
		name,
		prefix: `${parts.slice(0, index + 1).join('/')}/`
	}))
})

const bulkActions = computed(() => {
	if (!selectedDiffs.value.length) return []
	return actionsFor(selectedDiffs.value[0].diffType).filter((action) =>
		selectedDiffs.value.every((item) =>
			actionsFor(item.diffType).includes(action)
		)
	)
})

async function loadFiles() {
	fileLoading.value = true
	try {
		const response = await getObjectFiles({
			prefix: currentPrefix.value,
			keyword: keyword.value || undefined,
			status: fileStatus.value || undefined,
			offset: (filePage.value - 1) * filePageSize.value,
			limit: filePageSize.value
		})
		files.value = response.data.data || []
		fileTotal.value = response.data.total || 0
	} catch {
		ElMessage.error(t('files.load.failed'))
	} finally {
		fileLoading.value = false
	}
}

function resetAndLoadFiles() {
	filePage.value = 1
	loadFiles()
}

function navigateTo(prefix: string) {
	currentPrefix.value = prefix
	resetAndLoadFiles()
}

function openRow(row: ObjectFileItem) {
	if (row.directory) navigateTo(row.objectKey)
}

async function handleFilesSelected(event: Event) {
	const target = event.target as HTMLInputElement
	const selected = Array.from(target.files || [])
	if (!selected.length) return

	const uploadPrefix = currentPrefix.value
	uploadQueue.value = selected.map((file) => ({
		file,
		progress: 0,
		status: 'PENDING'
	}))
	uploading.value = true
	uploadDialogVisible.value = true
	try {
		let nextIndex = 0
		const uploadNext = async () => {
			while (nextIndex < uploadQueue.value.length) {
				const item = uploadQueue.value[nextIndex++]
				item.status = 'UPLOADING'
				try {
					await uploadObjectFileDirect(item.file, uploadPrefix, (percent) => {
						item.progress = percent
					})
					item.progress = 100
					item.status = 'SUCCESS'
				} catch {
					item.progress = 100
					item.status = 'FAILED'
				}
			}
		}
		const workerCount = Math.min(
			BATCH_UPLOAD_CONCURRENCY,
			uploadQueue.value.length
		)
		await Promise.all(Array.from({ length: workerCount }, uploadNext))

		const failedNames = uploadQueue.value
			.filter((item) => item.status === 'FAILED')
			.map((item) => item.file.name)
		const successCount = uploadQueue.value.length - failedNames.length
		if (failedNames.length) {
			ElMessage.warning(
				`${t('files.upload.batch.result')}: ${successCount}/${
					uploadQueue.value.length
				}; ${t('files.upload.batch.failed')}: ${failedNames.join(', ')}`
			)
		} else {
			ElMessage.success(
				`${t('files.upload.batch.success')}: ${uploadQueue.value.length}`
			)
		}
		await loadFiles()
	} finally {
		uploading.value = false
		target.value = ''
	}
}

function uploadStatusTagType(status: BatchUploadStatus) {
	if (status === 'SUCCESS') return 'success'
	if (status === 'FAILED') return 'danger'
	if (status === 'UPLOADING') return 'warning'
	return 'info'
}

async function preview(row: ObjectFileItem) {
	try {
		const response = await getObjectFilePreviewUrl(row.objectKey)
		const url = resolveObjectFilePreviewUrl(row.objectKey, response.data.url)
		window.open(appendAuthTokenToUrl(url), '_blank', 'noopener')
	} catch {
		ElMessage.error(t('files.preview.failed'))
	}
}

async function confirmDelete(row: ObjectFileItem) {
	await ElMessageBox.confirm(
		t('files.delete.confirm'),
		t('common.delete'),
		dangerMessageBoxOptions()
	)
	try {
		await deleteObjectFile(row.objectKey)
		ElMessage.success(t('common.success'))
		await loadFiles()
	} catch {
		ElMessage.error(t('common.fail'))
	}
}

async function confirmBatchDelete() {
	await ElMessageBox.confirm(
		t('files.delete.confirm'),
		t('files.batch.delete'),
		dangerMessageBoxOptions()
	)
	const response = await deleteObjectFiles(
		selectedFiles.value.map((item) => item.objectKey)
	)
	if (response.data.failedIds?.length) {
		ElMessage.warning(
			`${t('common.fail')}: ${response.data.failedIds.join(', ')}`
		)
	} else {
		ElMessage.success(t('common.success'))
	}
	await loadFiles()
}

async function openSyncPanel() {
	activePanel.value = 'sync'
	if (!diffTaskId.value) {
		await loadLatestDifferenceCheck()
	} else {
		loadDiffs()
	}
}

async function startScan() {
	try {
		const response = await createObjectStorageScanTask()
		syncTask.value = response.data
		startPolling()
	} catch {
		ElMessage.error(t('files.sync.start.failed'))
	}
}

async function cancelCheck() {
	if (!syncTask.value || !scanRunning.value) return
	await ElMessageBox.confirm(
		t('files.sync.cancel.confirm'),
		t('files.sync.cancel'),
		dangerMessageBoxOptions()
	)
	try {
		const response = await cancelObjectStorageDifferenceCheck(syncTask.value.id)
		syncTask.value = response.data
		ElMessage.success(t('files.sync.cancel.requested'))
		startPolling()
	} catch {
		ElMessage.error(t('files.sync.cancel.failed'))
	}
}

async function loadLatestDifferenceCheck() {
	try {
		const response = await getLatestObjectStorageDifferenceCheck()
		syncTask.value = response.data
		diffTaskId.value = response.data.id
		await loadDiffs()
	} catch {
		diffs.value = []
		diffTotal.value = 0
	}
}

function startPolling() {
	stopPolling()
	pollTimer = window.setInterval(pollTask, 1500)
	pollTask()
}

async function pollTask() {
	if (!syncTask.value) return
	try {
		const response = await getObjectStorageScanTask(syncTask.value.id)
		syncTask.value = response.data
		if (
			!['PENDING', 'RUNNING', 'CANCEL_REQUESTED'].includes(response.data.status)
		) {
			stopPolling()
			if (response.data.status === 'SUCCESS') {
				diffTaskId.value = response.data.id
				loadDiffs()
			}
		}
	} catch {
		stopPolling()
	}
}

function stopPolling() {
	if (pollTimer) window.clearInterval(pollTimer)
	pollTimer = undefined
}

async function loadDiffs() {
	if (!diffTaskId.value) return
	diffLoading.value = true
	try {
		const response = await getObjectStorageScanDiffs(diffTaskId.value, {
			diffType: diffType.value || undefined,
			resolutionStatus: resolutionStatus.value || undefined,
			offset: (diffPage.value - 1) * diffPageSize.value,
			limit: diffPageSize.value
		})
		diffs.value = response.data.data || []
		diffTotal.value = response.data.total || 0
	} catch {
		ElMessage.error(t('files.sync.load.failed'))
	} finally {
		diffLoading.value = false
	}
}

function resetAndLoadDiffs() {
	diffPage.value = 1
	loadDiffs()
}

function actionsFor(type: ObjectStorageSyncDiff['diffType']) {
	if (type === 'OSS_ONLY') return ['REGISTER_DB', 'DELETE_OSS']
	if (type === 'DB_ONLY') return ['DELETE_DB']
	if (type === 'METADATA_MISMATCH') return ['UPDATE_DB', 'DELETE_BOTH']
	return []
}

function actionLabel(action: string) {
	return t(`files.sync.action.${action}`)
}

function resolutionStatusLabel(status: string) {
	return t(`files.sync.resolution.${status}`)
}

function resolutionStatusTagType(status: string) {
	if (status === 'RESOLVED') return 'success'
	if (status === 'STALE') return 'info'
	if (status === 'FAILED') return 'danger'
	return 'warning'
}

function diffTypeDescription(type: string) {
	return (
		diffTypeOptions.value.find((item) => item.value === type)?.description ||
		type
	)
}

function diffTypeCount(type: string) {
	if (!syncTask.value) return 0
	if (type === 'IN_SYNC') return syncTask.value.inSyncCount
	if (type === 'OSS_ONLY') return syncTask.value.ossOnlyCount
	if (type === 'DB_ONLY') return syncTask.value.dbOnlyCount
	if (type === 'IN_PROGRESS') return syncTask.value.inProgressCount
	return syncTask.value.mismatchCount
}

function dangerMessageBoxOptions() {
	return {
		customClass: 'n-dialog--danger',
		confirmButtonText: t('common.ok'),
		cancelButtonText: t('common.cancel'),
		type: 'warning' as const
	}
}

async function confirmResolve(ids: string[], action: string) {
	const destructive = action.startsWith('DELETE')
	if (destructive) {
		await ElMessageBox.confirm(
			t('files.sync.delete.confirm'),
			actionLabel(action),
			dangerMessageBoxOptions()
		)
	}
	const response = await resolveObjectStorageDiffs(ids, action)
	const failedIds = response.data.failedIds || []
	const failedIdSet = new Set(failedIds)
	const succeededIdSet = new Set(ids.filter((id) => !failedIdSet.has(id)))
	diffs.value = diffs.value
		.map((item) =>
			succeededIdSet.has(item.id)
				? {
						...item,
						resolutionStatus: 'RESOLVED',
						resolutionAction: action,
						resolutionError: undefined
				  }
				: item
		)
		.filter(
			(item) =>
				!resolutionStatus.value ||
				item.resolutionStatus === resolutionStatus.value
		)
	diffTotal.value = Math.max(
		0,
		diffTotal.value -
			ids.filter(
				(id) =>
					succeededIdSet.has(id) &&
					Boolean(resolutionStatus.value) &&
					resolutionStatus.value !== 'RESOLVED'
			).length
	)
	selectedDiffs.value = []
	if (failedIds.length) {
		ElMessage.warning(`${t('common.fail')}: ${failedIds.join(', ')}`)
	} else {
		ElMessage.success(t('common.success'))
	}
	bulkAction.value = ''
	await Promise.all([loadDiffs(), loadFiles()])
}

function formatSize(size?: number) {
	if (size === undefined || size === null) return '-'
	if (size < 1024) return `${size} B`
	const units = ['KB', 'MB', 'GB', 'TB']
	let value = size / 1024
	let unit = 0
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024
		unit++
	}
	return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`
}

function formatTime(value?: number) {
	return value ? new Date(value).toLocaleString() : '-'
}

onMounted(loadFiles)
onUnmounted(stopPolling)
</script>

<style scoped lang="scss">
.files-panel,
.sync-panel {
	display: flex;
	flex-direction: column;
	gap: 14px;
	min-height: 0;
}

.toolbar,
.toolbar__group,
.sync-summary,
.bulk-resolution {
	display: flex;
	align-items: center;
	gap: 10px;
}

.toolbar {
	justify-content: space-between;
	flex-wrap: wrap;
}

.toolbar__filters {
	.el-input {
		width: 240px;
	}

	.el-select {
		width: 180px;
	}
}

.upload-progress {
	width: 180px;
	cursor: pointer;
}

.upload-count {
	padding: 0;
	border: 0;
	background: transparent;
	color: var(--n-color-text-muted);
	cursor: pointer;
	white-space: nowrap;
}

.upload-dialog-summary {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	align-items: center;
	gap: 12px;
	margin-bottom: 16px;
}

.breadcrumbs {
	padding: 10px 12px;
	border-radius: 8px;
	background: var(--n-color-bg-secondary);
}

.file-link {
	cursor: pointer;
	color: var(--el-color-primary);
}

.table-wrap {
	flex: 1;
	min-height: 0;
}

.sync-summary {
	flex-wrap: wrap;
	padding: 12px;
	border-radius: 8px;
	background: var(--n-color-bg-secondary);
}

.bulk-resolution {
	.el-select {
		width: 220px;
	}
}

.error-text {
	color: var(--el-color-danger);
}

.option-with-help,
.type-with-help {
	display: inline-flex;
	align-items: center;
	gap: 6px;
}

.option-with-help {
	justify-content: space-between;
	width: 100%;
}

.help-icon {
	flex-shrink: 0;
	color: var(--n-color-text-muted);
	cursor: help;
}
</style>
