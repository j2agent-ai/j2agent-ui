<template>
	<div class="model-config-list">
		<div class="header-bar">
			<div class="hint">
				<slot name="hint">{{ defaultHint }}</slot>
			</div>
			<el-button type="primary" :icon="Plus" @click="openCreate">
				{{ t('providerConfig.action.create') }}
			</el-button>
		</div>

		<el-table v-loading="loading" :data="rows" class="model-config-table" stripe>
			<el-table-column :label="t('providerConfig.col.name')" prop="configName" />
			<el-table-column :label="t('providerConfig.col.provider')" prop="providerType">
				<template #default="{ row }">{{ providerLabel(row.providerType) }}</template>
			</el-table-column>
			<el-table-column :label="t('providerConfig.col.model')" width="220">
				<template #default="{ row }">{{ row.config?.modelName ?? '-' }}</template>
			</el-table-column>
			<el-table-column :label="t('providerConfig.col.enabled')" width="100">
				<template #default="{ row }">
					<el-tag v-if="row.enabled" type="success">{{ t('providerConfig.tag.enabled') }}</el-tag>
					<el-tag v-else type="info">{{ t('providerConfig.tag.disabled') }}</el-tag>
				</template>
			</el-table-column>
			<el-table-column :label="t('providerConfig.col.current')" width="120">
				<template #default="{ row }">
					<el-tag v-if="row.isCurrent" type="warning">{{ t('providerConfig.tag.current') }}</el-tag>
					<span v-else>-</span>
				</template>
			</el-table-column>
			<el-table-column :label="t('providerConfig.col.actions')" width="260" fixed="right">
				<template #default="{ row }">
					<el-button
						v-if="!row.isCurrent"
						type="primary"
						link
						:disabled="!row.enabled"
						@click="onActivate(row)"
					>
						{{ t('providerConfig.action.activate') }}
					</el-button>
					<el-button type="primary" link @click="openEdit(row)">
						{{ t('providerConfig.action.edit') }}
					</el-button>
					<el-button type="danger" link :disabled="row.isCurrent" @click="onDelete(row)">
						{{ t('providerConfig.action.delete') }}
					</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog
			v-model="dialogVisible"
			:title="dialogTitle"
			width="640px"
			:close-on-click-modal="false"
			draggable
			append-to-body
		>
			<ProviderConfigForm
				ref="formRef"
				:api-type="apiType"
				:mode="dialogMode"
				:source="editing"
			/>
			<template #footer>
				<el-button @click="dialogVisible = false">
					{{ t('providerConfig.action.cancel') }}
				</el-button>
				<el-button type="primary" :loading="saving" @click="onSubmit">
					{{ t('providerConfig.action.save') }}
				</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
	ElButton,
	ElDialog,
	ElMessage,
	ElMessageBox,
	ElTable,
	ElTableColumn,
	ElTag
} from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { t } from '@ai-system/lib'
import ProviderConfigForm from './ProviderConfigForm.vue'
import {
	activateProviderConfig,
	createProviderConfig,
	deleteProviderConfig,
	listProviderConfigs,
	updateProviderConfig,
	type ProviderApiType,
	type ProviderConfigDto
} from '@/api/provider-config.api'

const props = defineProps<{
	apiType: ProviderApiType
	defaultHint?: string
	rebuildOnEmbeddingActivate?: boolean
}>()

const rows = ref<ProviderConfigDto[]>([])
const loading = ref(false)
const saving = ref(false)

const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editing = ref<ProviderConfigDto | null>(null)
const formRef = ref<InstanceType<typeof ProviderConfigForm> | null>(null)

const dialogTitle = computed(() =>
	dialogMode.value === 'create'
		? t('providerConfig.dialog.create')
		: t('providerConfig.dialog.edit')
)

const providerLabel = (raw: string) => {
	switch (raw) {
		case 'open-ai':
			return t('providerConfig.provider.openai')
		case 'vllm':
			return t('providerConfig.provider.vllm')
		case 'anthropic':
			return t('providerConfig.provider.anthropic')
		case 'ollama':
			return t('providerConfig.provider.ollama')
		default:
			return raw
	}
}

const fetchList = async () => {
	loading.value = true
	try {
		const res = await listProviderConfigs(props.apiType)
		rows.value = (res?.data as any)?.data ?? res?.data ?? []
	} catch (e) {
		ElMessage.error(t('providerConfig.load.failed'))
	} finally {
		loading.value = false
	}
}

const openCreate = () => {
	dialogMode.value = 'create'
	editing.value = null
	dialogVisible.value = true
}

const openEdit = (row: ProviderConfigDto) => {
	dialogMode.value = 'edit'
	editing.value = row
	dialogVisible.value = true
}

