<template>
	<div class="api-key-management">
		<div class="toolbar">
			<el-button type="primary" size="small" @click="openCreate">{{ t('apiKey.create') }}</el-button>
			<el-button size="small" @click="load">{{ t('common.refresh') }}</el-button>
		</div>
		<el-table :data="keys" v-loading="loading" stripe>
			<el-table-column prop="keyName" :label="t('apiKey.name')" />
			<el-table-column prop="username" :label="t('apiKey.username')" />
			<el-table-column prop="maskedKey" :label="t('apiKey.key')" min-width="210" />
			<el-table-column :label="t('user.management.role')" width="180">
				<template #default="{ row }"><el-select v-model="row.role" size="small" @change="saveRole(row)"><el-option v-for="item in roles" :key="item.value" :label="item.label" :value="item.value" /></el-select></template>
			</el-table-column>
			<el-table-column :label="t('apiKey.lastUsedTime')" width="180"><template #default="{ row }">{{ formatTime(row.lastUsedTime) }}</template></el-table-column>
			<el-table-column :label="t('common.action')" width="110"><template #default="{ row }"><el-button type="danger" size="small" @click="remove(row)">{{ t('common.delete') }}</el-button></template></el-table-column>
		</el-table>

		<el-dialog
			v-model="createVisible"
			:title="t('apiKey.create')"
			top="10vh"
			draggable
			append-to-body
		>
			<el-form class="api-key-create-form" :model="form" label-width="90px" autocomplete="off">
				<el-form-item :label="t('apiKey.name')"><el-input v-model="form.keyName" autocomplete="off" /></el-form-item>
				<el-form-item :label="t('apiKey.username')"><el-input v-model="form.username" autocomplete="off" /></el-form-item>
				<el-form-item :label="t('user.management.role')"><el-select v-model="form.role"><el-option v-for="item in roles" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item>
			</el-form>
			<template #footer><el-button @click="createVisible = false">{{ t('common.cancel') }}</el-button><el-button type="primary" :loading="saving" @click="create">{{ t('common.ok') }}</el-button></template>
		</el-dialog>

		<el-dialog v-model="resultVisible" :title="t('apiKey.created.title')" append-to-body :close-on-click-modal="false">
			<div class="api-key-result">
				<p class="api-key-result__hint">{{ t('apiKey.created.once') }}</p>
				<div class="api-key-result__key">
					<el-input :model-value="createdKey" readonly />
					<el-button @click="copyKey">{{ t('apiKey.copy') }}</el-button>
				</div>
				<section class="api-key-result__test">
					<p class="websocket-test-title">{{ t('apiKey.websocketTest') }}</p>
					<el-input
						:model-value="websocketTestCommand"
						type="textarea"
						:rows="10"
						readonly
					/>
					<div class="websocket-test-actions">
						<el-button @click="copyWebsocketTest">
							{{ t('apiKey.websocketTest.copy') }}
						</el-button>
					</div>
				</section>
			</div>
			<template #footer><el-button type="primary" @click="resultVisible = false">{{ t('common.ok') }}</el-button></template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElButton, ElDialog, ElForm, ElFormItem, ElInput, ElMessage, ElMessageBox, ElOption, ElSelect, ElTable, ElTableColumn } from 'element-plus'
import { t } from '@ai-system/lib'
import { createApiKey, deleteApiKey, getApiKeys, updateApiKeyRole, type ApiKeyDto } from '@/api/apiKey.api'
import { ROLE_ADMIN, ROLE_KB_ADMIN, ROLE_USER } from '@/utils/role'
import { extractApiErrorMessage } from '@/utils/apiError'

