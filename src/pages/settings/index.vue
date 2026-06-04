<template>
	<div class="settings-page">
		<top-bar />
		<div class="settings-content" v-loading="loading">
			<el-tabs v-model="activeTab" class="settings-tabs">
				<el-tab-pane :label="t('settings.llm.section')" name="llm">
					<!-- 仅激活 Tab 时挂载面板组件，避免进入设置页就预打接口 -->
					<LlmSettingsPanel v-if="activeTab === 'llm'" />
				</el-tab-pane>
				<el-tab-pane :label="t('settings.embedding.section')" name="embedding">
					<!-- 仅激活 Tab 时挂载面板组件，避免进入设置页就预打接口 -->
					<EmbeddingSettingsPanel v-if="activeTab === 'embedding'" />
				</el-tab-pane>
				<el-tab-pane :label="t('settings.rag.section')" name="rag">
					<RagSettingsPanel
						v-if="activeTab === 'rag'"
						:form="ragForm"
						:saving="saving"
						@save="saveSettings"
					/>
				</el-tab-pane>
				<el-tab-pane :label="t('settings.agentPlugin.section')" name="agent-plugin">
					<AgentPluginSettingsPanel v-if="activeTab === 'agent-plugin'" />
				</el-tab-pane>
				<el-tab-pane :label="t('settings.agentGlobalConfig.section')" name="agent-global-config">
					<AgentGlobalConfigSettingsPanel v-if="activeTab === 'agent-global-config'" />
				</el-tab-pane>
				<el-tab-pane v-if="canManageUsers" :label="t('user.management.title')" name="user">
					<UserManagementPanel v-if="activeTab === 'user'" />
				</el-tab-pane>
			</el-tabs>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElTabPane, ElTabs, ElMessage, ElMessageBox } from 'element-plus'
import { t } from '@ai-system/lib'
import topBar from '@/pages/components/topBar.vue'
import EmbeddingSettingsPanel from './components/EmbeddingSettingsPanel.vue'
import LlmSettingsPanel from './components/LlmSettingsPanel.vue'
import RagSettingsPanel from './components/RagSettingsPanel.vue'
import AgentPluginSettingsPanel from './components/AgentPluginSettingsPanel.vue'
import AgentGlobalConfigSettingsPanel from './components/AgentGlobalConfigSettingsPanel.vue'
import UserManagementPanel from './components/UserManagementPanel.vue'
import { getProperties, putProperties } from '@/api/property.api'
import { hasRoleAccess, ROLE_ADMIN } from '@/utils/role'

const KEY_RETRIEVE_TOP_K = 'RETRIEVE_TOP_K'
const KEY_RETRIEVE_METRIC_TYPE = 'RETRIEVE_METRIC_TYPE'
const KEY_RETRIEVE_METRIC_SCORE_COMPARE_EXPR = 'RETRIEVE_METRIC_SCORE_COMPARE_EXPR'
const KEY_RETRIEVE_DENSE_WEIGHT = 'RETRIEVE_DENSE_WEIGHT'
const KEY_RETRIEVE_SPARSE_WEIGHT = 'RETRIEVE_SPARSE_WEIGHT'

const activeTab = ref('llm')
const loading = ref(false)
const saving = ref(false)
const canManageUsers = computed(() => hasRoleAccess(ROLE_ADMIN))

// 用于避免切 Tab 后旧请求把 loading 状态覆盖回来
let loadSeq = 0

const ragForm = ref({
	topK: 5,
	metricType: 'COSINE',
	metricScoreExpr: '> 0.7',
	denseWeight: 0.5,
	sparseWeight: 0.5
})
const ragMetricSnapshot = ref(ragForm.value.metricType)

