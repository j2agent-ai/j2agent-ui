<template>
	<div class="agent-plugin-panel" v-loading="loading">
		<el-form label-width="160px">
			<el-form-item :label="t('settings.agentPlugin.jarFiles')">
				<el-table :data="jarTableRows" border size="small" class="jar-table">
					<el-table-column prop="name" :label="t('settings.agentPlugin.jarName')" />
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
import { ElButton, ElForm, ElFormItem, ElMessage, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { t } from '@ai-system/lib'
import { getAgentPlugins, reloadAgentPlugins } from '@/api/ai.api'
import type { AgentPluginStatus, AgentReloadResult } from '@/types/ai.types'

const loading = ref(false)
const reloading = ref(false)
const status = ref<AgentPluginStatus>({
	jarFiles: [],
	loadedAgentIds: []
})

const jarTableRows = computed(() => (status.value.jarFiles ?? []).map((name) => ({ name })))

const loadStatus = async () => {
	loading.value = true
	try {
		const res = await getAgentPlugins()
		status.value = res.data ?? { jarFiles: [], loadedAgentIds: [] }
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

onMounted(() => {
	loadStatus()
})
</script>

<style scoped lang="scss">
.agent-plugin-panel {
	max-width: 720px;
}

.jar-table {
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