const keys = ref<ApiKeyDto[]>([]); const loading = ref(false); const saving = ref(false)
const createVisible = ref(false); const resultVisible = ref(false); const createdKey = ref(''); const contextId = ref('')
const form = ref({ keyName: '', username: '', role: ROLE_USER })
const roles = computed(() => [{ value: ROLE_ADMIN, label: t('user.management.role.admin') }, { value: ROLE_KB_ADMIN, label: t('user.management.role.kbAdmin') }, { value: ROLE_USER, label: t('user.management.role.user') }])
const websocketTestCommand = computed(() => [
	`BASE_URL='${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}'`,
	`API_KEY='${createdKey.value}'`,
	`CONTEXT_ID='${contextId.value}'`,
	"CONTENT='Hello'",
	'',
	'npx --yes wscat -w 120 \\',
	'  -c "${BASE_URL}/ws/rest/j2agent/chat?context-id=${CONTEXT_ID}&agent-id=universal_assistant&authorization=${API_KEY}" \\',
	'  -x "{\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"${CONTENT}\\"}],\\"retrievalKb\\":true,\\"systemPrompt\\":\\"GENERAL_ASSISTANT\\"}"'
].join('\n'))
const load = async () => { loading.value = true; try { const res = await getApiKeys(); keys.value = res.data?.data ?? res.data ?? [] } catch { ElMessage.error(t('apiKey.load.failed')) } finally { loading.value = false } }
const openCreate = () => { form.value = { keyName: '', username: '', role: ROLE_USER }; createVisible.value = true }
const create = async () => { if (!form.value.keyName || !form.value.username) return ElMessage.error(t('common.input.required')); saving.value = true; try { const res = await createApiKey(form.value); createdKey.value = res.data?.data?.apiKey ?? res.data?.apiKey ?? ''; contextId.value = crypto.randomUUID(); createVisible.value = false; resultVisible.value = true; await load() } catch (error) { ElMessage.error(extractApiErrorMessage(error, t('apiKey.create.failed'))) } finally { saving.value = false } }
const saveRole = async (row: ApiKeyDto) => { try { await updateApiKeyRole(row.id, row.role); ElMessage.success(t('common.success')) } catch { ElMessage.error(t('apiKey.role.failed')); await load() } }
const remove = async (row: ApiKeyDto) => { try { await ElMessageBox.confirm(t('apiKey.delete.confirm'), t('common.delete'), { type: 'warning', confirmButtonText: t('common.ok'), cancelButtonText: t('common.cancel') }); await deleteApiKey(row.id); ElMessage.success(t('common.delete.success')); await load() } catch (e) { if (e !== 'cancel') ElMessage.error(t('apiKey.delete.failed')) } }
const copyText = async (value: string) => {
	if (navigator.clipboard?.writeText && window.isSecureContext) {
		await navigator.clipboard.writeText(value)
		return
	}
	const textarea = document.createElement('textarea')
	textarea.value = value
	textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'
	document.body.appendChild(textarea)
	textarea.select()
	const copied = document.execCommand('copy')
	document.body.removeChild(textarea)
	if (!copied) throw new Error('copy failed')
}
const copyKey = async () => { try { await copyText(createdKey.value); ElMessage.success(t('apiKey.copy.success')) } catch { ElMessage.error(t('apiKey.copy.failed')) } }
const copyWebsocketTest = async () => { try { await copyText(websocketTestCommand.value); ElMessage.success(t('apiKey.websocketTest.copy.success')) } catch { ElMessage.error(t('apiKey.copy.failed')) } }
const formatTime = (value?: number) => value ? new Date(value).toLocaleString() : t('apiKey.neverUsed')
onMounted(load)
</script>

<style scoped lang="scss">
.toolbar { display:flex; gap:8px; margin-bottom:12px; }
.api-key-create-form { padding-bottom: 116px; }
.api-key-result { display: flex; flex-direction: column; gap: 14px; }
.api-key-result__hint { margin: 0; line-height: 1.5; }
.api-key-result__key { display: flex; align-items: center; gap: 8px; }
.api-key-result__key .el-input { min-width: 0; }
.api-key-result__test { display: flex; flex-direction: column; gap: 8px; }
.websocket-test-title { margin: 0; font-weight: 600; }
.websocket-test-actions { display: flex; justify-content: flex-end; }

</style>
