<template>
	<div class="repository-page">
		<div class="header-actions">
			<div class="toolbar-primary">
				<el-button type="primary" :icon="Plus" @click="openCreateDialog">
					新增远程知识库
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
				<el-table-column label="类型" width="110" align="center">
					<template #default="{ row }">
						<el-tag size="small" :type="row.type === 'LOCAL_FILE' ? 'info' : 'success'">
							{{ typeLabel(row.type) }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column label="URL / 路径" min-width="260" show-overflow-tooltip>
					<template #default="{ row }">
						{{ row.remoteUrl || row.localPath || '-' }}
					</template>
				</el-table-column>
				<el-table-column label="状态" width="110" align="center">
					<template #default="{ row }">
						<el-tag size="small" :type="statusTagType(row.status)">
							{{ statusLabel(row.status) }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column label="协议" width="90" align="center">
					<template #default="{ row }">
						{{ row.protocol || '-' }}
					</template>
				</el-table-column>
				<el-table-column label="知识库名称" min-width="120" show-overflow-tooltip>
					<template #default="{ row }">
						{{ row.displayName || '-' }}
					</template>
				</el-table-column>
				<el-table-column label="目录名" min-width="150" prop="repoCode" show-overflow-tooltip />
				<el-table-column label="Collection" min-width="170" show-overflow-tooltip>
					<template #default="{ row }">
						{{ collectionText(row) }}
					</template>
				</el-table-column>
				<el-table-column label="分支" width="120" show-overflow-tooltip>
					<template #default="{ row }">
						{{ row.defaultBranch || '-' }}
					</template>
				</el-table-column>
				<el-table-column label="周期" width="100" align="center">
					<template #default="{ row }">
						<span v-if="row.updateIntervalMinutes">{{ row.updateIntervalMinutes }} 分钟</span>
						<span v-else>-</span>
					</template>
				</el-table-column>
				<el-table-column label="启用" width="90" align="center">
					<template #default="{ row }">
						<el-tag size="small" :type="row.enabled ? 'success' : 'info'">
							{{ row.enabled ? '启用' : '停用' }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column label="最近同步" width="180" align="center">
					<template #default="{ row }">
						{{ formatDateTime(row.lastSyncTime) || '-' }}
					</template>
				</el-table-column>
				<el-table-column label="最新 Revision" width="140" show-overflow-tooltip>
					<template #default="{ row }">
						{{ shortRevision(row.lastRevision) }}
					</template>
				</el-table-column>
				<el-table-column label="操作" width="260" fixed="right">
					<template #default="{ row }">
						<el-button link type="primary" :icon="View" @click="openDetail(row)">
							详情
						</el-button>
						<el-button
							link
							type="primary"
							:icon="Refresh"
							:disabled="row.readonly || row.status === 'SYNCING'"
							@click="handleSync(row)"
						>
							更新
						</el-button>
						<el-button
							link
							type="primary"
							:icon="Edit"
							:disabled="row.readonly"
							@click="openEditDialog(row)"
						>
							编辑
						</el-button>
						<el-button
							link
							type="danger"
							:icon="Delete"
							:disabled="row.readonly || row.status === 'SYNCING'"
							@click="handleDelete(row)"
						>
							删除
						</el-button>
					</template>
				</el-table-column>
				<template #empty>
					<span class="table-empty-hint">暂无知识库仓库</span>
				</template>
			</el-table>
		</div>

		<el-dialog
			v-model="dialogVisible"
			:title="editingId ? '编辑 Git 远程配置' : '新增 Git 知识库'"
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
				<el-form-item label="协议" required>
					<el-select v-model="form.protocol" disabled class="form-control">
						<el-option label="Git" value="GIT" />
					</el-select>
				</el-form-item>
				<el-form-item label="知识库名称">
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
				<el-form-item label="知识库目录名">
					<el-input
						v-model="form.repoCode"
						:disabled="!!editingId"
						maxlength="128"
						autocomplete="off"
						placeholder="为空时使用 Git 仓库名"
					/>
				</el-form-item>
				<el-form-item label="URL" required>
					<el-input v-model="form.remoteUrl" maxlength="2048" autocomplete="off" />
				</el-form-item>
				<el-form-item label="分支名">
					<el-input
						v-model="form.defaultBranch"
						maxlength="256"
						autocomplete="off"
						placeholder="默认分支"
					/>
				</el-form-item>
				<el-form-item label="用户名">
					<el-input v-model="form.username" autocomplete="username" />
				</el-form-item>
				<el-form-item label="密码 / Token">
					<el-input
						v-model="form.password"
						type="password"
						show-password
						autocomplete="new-password"
						:placeholder="editingId ? '留空表示不修改' : ''"
					/>
				</el-form-item>
				<el-form-item label="更新周期" required>
					<el-input-number
						v-model="form.updateIntervalMinutes"
						:min="1"
						:max="10080"
						controls-position="right"
					/>
					<span class="unit-text">分钟</span>
				</el-form-item>
				<el-form-item label="启用">
					<el-switch v-model="form.enabled" />
				</el-form-item>
			</el-form>
			<template #footer>
				<div class="dialog-footer">
					<el-button @click="dialogVisible = false">取消</el-button>
					<el-button type="primary" :loading="submitting" @click="submitForm">保存</el-button>
				</div>
			</template>
		</el-dialog>

		<el-drawer
			v-model="detailVisible"
			title="知识库仓库详情"
			size="520px"
			append-to-body
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
							停用
						</el-tag>
					</div>
				</header>

				<section class="detail-section">
					<div class="section-heading">连接信息</div>
					<div class="detail-kv">
						<div class="detail-row">
							<span class="field-label">协议</span>
							<span class="field-value">{{ detail.protocol || '-' }}</span>
						</div>
						<div class="detail-row">
							<span class="field-label">分支</span>
							<span class="field-value">{{ detail.defaultBranch || '远端默认分支' }}</span>
						</div>
						<div class="detail-row">
							<span class="field-label">更新周期</span>
							<span class="field-value">{{ detail.updateIntervalMinutes ? `${detail.updateIntervalMinutes} 分钟` : '-' }}</span>
						</div>
						<div class="detail-row">
							<span class="field-label">凭据</span>
							<span class="field-value">{{ detail.hasCredential ? '已配置' : '未配置' }}</span>
						</div>
						<div class="detail-row">
							<span class="field-label">知识库名称</span>
							<span class="field-value">{{ detail.displayName || '-' }}</span>
						</div>
					</div>
					<div class="detail-path-list">
						<div class="detail-path-row">
							<span class="field-label">远程地址</span>
							<span class="code-value">{{ detail.remoteUrl || '-' }}</span>
						</div>
						<div class="detail-path-row">
							<span class="field-label">本地路径</span>
							<span class="code-value">{{ detail.localPath || '-' }}</span>
						</div>
					</div>
				</section>

				<section class="detail-section">
					<div class="section-heading">info.json 信息</div>
					<div class="detail-kv">
						<div class="detail-row">
							<span class="field-label">Collection</span>
							<span class="field-value">{{ collectionText(detail) }}</span>
						</div>
						<div class="detail-row">
							<span class="field-label">最小标题级别</span>
							<span class="field-value">{{ detail.minHeadingLevel ?? '-' }}</span>
						</div>
						<div class="detail-row">
							<span class="field-label">文件名作为标题</span>
							<span class="field-value">{{ detail.filenameAsTitle ? '是' : '否' }}</span>
						</div>
					</div>
				</section>

				<section class="detail-section">
					<div class="section-heading">版本信息</div>
					<div class="detail-path-list">
						<div class="detail-path-row">
							<span class="field-label">最新 Revision</span>
							<span class="code-value">{{ detail.lastRevision || '-' }}</span>
						</div>
						<div class="detail-path-row">
							<span class="field-label">Commit Message</span>
							<span class="message-value">{{ detail.lastRevisionMessage || '-' }}</span>
						</div>
					</div>
					<div class="detail-kv">
						<div class="detail-row">
							<span class="field-label">提交人</span>
							<span class="field-value">{{ detail.lastRevisionAuthor || '-' }}</span>
						</div>
						<div class="detail-row">
							<span class="field-label">提交时间</span>
							<span class="field-value">{{ formatDateTime(detail.lastRevisionTime) || '-' }}</span>
						</div>
						<div class="detail-row">
							<span class="field-label">最近同步</span>
							<span class="field-value">{{ formatDateTime(detail.lastSyncTime) || '-' }}</span>
						</div>
					</div>
				</section>

				<section v-if="detail.lastError" class="detail-section error-section">
					<div class="section-heading">错误信息</div>
					<div class="error-value">{{ detail.lastError }}</div>
				</section>
			</div>
		</el-drawer>
	</div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
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
	protocol: 'GIT'
	repoCode: string
	remoteUrl: string
	defaultBranch: string
	username: string
	password: string
	updateIntervalMinutes: number
	enabled: boolean
	collections: string[]
	displayName: string
	collectionAliases: Record<string, string>
}

const loading = ref(false)
const submitting = ref(false)
const repositories = ref<KnowledgeRepositoryDto[]>([])
const dialogVisible = ref(false)
const detailVisible = ref(false)
const editingId = ref('')
const detail = ref<KnowledgeRepositoryDto | null>(null)

const form = reactive<FormState>({
	protocol: 'GIT',
	repoCode: '',
	remoteUrl: '',
	defaultBranch: '',
	username: '',
	password: '',
	updateIntervalMinutes: 60,
	enabled: true,
	collections: [],
	displayName: '',
	collectionAliases: {}
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
		ElMessage.error('加载知识库仓库失败')
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
	form.repoCode = row.repoCode || ''
	form.remoteUrl = row.remoteUrl || ''
	form.defaultBranch = row.defaultBranch || ''
	form.username = ''
	form.password = ''
	form.updateIntervalMinutes = row.updateIntervalMinutes || 60
	form.enabled = row.enabled !== false
	form.collections = [...(row.collections || [])]
	form.displayName = row.displayName || ''
	form.collectionAliases = { ...(row.collectionAliases || {}) }
	dialogVisible.value = true
}

const resetForm = () => {
	editingId.value = ''
	form.protocol = 'GIT'
	form.repoCode = ''
	form.remoteUrl = ''
	form.defaultBranch = ''
	form.username = ''
	form.password = ''
	form.updateIntervalMinutes = 60
	form.enabled = true
	form.collections = []
	form.displayName = ''
	form.collectionAliases = {}
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
		ElMessage.success('保存成功')
		dialogVisible.value = false
		await loadRepositories()
	} catch (error: any) {
		ElMessage.error(error?.response?.data?.message || '保存失败')
	} finally {
		submitting.value = false
	}
}

const buildPayload = (): KnowledgeRepositoryUpsertDto | null => {
	if (!form.remoteUrl.trim()) {
		ElMessage.warning('请填写必填字段')
		return null
	}
	if (form.repoCode.trim() && !/^[A-Za-z0-9][A-Za-z0-9_-]{1,127}$/.test(form.repoCode.trim())) {
		ElMessage.warning('目录名只能包含字母、数字、下划线和中划线，且至少 2 位')
		return null
	}
	const payload: KnowledgeRepositoryUpsertDto = {
		protocol: 'GIT',
		repoCode: form.repoCode.trim() || undefined,
		remoteUrl: form.remoteUrl.trim(),
		defaultBranch: form.defaultBranch.trim() || undefined,
		updateIntervalMinutes: form.updateIntervalMinutes || 60,
		enabled: form.enabled,
		protocolConfig: {},
		displayName: form.displayName.trim() || undefined,
		collectionAliases: normalizeCollectionAliases(form.collectionAliases, form.collections)
	}
	if (form.username.trim() || form.password.trim()) {
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

const handleSync = async (row: KnowledgeRepositoryDto) => {
	if (!row.id || row.readonly) {
		return
	}
	try {
		const res = await syncKnowledgeRepository(row.id)
		if (res.data?.success) {
			ElMessage.success(res.data.message || '已提交同步')
		} else {
			ElMessage.error(res.data?.message || '同步失败')
		}
		await loadRepositories()
	} catch (error: any) {
		ElMessage.error(error?.response?.data?.message || '同步失败')
		await loadRepositories()
	}
}

const handleDelete = async (row: KnowledgeRepositoryDto) => {
	if (!row.id || row.readonly) {
		return
	}
	await ElMessageBox.confirm(`确认删除知识库仓库「${row.repoCode}」的远程配置和本地目录？`, '删除确认', {
		type: 'warning',
		confirmButtonText: '删除',
		cancelButtonText: '取消'
	})
	await deleteKnowledgeRepository(row.id)
	ElMessage.success('删除成功')
	await loadRepositories()
}

const shortRevision = (revision?: string) => {
	return revision ? revision.slice(0, 12) : '-'
}

const collectionText = (repository: KnowledgeRepositoryDto) => {
	return (repository.collections || [])
		.map((collection) => collectionDisplayName(repository, collection))
		.join(', ') || '-'
}

const collectionDisplayName = (repository: KnowledgeRepositoryDto, collection: string) => {
	const alias = repository.type === 'REMOTE'
		? repository.collectionAliases?.[collection]?.trim() || repository.displayName?.trim()
		: ''
	return alias ? `${alias} (${collection})` : collection
}

const normalizeCollectionAliases = (
	aliases: Record<string, string>,
	collections: string[]
) => {
	const next: Record<string, string> = {}
	for (const collection of collections) {
		const alias = aliases[collection]?.trim()
		if (collection && alias) {
			next[collection] = alias
		}
	}
	return next
}

const typeLabel = (type?: KnowledgeRepositoryType) => {
	return type === 'LOCAL_FILE' ? '文件' : '远程'
}

const statusLabel = (status?: KnowledgeRepositoryStatus) => {
	switch (status) {
		case 'SYNCING':
			return '同步中'
		case 'SYNCED':
			return '已同步'
		case 'FAILED':
			return '失败'
		case 'DIRECTORY_MISSING':
			return '目录缺失'
		default:
			return '空闲'
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

onMounted(loadRepositories)
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

.unit-text {
	margin-left: 8px;
	color: var(--n-color-text-muted);
}

.error-text {
	color: var(--el-color-danger);
	word-break: break-word;
}

:global(.repository-detail-drawer.el-drawer) {
	background: var(--n-color-bg-glass-overlay);
	backdrop-filter: blur(var(--n-glass-blur-4)) saturate(var(--n-glass-saturate));
	-webkit-backdrop-filter: blur(var(--n-glass-blur-4)) saturate(var(--n-glass-saturate));
	box-shadow: var(--n-shadow-elevation-4);
	color: var(--n-color-text-primary);
}

:global(.repository-detail-drawer .el-drawer__header) {
	height: 56px;
	margin: 0;
	padding: 0 24px;
	border-bottom: 1px solid var(--n-color-border-soft);
	color: var(--n-color-text-primary);
	font-size: 16px;
	font-weight: 600;
}

:global(.repository-detail-drawer .el-drawer__body) {
	padding: 0;
	overflow: hidden;
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
	border: 1px solid var(--n-color-border-soft);
	border-radius: var(--n-radius-basic, 6px);
	background: color-mix(in srgb, var(--n-color-bg-glass-weak) 82%, transparent);
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
