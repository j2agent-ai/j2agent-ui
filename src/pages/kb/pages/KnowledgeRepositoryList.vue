<template>
	<div class="repository-page">
		<div class="header-actions">
			<div class="toolbar-primary">
				<el-button type="primary" :icon="Plus" @click="openCreateDialog">
					{{ t('kb.repository.addRemote') }}
				</el-button>
				<el-button :icon="Refresh" :loading="loading" @click="loadRepositories">
					{{ t('common.refresh') }}
				</el-button>
			</div>
		</div>

		<div class="table-wrapper">
			<el-table
				:data="repositories"
				class="repository-table"
				style="width: 100%; height: 100%"
				v-loading="loading"
				stripe
			>
				<el-table-column :label="t('kb.repository.type')" width="110" align="center">
					<template #default="{ row }">
						<el-tag size="small" :type="row.type === 'LOCAL_FILE' ? 'info' : 'success'">
							{{ typeLabel(row.type) }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column :label="t('kb.repository.urlOrPath')" min-width="260" show-overflow-tooltip>
					<template #default="{ row }">
						{{ row.remoteUrl || row.localPath || '-' }}
					</template>
				</el-table-column>
				<el-table-column :label="t('kb.repository.status')" width="110" align="center">
					<template #default="{ row }">
						<el-tag size="small" :type="statusTagType(row.status)">
							{{ statusLabel(row.status) }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column :label="t('kb.repository.protocol')" width="90" align="center">
					<template #default="{ row }">
						{{ row.protocol || '-' }}
					</template>
				</el-table-column>
				<el-table-column :label="t('kb.repository.displayName')" min-width="120" show-overflow-tooltip>
					<template #default="{ row }">
						{{ row.displayName || '--' }}
					</template>
				</el-table-column>
				<el-table-column :label="t('kb.repository.repoCode')" min-width="150" prop="repoCode" show-overflow-tooltip />
				<el-table-column label="Collection" min-width="170" show-overflow-tooltip>
					<template #default="{ row }">
						{{ collectionText(row) }}
					</template>
				</el-table-column>
				<el-table-column :label="t('kb.repository.branch')" width="120" show-overflow-tooltip>
					<template #default="{ row }">
						{{ row.defaultBranch || '-' }}
					</template>
				</el-table-column>
				<el-table-column :label="t('kb.repository.interval')" width="100" align="center">
					<template #default="{ row }">
						<span v-if="row.updateIntervalMinutes">{{ formatMinutes(row.updateIntervalMinutes) }}</span>
						<span v-else>-</span>
					</template>
				</el-table-column>
				<el-table-column :label="t('kb.repository.enabled')" width="90" align="center">
					<template #default="{ row }">
						<el-tag size="small" :type="row.enabled ? 'success' : 'info'">
							{{ row.enabled ? t('common.enabled') : t('common.disabled') }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column :label="t('kb.repository.lastSync')" width="180" align="center">
					<template #default="{ row }">
						{{ formatDateTime(row.lastSyncTime) || '-' }}
					</template>
				</el-table-column>
				<el-table-column :label="t('kb.repository.lastRevision')" width="140" show-overflow-tooltip>
					<template #default="{ row }">
						{{ shortRevision(row.lastRevision) }}
					</template>
				</el-table-column>
				<el-table-column :label="t('common.action')" width="260" fixed="right">
					<template #default="{ row }">
						<el-button link type="primary" :icon="View" @click="openDetail(row)">
							{{ t('common.detail') }}
						</el-button>
						<el-button
							link
							type="primary"
							:icon="Refresh"
							:disabled="row.readonly || row.status === 'SYNCING'"
							@click="handleSync(row)"
						>
							{{ t('common.update') }}
						</el-button>
						<el-button
							link
							type="primary"
							:icon="Edit"
							:disabled="row.readonly"
							@click="openEditDialog(row)"
						>
							{{ t('common.edit') }}
						</el-button>
						<el-button
							link
							type="danger"
							:icon="Delete"
							:disabled="row.readonly || row.status === 'SYNCING'"
							@click="handleDelete(row)"
						>
							{{ t('common.delete') }}
						</el-button>
					</template>
				</el-table-column>
				<template #empty>
					<span class="table-empty-hint">{{ t('kb.repository.empty') }}</span>
				</template>
			</el-table>
		</div>

		<el-dialog
			v-model="dialogVisible"
			:title="editingId ? t('kb.repository.dialog.edit') : t('kb.repository.dialog.create')"
			width="620px"
			align-center
			append-to-body
			draggable
			destroy-on-close
			:close-on-click-modal="false"
			@closed="resetForm"
		>
			<el-form label-width="120px" autocomplete="off" @submit.prevent="submitForm">
				<input type="text" class="autofill-trap" tabindex="-1" autocomplete="username" aria-hidden="true" />
				<input type="password" class="autofill-trap" tabindex="-1" autocomplete="current-password" aria-hidden="true" />
				<el-form-item :label="t('kb.repository.type')" required>
					<el-select v-model="form.type" :disabled="!!editingId" class="form-control">
						<el-option :label="t('kb.repository.type.remote')" value="REMOTE" />
						<el-option :label="t('kb.repository.type.localFile')" value="LOCAL_FILE" />
					</el-select>
				</el-form-item>
				<el-form-item v-if="form.type === 'REMOTE'" :label="t('kb.repository.protocol')" required>
					<el-select v-model="form.protocol" disabled class="form-control">
						<el-option label="Git" value="GIT" />
					</el-select>
				</el-form-item>
				<el-form-item :label="t('kb.repository.displayName')">
					<el-input
						v-model="form.displayName"
						maxlength="64"
						clearable
						autocomplete="off"
						:input-attrs="{
							autocomplete: 'off',
							spellcheck: 'false',
							autocorrect: 'off',
							autocapitalize: 'off'
						}"
					/>
				</el-form-item>
				<el-form-item :label="t('kb.repository.repoCode.full')">
					<el-input
						v-model="form.repoCode"
						:disabled="!!editingId"
						maxlength="128"
						autocomplete="off"
						:placeholder="t('kb.repository.repoCode.placeholder')"
					/>
				</el-form-item>
				<el-form-item v-if="form.type === 'REMOTE'" label="URL" required>
					<el-input v-model="form.remoteUrl" maxlength="2048" autocomplete="off" />
				</el-form-item>
				<el-form-item v-if="form.type === 'REMOTE'" :label="t('kb.repository.branchName')">
					<el-input
						v-model="form.defaultBranch"
						maxlength="256"
						autocomplete="off"
						:placeholder="t('kb.repository.branch.placeholder')"
					/>
				</el-form-item>
				<el-form-item v-if="form.type === 'REMOTE'" :label="t('kb.repository.username')">
					<el-input v-model="form.username" autocomplete="username" />
				</el-form-item>
				<el-form-item v-if="form.type === 'REMOTE'" :label="t('kb.repository.passwordToken')">
					<el-input
						v-model="form.password"
						type="password"
						show-password
						autocomplete="new-password"
						:placeholder="editingId ? t('kb.repository.password.placeholder.edit') : ''"
					/>
				</el-form-item>
				<el-form-item :label="t('kb.repository.updateInterval')" required>
					<el-input-number
						v-model="form.updateIntervalMinutes"
						:min="1"
						:max="10080"
						controls-position="right"
					/>
					<span class="unit-text">{{ t('kb.repository.minutes.unit') }}</span>
				</el-form-item>
				<el-form-item :label="t('kb.repository.enabled')">
					<el-switch v-model="form.enabled" />
				</el-form-item>
				<div class="form-section-title">{{ t('kb.repository.detail.advancedConfig') }}</div>
				<el-form-item label="Collection" required>
					<el-input
						v-model="form.collectionName"
						maxlength="128"
						autocomplete="off"
						placeholder="kb_{目录名}"
					/>
				</el-form-item>
				<el-form-item :label="t('kb.repository.partitionNames')">
					<el-input
						v-model="form.partitionNamesInput"
						maxlength="2048"
						autocomplete="off"
						:placeholder="t('kb.repository.partitionNames.placeholder')"
					/>
				</el-form-item>
				<el-form-item :label="t('kb.repository.minHeadingLevel')" required>
					<el-input-number
						v-model="form.minHeadingLevel"
						:min="1"
						:max="3"
						controls-position="right"
					/>
				</el-form-item>
				<el-form-item :label="t('kb.repository.filenameAsTitle')">
					<el-switch v-model="form.filenameAsTitle" />
				</el-form-item>
			</el-form>
			<template #footer>
				<div class="dialog-footer">
					<el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
					<el-button type="primary" :loading="submitting" @click="submitForm">
						{{ t('common.save') }}
					</el-button>
				</div>
			</template>
		</el-dialog>

		<el-drawer
			v-model="detailVisible"
			:title="t('kb.repository.detail.title')"
			size="520px"
			append-to-body
			destroy-on-close
			:modal="false"
			class="repository-detail-drawer"
		>
			<div v-if="detail" class="detail-panel">
				<header class="detail-summary">
					<div class="summary-main">
						<div class="summary-title">{{ detail.repoCode || '-' }}</div>
						<div class="summary-subtitle">{{ detail.localPath || '-' }}</div>
					</div>
					<div class="summary-tags">
						<el-tag size="small" :type="detail.type === 'LOCAL_FILE' ? 'info' : 'success'">
							{{ typeLabel(detail.type) }}
						</el-tag>
						<el-tag size="small" :type="statusTagType(detail.status)">
							{{ statusLabel(detail.status) }}
						</el-tag>
						<el-tag v-if="detail.enabled === false" size="small" type="info">
							{{ t('common.disabled') }}
						</el-tag>
					</div>
				</header>

				<section class="detail-section">
					<div class="section-heading">{{ t('kb.repository.detail.connection') }}</div>
					<div class="detail-kv">
						<div class="detail-row">
							<span class="field-label">{{ t('kb.repository.protocol') }}</span>
							<span class="field-value">{{ detail.protocol || '-' }}</span>
						</div>
						<div class="detail-row">
							<span class="field-label">{{ t('kb.repository.branch') }}</span>
							<span class="field-value">{{ detail.defaultBranch || t('kb.repository.branch.remoteDefault') }}</span>
						</div>
						<div class="detail-row">
							<span class="field-label">{{ t('kb.repository.updateInterval') }}</span>
							<span class="field-value">{{ detail.updateIntervalMinutes ? formatMinutes(detail.updateIntervalMinutes) : '-' }}</span>
						</div>
						<div class="detail-row">
							<span class="field-label">{{ t('kb.repository.credential') }}</span>
							<span class="field-value">{{ detail.hasCredential ? t('kb.repository.credential.configured') : t('kb.repository.credential.notConfigured') }}</span>
						</div>
						<div class="detail-row">
							<span class="field-label">{{ t('kb.repository.displayName') }}</span>
							<span class="field-value">{{ detail.displayName || '--' }}</span>
						</div>
					</div>
					<div class="detail-path-list">
						<div class="detail-path-row">
							<span class="field-label">{{ t('kb.repository.remoteUrl') }}</span>
							<span class="code-value">{{ detail.remoteUrl || '-' }}</span>
						</div>
						<div class="detail-path-row">
							<span class="field-label">{{ t('kb.repository.localPath') }}</span>
							<span class="code-value">{{ detail.localPath || '-' }}</span>
						</div>
					</div>
				</section>

				<section class="detail-section">
					<div class="section-heading">{{ t('kb.repository.detail.version') }}</div>
					<div class="detail-path-list">
						<div class="detail-path-row">
							<span class="field-label">{{ t('kb.repository.lastRevision') }}</span>
							<span class="code-value">{{ detail.lastRevision || '-' }}</span>
						</div>
						<div class="detail-path-row">
							<span class="field-label">Commit Message</span>
							<span class="message-value">{{ detail.lastRevisionMessage || '-' }}</span>
						</div>
					</div>
					<div class="detail-kv">
						<div class="detail-row">
							<span class="field-label">{{ t('kb.repository.revisionAuthor') }}</span>
							<span class="field-value">{{ detail.lastRevisionAuthor || '-' }}</span>
						</div>
						<div class="detail-row">
							<span class="field-label">{{ t('kb.repository.revisionTime') }}</span>
							<span class="field-value">{{ formatDateTime(detail.lastRevisionTime) || '-' }}</span>
						</div>
						<div class="detail-row">
							<span class="field-label">{{ t('kb.repository.lastSync') }}</span>
							<span class="field-value">{{ formatDateTime(detail.lastSyncTime) || '-' }}</span>
						</div>
					</div>
				</section>

				<section v-if="detail.lastError" class="detail-section error-section">
					<div class="section-heading">{{ t('kb.repository.error') }}</div>
					<div class="error-value">{{ detail.lastError }}</div>
				</section>

				<section class="detail-section">
					<div class="section-heading">{{ t('kb.repository.detail.advancedConfigInfo') }}</div>
					<div class="detail-kv">
						<div class="detail-row">
							<span class="field-label">Collection</span>
							<span class="field-value">{{ collectionText(detail) }}</span>
						</div>
						<div class="detail-row">
							<span class="field-label">{{ t('kb.repository.partitionNames') }}</span>
							<span class="field-value">{{ (detail.partitionNames || []).join(', ') || '-' }}</span>
						</div>
						<div class="detail-row">
							<span class="field-label">{{ t('kb.repository.minHeadingLevel') }}</span>
							<span class="field-value">{{ detail.minHeadingLevel ?? '-' }}</span>
						</div>
						<div class="detail-row">
							<span class="field-label">{{ t('kb.repository.filenameAsTitle') }}</span>
							<span class="field-value">{{ detail.filenameAsTitle ? t('common.yes') : t('common.no') }}</span>
						</div>
					</div>
				</section>
			</div>
		</el-drawer>
	</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
	ElButton,
	ElDialog,
	ElDrawer,
	ElForm,
	ElFormItem,
	ElInput,
	ElInputNumber,
	ElMessage,
	ElMessageBox,
	ElOption,
	ElSelect,
	ElSwitch,
	ElTable,
	ElTableColumn,
	ElTag
} from 'element-plus'
import { Delete, Edit, Plus, Refresh, View } from '@element-plus/icons-vue'
import { formatDateTime, t } from '@ai-system/lib'
import {
	createKnowledgeRepository,
	deleteKnowledgeRepository,
	getKnowledgeRepository,
	getKnowledgeRepositories,
	syncKnowledgeRepository,
	updateKnowledgeRepository
} from '@/api/kb/kb.api'
import type {
	KnowledgeRepositoryDto,
	KnowledgeRepositoryStatus,
	KnowledgeRepositoryType,
	KnowledgeRepositoryUpsertDto
} from '@/types/kb.model'

type FormState = {
	type: KnowledgeRepositoryType
	protocol: 'GIT'
	repoCode: string
	remoteUrl: string
	defaultBranch: string
	username: string
	password: string
	updateIntervalMinutes: number
	enabled: boolean
	displayName: string
	collectionName: string
	partitionNamesInput: string
	minHeadingLevel: number
	filenameAsTitle: boolean
}

const loading = ref(false)
const submitting = ref(false)
const repositories = ref<KnowledgeRepositoryDto[]>([])
const dialogVisible = ref(false)
const detailVisible = ref(false)
const editingId = ref('')
const detail = ref<KnowledgeRepositoryDto | null>(null)

const form = reactive<FormState>({
	type: 'REMOTE',
	protocol: 'GIT',
	repoCode: '',
	remoteUrl: '',
	defaultBranch: '',
	username: '',
	password: '',
	updateIntervalMinutes: 60,
	enabled: true,
	displayName: '',
	collectionName: '',
	partitionNamesInput: '',
	minHeadingLevel: 3,
	filenameAsTitle: true
})

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const unwrapList = (res: unknown): KnowledgeRepositoryDto[] => {
	return (res as { data?: { data?: KnowledgeRepositoryDto[] } })?.data?.data ?? []
}

const loadRepositories = async () => {
	loading.value = true
	try {
		const res = await getKnowledgeRepositories()
		repositories.value = unwrapList(res)
	} catch (error) {
		console.error('Failed to load knowledge repositories:', error)
		ElMessage.error(t('kb.repository.load.failed'))
	} finally {
		loading.value = false
	}
}

const openCreateDialog = () => {
	resetForm()
	dialogVisible.value = true
}

const openEditDialog = (row: KnowledgeRepositoryDto) => {
	editingId.value = row.id || ''
	form.type = row.type || 'REMOTE'
	form.repoCode = row.repoCode || ''
	form.remoteUrl = row.remoteUrl || ''
	form.defaultBranch = row.defaultBranch || ''
	form.username = ''
	form.password = ''
	form.updateIntervalMinutes = row.updateIntervalMinutes || 60
	form.enabled = row.enabled !== false
	form.displayName = row.displayName || ''
	form.collectionName = row.collectionName || row.collections?.[0] || ''
	form.partitionNamesInput = (row.partitionNames || []).join(', ')
	form.minHeadingLevel = row.minHeadingLevel || 3
	form.filenameAsTitle = row.filenameAsTitle !== false
	dialogVisible.value = true
}

const resetForm = () => {
	editingId.value = ''
	form.type = 'REMOTE'
	form.protocol = 'GIT'
	form.repoCode = ''
	form.remoteUrl = ''
	form.defaultBranch = ''
	form.username = ''
	form.password = ''
	form.updateIntervalMinutes = 60
	form.enabled = true
	form.displayName = ''
	form.collectionName = ''
	form.partitionNamesInput = ''
	form.minHeadingLevel = 3
	form.filenameAsTitle = true
}

const submitForm = async () => {
	const payload = buildPayload()
	if (!payload) {
		return
	}
	submitting.value = true
	try {
		if (editingId.value) {
			await updateKnowledgeRepository(editingId.value, payload)
		} else {
			await createKnowledgeRepository(payload)
			await sleep(1000)
		}
		ElMessage.success(t('common.save.success'))
		dialogVisible.value = false
		await loadRepositories()
	} catch (error: any) {
		ElMessage.error(error?.response?.data?.message || t('common.save.failed'))
	} finally {
		submitting.value = false
	}
}

const buildPayload = (): KnowledgeRepositoryUpsertDto | null => {
	if (form.type === 'REMOTE' && !form.remoteUrl.trim()) {
		ElMessage.warning(t('common.required.fields'))
		return null
	}
	if (!editingId.value && form.type === 'LOCAL_FILE' && !form.repoCode.trim()) {
		ElMessage.warning(t('common.required.fields'))
		return null
	}
	const repoCode = form.repoCode.trim()
	if (repoCode && (repoCode.length > 128 || repoCode === '.' || repoCode === '..' || /[\\/]/.test(repoCode))) {
		ElMessage.warning(t('kb.repository.repoCode.invalid'))
		return null
	}
	if (form.collectionName.trim() && !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(form.collectionName.trim())) {
		ElMessage.warning(t('kb.repository.collectionName.invalid'))
		return null
	}
	if (form.minHeadingLevel < 1 || form.minHeadingLevel > 3) {
		ElMessage.warning(t('kb.repository.minHeadingLevel.invalid'))
		return null
	}
	const partitionNames = parsePartitionNames(form.partitionNamesInput)
	if (!partitionNames) {
		ElMessage.warning(t('kb.repository.partitionNames.invalid'))
		return null
	}
	const payload: KnowledgeRepositoryUpsertDto = {
		type: form.type,
		protocol: 'GIT',
		repoCode: form.repoCode.trim() || undefined,
		remoteUrl: form.type === 'REMOTE' ? form.remoteUrl.trim() : undefined,
		defaultBranch: form.type === 'REMOTE' ? form.defaultBranch.trim() || undefined : undefined,
		updateIntervalMinutes: form.updateIntervalMinutes || 60,
		enabled: form.enabled,
		protocolConfig: {},
		displayName: form.displayName.trim() || undefined,
		collectionName: form.collectionName.trim() || undefined,
		partitionNames,
		minHeadingLevel: form.minHeadingLevel,
		filenameAsTitle: form.filenameAsTitle
	}
	if (form.type === 'REMOTE' && (form.username.trim() || form.password.trim())) {
		payload.credentialConfig = {
			username: form.username.trim(),
			password: form.password
		}
	}
	return payload
}

const openDetail = async (row: KnowledgeRepositoryDto) => {
	if (!row.id) {
		return
	}
	detailVisible.value = true
	try {
		const res = await getKnowledgeRepository(row.id)
		detail.value = res.data ?? row
	} catch (error) {
		console.error('Failed to load repository detail:', error)
		detail.value = row
	}
}

const handleDetailOutsidePointerDown = (event: PointerEvent) => {
	if (!detailVisible.value) {
		return
	}
	const target = event.target as HTMLElement | null
	if (!target?.closest('.repository-detail-drawer')) {
		detailVisible.value = false
	}
}

const handleSync = async (row: KnowledgeRepositoryDto) => {
	if (!row.id || row.readonly) {
		return
	}
	try {
		const res = await syncKnowledgeRepository(row.id)
		if (res.data?.success) {
			ElMessage.success(res.data.message || t('kb.repository.sync.queued'))
		} else {
			ElMessage.error(res.data?.message || t('kb.repository.sync.failed'))
		}
		await loadRepositories()
	} catch (error: any) {
		ElMessage.error(error?.response?.data?.message || t('kb.repository.sync.failed'))
		await loadRepositories()
	}
}

const handleDelete = async (row: KnowledgeRepositoryDto) => {
	if (!row.id || row.readonly) {
		return
	}
	await ElMessageBox.confirm(
		t('kb.repository.delete.confirm', { repoCode: row.repoCode || '-' }),
		t('kb.repository.delete.title'),
		{
			type: 'warning',
			confirmButtonText: t('common.delete'),
			cancelButtonText: t('common.cancel')
		}
	)
	await deleteKnowledgeRepository(row.id)
	ElMessage.success(t('common.delete.success'))
	await loadRepositories()
}

const shortRevision = (revision?: string) => {
	return revision ? revision.slice(0, 12) : '-'
}

const collectionText = (repository: KnowledgeRepositoryDto) => {
	return repository.collectionName || repository.collections?.[0] || '-'
}

/** 格式化更新周期（分钟）文案 */
const formatMinutes = (minutes: number) => {
	return t('kb.repository.minutes', { minutes })
}

const parsePartitionNames = (value: string): string[] | null => {
	const raw = value
		.split(/[,，\n]/)
		.map((item) => item.trim())
		.filter(Boolean)
	const names = Array.from(new Set(raw))
	if (names.some((name) => !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(name))) {
		return null
	}
	return names
}

const typeLabel = (type?: KnowledgeRepositoryType) => {
	return type === 'LOCAL_FILE'
		? t('kb.repository.type.localFile')
		: t('kb.repository.type.remote')
}

const statusLabel = (status?: KnowledgeRepositoryStatus) => {
	switch (status) {
		case 'SYNCING':
			return t('kb.repository.status.SYNCING')
		case 'SYNCED':
			return t('kb.repository.status.SYNCED')
		case 'FAILED':
			return t('kb.repository.status.FAILED')
		case 'DIRECTORY_MISSING':
			return t('kb.repository.status.DIRECTORY_MISSING')
		default:
			return t('kb.repository.status.IDLE')
	}
}

const statusTagType = (status?: KnowledgeRepositoryStatus) => {
	switch (status) {
		case 'SYNCING':
			return 'warning'
		case 'SYNCED':
			return 'success'
		case 'FAILED':
			return 'danger'
		case 'DIRECTORY_MISSING':
			return 'danger'
		default:
			return 'info'
	}
}

onMounted(() => {
	loadRepositories()
	document.addEventListener('pointerdown', handleDetailOutsidePointerDown, true)
})

onBeforeUnmount(() => {
	document.removeEventListener('pointerdown', handleDetailOutsidePointerDown, true)
})
</script>

<style scoped lang="scss">
@use '@/styles/platform' as *;

.repository-page {
	font-family: Arial, sans-serif;
	height: 100%;
	min-width: 0;
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
	@include n-data-table-panel;

	.header-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-bottom: 12px;
		margin-bottom: 12px;
		border-bottom: 1px solid var(--n-color-border-soft);
		flex-shrink: 0;
	}

	.toolbar-primary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.dialog-footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
}