const parseNumber = (value?: string, fallback = 0) => {
	if (value === undefined || value === null) {
		return fallback
	}
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeRagWeights = () => {
	const dense = ragForm.value.denseWeight
	const sparse = ragForm.value.sparseWeight
	const total = dense + sparse
	if (!Number.isFinite(total) || total <= 0) {
		ragForm.value.denseWeight = 0.5
		ragForm.value.sparseWeight = 0.5
		return
	}
	ragForm.value.denseWeight = dense / total
	ragForm.value.sparseWeight = sparse / total
}

const resolvePropertyMap = (res: any) => {
	if (res?.data?.data) {
		return res.data.data
	}
	return res?.data ?? {}
}

/**
 * 加载 RAG 配置：仅在激活 `rag` Tab 时触发
 */
const loadSettings = async () => {
	const seq = ++loadSeq
	loading.value = true
	try {
		const keys = [
			KEY_RETRIEVE_TOP_K,
			KEY_RETRIEVE_METRIC_TYPE,
			KEY_RETRIEVE_METRIC_SCORE_COMPARE_EXPR,
			KEY_RETRIEVE_DENSE_WEIGHT,
			KEY_RETRIEVE_SPARSE_WEIGHT
		]
		const res = await getProperties(keys)
		const data = resolvePropertyMap(res)
		ragForm.value.topK = parseNumber(data[KEY_RETRIEVE_TOP_K], ragForm.value.topK)
		ragForm.value.metricType =
			data[KEY_RETRIEVE_METRIC_TYPE] || ragForm.value.metricType
		ragForm.value.metricScoreExpr =
			data[KEY_RETRIEVE_METRIC_SCORE_COMPARE_EXPR] || ragForm.value.metricScoreExpr
		ragForm.value.denseWeight = parseNumber(
			data[KEY_RETRIEVE_DENSE_WEIGHT],
			ragForm.value.denseWeight
		)
		ragForm.value.sparseWeight = parseNumber(
			data[KEY_RETRIEVE_SPARSE_WEIGHT],
			ragForm.value.sparseWeight
		)
		normalizeRagWeights()
		ragMetricSnapshot.value = ragForm.value.metricType
	} catch (error) {
		ElMessage.error(t('settings.load.failed'))
	} finally {
		// 只有当前序列请求完成才更新 loading
		if (seq === loadSeq) loading.value = false
	}
}

const buildPayload = () => {
	normalizeRagWeights()
	const toValue = (value: unknown) => {
		if (value === undefined || value === null) {
			return ''
		}
		return String(value)
	}
	return [
		{ propertyName: KEY_RETRIEVE_TOP_K, propertyValue: toValue(ragForm.value.topK) },
		{ propertyName: KEY_RETRIEVE_METRIC_TYPE, propertyValue: toValue(ragForm.value.metricType) },
		{
			propertyName: KEY_RETRIEVE_METRIC_SCORE_COMPARE_EXPR,
			propertyValue: toValue(ragForm.value.metricScoreExpr)
		},
		{ propertyName: KEY_RETRIEVE_DENSE_WEIGHT, propertyValue: toValue(ragForm.value.denseWeight) },
		{ propertyName: KEY_RETRIEVE_SPARSE_WEIGHT, propertyValue: toValue(ragForm.value.sparseWeight) }
	]
}

const isRagMetricTypeChanged = () => {
	return ragMetricSnapshot.value !== ragForm.value.metricType
}

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

const saveSettings = async () => {
	saving.value = true
	try {
		if (isRagMetricTypeChanged()) {
			await confirmEmbeddingRebuild()
		}
		await putProperties(buildPayload())
		ragMetricSnapshot.value = ragForm.value.metricType
		ElMessage.success(t('settings.save.success'))
	} catch (error) {
		if (error !== 'cancel') {
			ElMessage.error(t('settings.save.failed'))
		}
	} finally {
		saving.value = false
	}
}

watch(
	activeTab,
	(tab) => {
		// 切到 rag 才拉取配置；v-if 卸载/重挂载可确保面板也重新初始化
		if (tab === 'rag') {
			loadSettings()
		}
	},
	{ flush: 'post' }
)
</script>

<style scoped lang="scss">
@use '@/styles/platform' as *;

.settings-page {
	height: 100%;
	padding-top: 50px;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
}

.settings-content {
	padding: 20px;
	flex: 1;
	height: auto;
	overflow: auto;
}

.settings-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 8px;

	h2 {
		margin: 0;
		color: var(--n-color-text-primary);
		font-weight: 600;
	}
}

.settings-tabs {
	@include n-data-table-panel;

	:deep(.el-tabs__header) {
		margin-bottom: 12px;
	}

	:deep(.el-tabs__nav-wrap::after) {
		height: 1px;
		background-color: var(--n-color-border-soft);
	}

	:deep(.el-tabs__item) {
		color: color-mix(in srgb, var(--n-color-text-primary) 72%, transparent);
		font-weight: 500;
		transition: color 0.2s ease;
	}

	:deep(.el-tabs__item:hover) {
		color: var(--n-color-text-primary);
	}

	:deep(.el-tabs__item.is-active) {
		color: var(--el-color-primary);
		background: transparent !important;
	}

	:deep(.el-tabs__active-bar) {
		height: 2px;
		border-radius: 2px;
		background-color: var(--el-color-primary);
	}

	:deep(.el-tabs__content),
	:deep(.el-tab-pane) {
		background: transparent;
	}
}
</style>