// 切换 Embedding 时提示用户知识库需要重建
const confirmEmbeddingRebuild = async () => {
	await ElMessageBox.confirm(
		t('settings.embedding.rebuild.confirm'),
		t('settings.embedding.rebuild.title'),
		{
			confirmButtonText: t('settings.embedding.rebuild.confirm.ok'),
			cancelButtonText: t('settings.embedding.rebuild.confirm.cancel'),
			type: 'warning'
		}
	)
}

const onActivate = async (row: ProviderConfigDto) => {
	try {
		if (props.rebuildOnEmbeddingActivate) {
			await confirmEmbeddingRebuild()
		}
		await activateProviderConfig(row.id)
		ElMessage.success(t('providerConfig.activate.success'))
		await fetchList()
	} catch (e) {
		if (e !== 'cancel') {
			ElMessage.error(t('providerConfig.activate.failed'))
		}
	}
}

const onDelete = async (row: ProviderConfigDto) => {
	try {
		await ElMessageBox.confirm(
			t('providerConfig.delete.confirm', { name: row.configName }),
			t('providerConfig.delete.title'),
			{ type: 'warning' }
		)
		await deleteProviderConfig(row.id)
		ElMessage.success(t('providerConfig.delete.success'))
		await fetchList()
	} catch (e) {
		if (e !== 'cancel') {
			ElMessage.error(t('providerConfig.delete.failed'))
		}
	}
}

/** 保存前清洗 config：无效 contextLength 不写入；非 Anthropic 剔除 maxTokens */
const normalizeProviderConfig = (config: Record<string, any>, providerType: string) => {
	const copy: Record<string, any> = { ...config }
	const ctx = copy.contextLength
	if (ctx == null || ctx === '' || (typeof ctx === 'number' && ctx <= 0)) {
		delete copy.contextLength
	}
	if (providerType !== 'anthropic') {
		const maxTok = copy.maxTokens
		if (maxTok == null || maxTok === '' || (typeof maxTok === 'number' && maxTok <= 0)) {
			delete copy.maxTokens
		}
	}
	if (providerType !== 'anthropic' && providerType !== 'ollama') {
		delete copy.thinkingMode
		delete copy.thinkingBudgetTokens
	} else {
		const raw = copy.thinkingMode
		let mode = typeof raw === 'string' ? raw.trim().toLowerCase() : 'provider_default'
		if (mode === 'auto') {
			mode = 'provider_default'
		}
		if (mode !== 'on' && mode !== 'off') {
			mode = 'provider_default'
		}
		if (mode === 'provider_default') {
			delete copy.thinkingMode
		} else {
			copy.thinkingMode = mode
		}
		if (mode !== 'on') {
			delete copy.thinkingBudgetTokens
		} else {
			const budget = copy.thinkingBudgetTokens
			if (budget == null || budget === '' || (typeof budget === 'number' && budget <= 0)) {
				delete copy.thinkingBudgetTokens
			}
		}
	}
	delete copy.useRag
	delete copy.useTools
	delete copy.useMcpTools
	delete copy.chatMemoryDualRead
	return copy
}

const onSubmit = async () => {
	const value = formRef.value?.getValue()
	if (!value) {
		return
	}
	if (!value.configName) {
		ElMessage.warning(t('providerConfig.validate.configName'))
		return
	}
	if (!value.config?.modelName) {
		ElMessage.warning(t('providerConfig.validate.modelName'))
		return
	}
	const cleanedConfig = normalizeProviderConfig(value.config, value.providerType)
	saving.value = true
	try {
		if (dialogMode.value === 'create') {
			await createProviderConfig({
				apiType: props.apiType,
				configName: value.configName,
				providerType: value.providerType,
				config: cleanedConfig,
				description: value.description,
				enabled: value.enabled,
				makeCurrent: value.makeCurrent
			})
			ElMessage.success(t('providerConfig.create.success'))
		} else if (editing.value) {
			await updateProviderConfig(editing.value.id, {
				configName: value.configName,
				providerType: value.providerType,
				config: cleanedConfig,
				description: value.description,
				enabled: value.enabled
			})
			ElMessage.success(t('providerConfig.update.success'))
		}
		dialogVisible.value = false
		await fetchList()
	} catch (e) {
		ElMessage.error(t('providerConfig.save.failed'))
	} finally {
		saving.value = false
	}
}

onMounted(fetchList)

defineExpose({ refresh: fetchList })
</script>

<style scoped lang="scss">
.model-config-list {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.header-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.hint {
	font-size: 13px;
	line-height: 1.5;
}
</style>