.form-control {
	width: 100%;
}

.form-section-title {
	margin: 18px 0 12px;
	padding-top: 14px;
	border-top: 1px solid var(--n-color-border-soft);
	font-size: 13px;
	font-weight: 600;
	color: var(--n-color-text-primary);
}

.unit-text {
	margin-left: 8px;
	color: var(--n-color-text-muted);
}

.error-text {
	color: var(--el-color-danger);
	word-break: break-word;
}

:global(.repository-detail-drawer.el-drawer) {
	@include n-glass-surface(2);
	background: var(--n-color-bg-glass) !important;
	background-color: var(--n-color-bg-glass) !important;
	--el-drawer-bg-color: var(--n-color-bg-glass);
	border-left: 1px solid var(--n-color-border-soft);
	border-radius: var(--n-dialog-border-radius) 0 0 var(--n-dialog-border-radius);
	box-shadow: var(--n-shadow-elevation-4) !important;
	overflow: hidden;
	color: var(--n-color-text-primary) !important;
}

:global(.repository-detail-drawer .el-drawer__header) {
	flex-shrink: 0;
	min-height: 56px;
	margin: 0;
	padding: 16px 20px 12px;
	display: flex;
	align-items: center;
	background: transparent;
	border-bottom: 1px solid var(--n-color-border-soft);
}

