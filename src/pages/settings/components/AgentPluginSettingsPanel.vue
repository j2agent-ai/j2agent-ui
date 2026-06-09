<template>
	<div class="agent-plugin-panel" v-loading="loading">
		<el-form label-width="160px">
			<el-form-item :label="t('settings.agentPlugin.upload')">
				<div class="upload-block">
					<el-upload
						ref="uploadRef"
						:auto-upload="false"
						:multiple="false"
						:on-change="handleFileChange"
						:on-remove="handleFileRemove"
						:on-exceed="handleExceed"
						:file-list="fileList"
						accept=".tar.gz,.tgz"
						:limit="1"
						drag
					>
						<el-icon class="el-icon--upload">
							<upload />
						</el-icon>
						<div class="el-upload__text">
							<em>{{ t('settings.agentPlugin.upload.hint') }}</em>
						</div>
					</el-upload>
					<div v-if="selectedFile" class="selected-file">
						{{ t('common.selected.file') }}: {{ selectedFile.name }}
					</div>
					<el-button
						type="primary"
						class="install-btn"
						:disabled="!selectedFile"
						:loading="installing"
						@click="handleInstall(false)"
					>
						{{ t('settings.agentPlugin.install') }}
					</el-button>
				</div>
			</el-form-item>
			<el-form-item :label="t('settings.agentPlugin.packages')">
				<el-table :data="packageRows" border size="small" class="package-table" empty-text="-">
					<el-table-column prop="agentDir" :label="t('settings.agentPlugin.agentDir')" />
					<el-table-column :label="t('settings.agentPlugin.agentIds')">
						<template #default="{ row }">
							<el-tag v-for="id in row.agentIds" :key="id" size="small" class="agent-tag">
								{{ id }}
							</el-tag>
							<span v-if="!row.agentIds?.length">-</span>
						</template>
					</el-table-column>
					<el-table-column :label="t('settings.agentPlugin.status')" width="120">
						<template #default="{ row }">
							<el-tag :type="row.loaded ? 'success' : 'info'" size="small">
								{{
									row.loaded
										? t('settings.agentPlugin.status.loaded')
										: t('settings.agentPlugin.status.notLoaded')
								}}
							</el-tag>
						</template>
					</el-table-column>
					<el-table-column :label="t('common.action')" width="100" align="center">
						<template #default="{ row }">
							<el-button
								type="danger"
								link
								:loading="deletingDir === row.agentDir"
								@click="handleDelete(row.agentDir)"
							>
								{{ t('common.delete') }}
							</el-button>
						</template>
					</el-table-column>
				</el-table>
			</el-form-item>
			<el-form-item :label="t('settings.agentPlugin.loadedAgents')">
				<el-tag v-for="id in status.loadedAgentIds" :key="id" class="agent-tag">
					{{ id }}
				</el-tag>
				<span v-if="!status.loadedAgentIds?.length" class="empty-text">-</span>
			</el-form-item>
		</el-form>
		<div class="settings-actions">
			<el-button type="primary" :loading="reloading" @click="handleReload">
				{{ t('settings.agentPlugin.reload') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
	ElButton,
	ElForm,
	ElFormItem,
	ElIcon,
	ElMessage,
	ElMessageBox,
	ElTable,
	ElTableColumn,
	ElTag,
	ElUpload,
	genFileId,
	type UploadFile,
	type UploadFiles,
	type UploadInstance,
	type UploadProps,
	type UploadRawFile
} from 'element-plus'
import { Upload } from '@element-plus/icons-vue'
import { t } from '@ai-system/lib'
import {
	deleteAgentPackage,
	getAgentPlugins,
	installAgentPackage,
	reloadAgentPlugins
} from '@/api/ai.api'
import type { AgentInstallResult, AgentPluginStatus, AgentReloadResult } from '@/types/ai.types'

const loading = ref(false)
const reloading = ref(false)
const installing = ref(false)
const deletingDir = ref<string | null>(null)
const selectedFile = ref<File | null>(null)
const fileList = ref<UploadFile[]>([])
const uploadRef = ref<UploadInstance>()
const status = ref<AgentPluginStatus>({
	jarFiles: [],
	loadedAgentIds: [],
	packages: []
})

const packageRows = computed(() => {
	if (status.value.packages?.length) {
		return status.value.packages
	}
	return (status.value.jarFiles ?? []).map((label) => ({
		agentDir: label,
		jarName: label,
		agentIds: [],
		loaded: false
	}))
})

const loadStatus = async () => {
	loading.value = true
	try {
		const res = await getAgentPlugins()
		status.value = res.data ?? { jarFiles: [], loadedAgentIds: [], packages: [] }
	} catch {
		ElMessage.error(t('settings.agentPlugin.load.failed'))
	} finally {
		loading.value = false
	}
}

const handleReload = async () => {
	reloading.value = true
	try {
		const res = await reloadAgentPlugins()
		const result: AgentReloadResult = res.data ?? { success: false }
		if (result.success) {
			ElMessage.success(t('settings.agentPlugin.reload.success'))
			await loadStatus()
		} else {
			ElMessage.error(result.message || t('settings.agentPlugin.reload.failed'))
		}
	} catch (err: unknown) {
		const data = (err as { response?: { data?: AgentReloadResult } })?.response?.data
		ElMessage.error(data?.message || t('settings.agentPlugin.reload.failed'))
	} finally {
		reloading.value = false
	}
}

const handleFileChange = (file: UploadFile, files: UploadFiles) => {
	fileList.value = files.length > 1 ? [file] : files
	selectedFile.value = file.raw || null
}

const handleExceed: UploadProps['onExceed'] = (files) => {
	uploadRef.value!.clearFiles()
	const file = files[0] as UploadRawFile
	file.uid = genFileId()
	uploadRef.value!.handleStart(file)
}

const handleFileRemove = () => {
	selectedFile.value = null
	fileList.value = []
}

const clearUploadForm = () => {
	selectedFile.value = null
	fileList.value = []
	uploadRef.value?.clearFiles()
}

const handleInstall = async (replace: boolean) => {
	if (!selectedFile.value) {
		ElMessage.warning(t('settings.agentPlugin.upload.required'))
		return
	}
	installing.value = true
	try {
		const res = await installAgentPackage(selectedFile.value, replace)
		const result: AgentInstallResult = res.data ?? { success: false }
		if (result.conflict && !replace) {
			const ids = (result.conflictingAgentIds ?? result.incomingAgentIds ?? []).join(', ')
			try {
				await ElMessageBox.confirm(
					t('settings.agentPlugin.replace.confirm', {
						ids,
						dir: result.existingAgentDir ?? ''
					}),
					t('settings.agentPlugin.replace.title'),
					{
						type: 'warning',
						confirmButtonText: t('settings.agentPlugin.replace.ok'),
						cancelButtonText: t('common.cancel')
					}
				)
				await handleInstall(true)
			} catch {
				// user cancelled
			}
			return
		}
		if (result.success) {
			ElMessage.success(t('settings.agentPlugin.install.success'))
			clearUploadForm()
			await loadStatus()
			return
		}
		ElMessage.error(result.message || t('settings.agentPlugin.install.failed'))
	} catch (err: unknown) {
		const data = (err as { response?: { data?: AgentInstallResult } })?.response?.data
		ElMessage.error(data?.message || t('settings.agentPlugin.install.failed'))
	} finally {
		installing.value = false
	}
}

const handleDelete = async (agentDir?: string) => {
	if (!agentDir) {
		return
	}
	try {
		await ElMessageBox.confirm(
			t('settings.agentPlugin.delete.confirm', { dir: agentDir }),
			t('settings.agentPlugin.delete.title'),
			{
				type: 'warning',
				confirmButtonText: t('common.delete'),
				cancelButtonText: t('common.cancel')
			}
		)
	} catch {
		return
	}
	deletingDir.value = agentDir
	try {
		const res = await deleteAgentPackage(agentDir)
		const result: AgentReloadResult = res.data ?? { success: false }
		if (result.success) {
			ElMessage.success(t('settings.agentPlugin.delete.success'))
			await loadStatus()
		} else {
			ElMessage.error(result.message || t('settings.agentPlugin.delete.failed'))
		}
	} catch (err: unknown) {
		const data = (err as { response?: { data?: AgentReloadResult } })?.response?.data
		ElMessage.error(data?.message || t('settings.agentPlugin.delete.failed'))
	} finally {
		deletingDir.value = null
	}
}

onMounted(() => {
	loadStatus()
})
</script>

<style scoped lang="scss">
.agent-plugin-panel {
	max-width: 900px;
}

.upload-block {
	width: 100%;
}

.selected-file {
	margin-top: 8px;
	font-size: 14px;
	color: var(--el-text-color-secondary);
}

.install-btn {
	margin-top: 12px;
}

.package-table {
	width: 100%;
}

.agent-tag {
	margin-right: 8px;
	margin-bottom: 4px;
}

.empty-text {
	font-size: 14px;
}

.settings-actions {
	margin-top: 16px;
}
</style>
