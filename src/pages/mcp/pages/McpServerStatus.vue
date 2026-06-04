<template>
	<div class="mcp-status-page" v-loading="loading">
		<div class="header">
			<h2>{{ t('mcp.status.title') }}</h2>
			<el-button size="small" @click="loadStatus" :loading="loading">
				{{ t('common.refresh') }}
			</el-button>
		</div>
		<el-table :data="statusList" style="width: 100%">
			<el-table-column prop="name" :label="t('mcp.status.name')" min-width="160" />
			<el-table-column prop="type" :label="t('mcp.status.type')" min-width="140" />
			<el-table-column prop="endpoint" :label="t('mcp.status.endpoint')" min-width="260" />
			<el-table-column :label="t('mcp.status.status')" min-width="120">
				<template #default="{ row }">
					<el-tag :type="row.status === 'online' ? 'success' : 'danger'">
						{{
							row.status === 'online'
								? t('mcp.status.online')
								: t('mcp.status.offline')
						}}
					</el-tag>
				</template>
			</el-table-column>
			<el-table-column :label="t('mcp.status.tools')" min-width="220">
				<template #default="{ row }">
					<div class="tool-tags">
						<el-tooltip
							v-for="tool in row.tools || []"
							:key="tool.name"
							:content="tool.description || ''"
							:disabled="!tool.description"
							placement="top"
						>
							<el-tag size="small" class="tool-tag">
								{{ tool.name }}
							</el-tag>
						</el-tooltip>
						<span v-if="!row.tools || row.tools.length === 0">
							{{ t('mcp.status.empty.tools') }}
						</span>
					</div>
				</template>
			</el-table-column>
		</el-table>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElButton, ElMessage, ElTable, ElTableColumn, ElTag, ElTooltip } from 'element-plus'
import { t } from '@ai-system/lib'
import { getMcpStatus } from '@/api/mcp.api'

type McpStatusItem = {
	name?: string
	type?: string
	endpoint?: string
	status?: string
	tools?: Array<{
		name?: string
		description?: string
	}>
}

const loading = ref(false)
const statusList = ref<McpStatusItem[]>([])

const resolvePayload = (res: any) => {
	if (res?.data?.data) {
		return res.data.data
	}
	return res?.data ?? []
}

const loadStatus = async () => {
	loading.value = true
	try {
		const res = await getMcpStatus()
		statusList.value = resolvePayload(res) || []
	} catch (error) {
		ElMessage.error(t('mcp.status.load.failed'))
	} finally {
		loading.value = false
	}
}

onMounted(() => {
	loadStatus()
})
</script>

<style scoped lang="scss">
@use '@/styles/platform' as *;

.mcp-status-page {
	padding: 20px;
	@include n-glass-surface(2);
	border-radius: var(--n-radius-triple);
}

.header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 10px;

	h2 {
		margin: 0;
		color: var(--n-color-text-primary);
		font-weight: 600;
	}
}

.tool-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	align-items: center;
}

.tool-tag {
	margin-right: 4px;
}
</style>