:global(.repository-detail-drawer .el-drawer__title) {
	color: var(--n-color-text-primary);
	font-size: 16px;
	font-weight: bolder;
}

:global(.repository-detail-drawer .el-drawer__close) {
	color: color-mix(in srgb, var(--n-color-text-primary), transparent 50%);
	text-shadow: var(--el-color-primary-light-3);
}

:global(.repository-detail-drawer .el-drawer__body) {
	padding: 0;
	overflow: hidden;
	background: transparent;
}

.detail-panel {
	height: 100%;
	display: flex;
	flex-direction: column;
	overflow-y: auto;
	padding: 20px 24px 24px;
	color: var(--n-color-text-primary);
	scrollbar-width: thin;
}

.detail-summary {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 16px;
	padding-bottom: 18px;
	border-bottom: 1px solid var(--n-color-border-soft);
}

.summary-main {
	min-width: 0;
}

.summary-title {
	font-size: 20px;
	font-weight: 700;
	line-height: 1.35;
	color: var(--n-color-text-primary);
	word-break: break-word;
}

.summary-subtitle {
	margin-top: 6px;
	max-width: 100%;
	font-size: 12px;
	line-height: 1.55;
	color: var(--n-color-text-muted);
	word-break: break-all;
}

.summary-tags {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: 6px;
	flex: 0 0 auto;
	max-width: 184px;
	padding-top: 2px;
}

.detail-section {
	padding: 18px 0;
	border-bottom: 1px solid var(--n-color-border-soft);
}

.section-heading {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 12px;
	font-size: 14px;
	font-weight: 700;
	line-height: 1.3;
	color: var(--n-color-text-primary);
}

.section-heading::before {
	content: '';
	width: 3px;
	height: 14px;
	border-radius: 2px;
	background: var(--el-color-primary);
}

.detail-kv {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
	column-gap: 20px;
	row-gap: 0;
}

.detail-row {
	display: grid;
	grid-template-columns: 86px minmax(0, 1fr);
	align-items: baseline;
	min-width: 0;
	padding: 9px 0;
	border-bottom: 1px solid color-mix(in srgb, var(--n-color-border-soft) 70%, transparent);
}

.detail-row:nth-last-child(-n + 2) {
	border-bottom-color: transparent;
}

.field-label {
	display: block;
	min-width: 0;
	font-size: 12px;
	line-height: 1.45;
	color: var(--n-color-text-muted);
}

.field-value {
	display: block;
	min-width: 0;
	font-size: 13px;
	line-height: 1.55;
	color: var(--n-color-text-primary);
	word-break: break-word;
}

.detail-path-list {
	display: flex;
	flex-direction: column;
	gap: 10px;
	margin-top: 12px;
}

.detail-path-row {
	min-width: 0;
}

.detail-path-row .field-label {
	margin-bottom: 6px;
}

.code-value,
.message-value,
.error-value {
	display: block;
	min-width: 0;
	padding: 9px 10px;
	@include n-glass-surface(1);
	background: var(--n-color-bg-glass-weak) !important;
	border-radius: calc(var(--n-dialog-border-radius) - 8px);
	font-size: 12px;
	line-height: 1.6;
	color: var(--n-color-text-primary);
	word-break: break-all;
	white-space: pre-wrap;
}

.code-value {
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
}

.message-value {
	word-break: break-word;
}

.error-section {
	border-bottom: 0;
}

.error-value {
	color: var(--el-color-danger);
	background: color-mix(in srgb, var(--el-color-danger-light-9) 76%, transparent);
	border-color: var(--el-color-danger-light-7);
}

.autofill-trap {
	position: absolute;
	left: -9999px;
	width: 1px;
	height: 1px;
	opacity: 0;
}

@media (max-width: 640px) {
	:global(.repository-detail-drawer.el-drawer) {
		width: min(100vw, 520px) !important;
	}

	.detail-summary {
		flex-direction: column;
	}

	.summary-tags {
		justify-content: flex-start;
		max-width: none;
	}

	.detail-kv {
		grid-template-columns: 1fr;
	}

	.detail-row:nth-last-child(-n + 2) {
		border-bottom-color: color-mix(in srgb, var(--n-color-border-soft) 70%, transparent);
	}

	.detail-row:last-child {
		border-bottom-color: transparent;
	}
}
</style>
