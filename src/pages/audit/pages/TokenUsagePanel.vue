<template>
	<section class="audit-panel">
		<div class="toolbar">
			<div class="toolbar__group">
				<el-button v-if="viewMode === 'detail'" @click="backToOverview">
					{{ t('audit.token.back.overview') }}
				</el-button>
				<el-button @click="refreshData">{{ t('common.refresh') }}</el-button>
				<el-button
					v-if="viewMode === 'detail'"
					type="danger"
					:disabled="selectedRecordIds.size === 0"
					:loading="deleting"
					@click="deleteSelectedRecords"
				>
					{{ t('audit.delete.selected', { count: selectedRecordIds.size }) }}
				</el-button>
			</div>
			<div class="toolbar__group toolbar__filters">
				<AuditUserPicker
					v-model="selectedUserId"
					v-model:username="detailUsername"
					clearable
					source="token"
					:placeholder="t('audit.filter.user')"
					@change="onUserPicked"
				/>
				<template v-if="viewMode === 'overview'">
					<el-input
						v-model="usernameKeyword"
						clearable
						:placeholder="t('audit.filter.username')"
						@keyup.enter="resetAndLoad"
						@clear="resetAndLoad"
					/>
				</template>
				<template v-else>
					<el-input
						v-model="agentId"
						clearable
						:placeholder="t('audit.filter.agent')"
						@keyup.enter="resetAndLoad"
						@clear="resetAndLoad"
					/>
					<el-input
						v-model="modelName"
						clearable
						:placeholder="t('audit.filter.model')"
						@keyup.enter="resetAndLoad"
						@clear="resetAndLoad"
					/>
					<el-select
						v-model="callKind"
						clearable
						:placeholder="t('audit.filter.callKind')"
						@change="resetAndLoad"
					>
						<el-option label="CHAT" value="CHAT" />
						<el-option label="SYNC" value="SYNC" />
						<el-option label="SYNC_VISION" value="SYNC_VISION" />
					</el-select>
					<el-select
						v-model="usageStatus"
						clearable
						:placeholder="t('audit.filter.usageStatus')"
						@change="resetAndLoad"
					>
						<el-option label="AVAILABLE" value="AVAILABLE" />
						<el-option label="UNAVAILABLE" value="UNAVAILABLE" />
					</el-select>
				</template>
				<GlassTimeRangePicker v-model="dateRange" @change="resetAndLoad" />
				<el-button type="primary" @click="resetAndLoad">
					{{ t('common.search') }}
				</el-button>
			</div>
		</div>

		<div v-if="viewMode === 'overview'" class="summary-bar">
			<span>{{ t('audit.token.global.calls') }}: {{ globalCallCount }}</span>
			<span>{{ t('audit.token.global.input') }}: {{ globalInputTokens }}</span>
			<span>{{ t('audit.token.global.output') }}: {{ globalOutputTokens }}</span>
			<span>{{ t('audit.token.global.billable') }}: {{ globalBillableTokens }}</span>
		</div>
		<div v-else class="summary-bar">
			<span>{{ t('audit.token.detail.user') }}: {{ detailUsername || selectedUserId }}</span>
		</div>

		<div class="table-wrap">
			<el-table
				v-if="viewMode === 'overview'"
				v-loading="loading"
				:data="summaryRows"
				height="100%"
			>
				<el-table-column
					:label="t('audit.col.username')"
					min-width="140"
				>
					<template #default="{ row }">{{ auditUsername(row.username) }}</template>
				</el-table-column>
				<el-table-column
					prop="userId"
					:label="t('audit.col.userId')"
					min-width="180"
					show-overflow-tooltip
				/>
				<el-table-column
					prop="callCount"
					:label="t('audit.col.callCount')"
					width="110"
				/>
				<el-table-column
					prop="inputTokens"
					:label="t('audit.col.inputTokens')"
					width="120"
				/>
				<el-table-column
					prop="outputTokens"
					:label="t('audit.col.outputTokens')"
					width="120"
				/>
				<el-table-column
					prop="billableTokens"
					:label="t('audit.col.billableTokens')"
					width="130"
				/>
				<el-table-column :label="t('common.action')" width="140" fixed="right">
					<template #default="{ row }">
						<el-button link type="primary" @click="openDetail(row)">
							{{ t('audit.token.view.detail') }}
						</el-button>
						<el-button link type="danger" :loading="deleting" @click="deleteSummaryUser(row)">
							{{ t('common.delete') }}
						</el-button>
					</template>
				</el-table-column>
			</el-table>

			<el-table
				v-else
				v-loading="loading"
				:data="recordRows"
				ref="recordTableRef"
				height="100%"
				row-key="id"
				@selection-change="onRecordSelectionChange"
			>
				<el-table-column type="selection" width="46" reserve-selection />
				<el-table-column
					prop="createTime"
					:label="t('audit.col.createTime')"
					width="170"
				>
					<template #default="{ row }">
						{{ formatTime(row.createTime) }}
					</template>
				</el-table-column>
				<el-table-column
					prop="agentId"
					:label="t('audit.col.agentId')"
					min-width="140"
					show-overflow-tooltip
				/>
				<el-table-column
					prop="modelName"
					:label="t('audit.col.modelName')"
					min-width="140"
					show-overflow-tooltip
				/>
				<el-table-column prop="callKind" :label="t('audit.col.callKind')" width="120" />
				<el-table-column
					prop="inputTokens"
					:label="t('audit.col.inputTokens')"
					width="100"
				/>
				<el-table-column
					prop="outputTokens"
					:label="t('audit.col.outputTokens')"
					width="100"
				/>
				<el-table-column
					prop="billableTokenCount"
					:label="t('audit.col.billableTokens')"
					width="110"
				/>
				<el-table-column
					prop="usageStatus"
					:label="t('audit.col.usageStatus')"
					width="120"
				/>
				<el-table-column
					prop="contextId"
					:label="t('audit.col.contextId')"
					min-width="160"
					show-overflow-tooltip
				/>
			</el-table>
		</div>

		<el-pagination
			v-model:current-page="page"
			v-model:page-size="pageSize"
			:total="total"
			:page-sizes="[10, 20, 50, 100]"
			layout="total, sizes, prev, pager, next"
			@current-change="loadData"
			@size-change="resetAndLoad"
		/>
	</section>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import {
	ElButton,
	ElInput,
	ElMessage,
	ElMessageBox,
	ElOption,
	ElPagination,
	ElSelect,
	ElTable,
	ElTableColumn
} from 'element-plus'
import { t } from '@ai-system/lib'
import type { UserDto } from '@/api/user.api'
import {
	deleteAuditTokenRecords,
	deleteAuditTokenUsers,
	getAuditTokenRecords,
	getAuditTokenSummary
} from '@/api/audit.api'
import type {
	AuditTokenRecord,
	AuditTokenSummaryItem
} from '@/types/audit.types'
import GlassTimeRangePicker from '@/components/GlassTimeRangePicker/GlassTimeRangePicker.vue'
import AuditUserPicker from '@/pages/audit/components/AuditUserPicker.vue'

const viewMode = ref<'overview' | 'detail'>('overview')
const selectedUserId = ref<string>()
const usernameKeyword = ref('')
const agentId = ref('')
const modelName = ref('')
const callKind = ref<string>()
const usageStatus = ref<string>()
const dateRange = ref<[string, string] | null>(null)

const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const summaryRows = ref<AuditTokenSummaryItem[]>([])
const recordRows = ref<AuditTokenRecord[]>([])
const detailUsername = ref('')
const selectedRecordIds = ref(new Set<string>())
const deleting = ref(false)
const recordTableRef = ref<{
	clearSelection: () => void
	toggleRowSelection: (row: AuditTokenRecord, selected?: boolean) => void
} | null>(null)
let syncingRecordSelection = false

const globalCallCount = ref(0)
const globalInputTokens = ref(0)
const globalOutputTokens = ref(0)
const globalBillableTokens = ref(0)

/** 解析时间范围毫秒值 */
function timeParams() {
	if (!dateRange.value || dateRange.value.length !== 2) {
		return {}
	}
	return {
		from: Number(dateRange.value[0]),
		to: Number(dateRange.value[1])
	}
}

function formatTime(value?: number) {
	return value ? new Date(value).toLocaleString() : '-'
}

function auditUsername(username?: string) {
	return username || t('audit.user.deleted')
}

/** 用户选择弹窗：有用户则进明细，清空则回总览 */
function onUserPicked(user: UserDto | null) {
	if (user) {
		viewMode.value = 'detail'
		detailUsername.value = auditUsername(user.username)
	} else {
		viewMode.value = 'overview'
		detailUsername.value = ''
	}
	resetAndLoad()
}

function openDetail(row: AuditTokenSummaryItem) {
	selectedUserId.value = row.userId
	detailUsername.value = row.username || ''
	viewMode.value = 'detail'
	selectedRecordIds.value.clear()
	resetAndLoad()
}

function backToOverview() {
	selectedUserId.value = undefined
	detailUsername.value = ''
	viewMode.value = 'overview'
	agentId.value = ''
	modelName.value = ''
	callKind.value = undefined
	usageStatus.value = undefined
	selectedRecordIds.value.clear()
	resetAndLoad()
}

function onRecordSelectionChange(rows: AuditTokenRecord[]) {
	if (syncingRecordSelection) {
		return
	}
	const currentIds = recordRows.value
		.map((row) => row.id)
		.filter((id): id is string => Boolean(id))
	for (const id of currentIds) {
		selectedRecordIds.value.delete(id)
	}
	for (const row of rows) {
		if (row.id) {
			selectedRecordIds.value.add(row.id)
		}
	}
}

function clearRecordSelection() {
	selectedRecordIds.value.clear()
	syncingRecordSelection = true
	recordTableRef.value?.clearSelection()
	syncingRecordSelection = false
}

async function syncRecordSelection() {
	if (viewMode.value !== 'detail') {
		return
	}
	await nextTick()
	const table = recordTableRef.value
	if (!table) {
		return
	}
	syncingRecordSelection = true
	table.clearSelection()
	for (const row of recordRows.value) {
		if (row.id && selectedRecordIds.value.has(row.id)) {
			table.toggleRowSelection(row, true)
		}
	}
	syncingRecordSelection = false
}

async function deleteSelectedRecords() {
	const ids = Array.from(selectedRecordIds.value)
	if (!ids.length) {
		return
	}
	try {
		await ElMessageBox.confirm(
			t('audit.delete.token.confirm', { count: ids.length }),
			t('common.delete'),
			{
				type: 'warning',
				confirmButtonText: t('common.ok'),
				cancelButtonText: t('common.cancel')
			}
		)
		deleting.value = true
		await deleteAuditTokenRecords(ids)
		clearRecordSelection()
		ElMessage.success(t('audit.delete.success'))
		await loadData()
	} catch (error) {
		if (error !== 'cancel' && error !== 'close') {
			ElMessage.error(t('audit.delete.failed'))
		}
	} finally {
		deleting.value = false
	}
}

async function deleteSummaryUser(row: AuditTokenSummaryItem) {
	if (!row.userId) {
		return
	}
	try {
		await ElMessageBox.confirm(
			t('audit.delete.token.user.confirm'),
			t('common.delete'),
			{
				type: 'warning',
				confirmButtonText: t('common.ok'),
				cancelButtonText: t('common.cancel')
			}
		)
		deleting.value = true
		await deleteAuditTokenUsers([row.userId])
		ElMessage.success(t('audit.delete.success'))
		await loadData()
	} catch (error) {
		if (error !== 'cancel' && error !== 'close') {
			ElMessage.error(t('audit.delete.failed'))
		}
	} finally {
		deleting.value = false
	}
}

function resetAndLoad() {
	clearRecordSelection()
	page.value = 1
	loadData()
}

function refreshData() {
	clearRecordSelection()
	loadData()
}

async function loadData() {
	loading.value = true
	try {
		const offset = (page.value - 1) * pageSize.value
		const times = timeParams()
		if (viewMode.value === 'overview') {
			const res = await getAuditTokenSummary({
				'user-id': selectedUserId.value || undefined,
				username: usernameKeyword.value.trim() || undefined,
				...times,
				offset,
				limit: pageSize.value
			})
			const body = res.data
			summaryRows.value = body?.data || []
			total.value = Number(body?.total || 0)
			globalCallCount.value = Number(body?.globalCallCount || 0)
			globalInputTokens.value = Number(body?.globalInputTokens || 0)
			globalOutputTokens.value = Number(body?.globalOutputTokens || 0)
			globalBillableTokens.value = Number(body?.globalBillableTokens || 0)
		} else {
			const res = await getAuditTokenRecords({
				'user-id': selectedUserId.value || undefined,
				'agent-id': agentId.value.trim() || undefined,
				'model-name': modelName.value.trim() || undefined,
				'call-kind': callKind.value || undefined,
				'usage-status': usageStatus.value || undefined,
				...times,
				offset,
				limit: pageSize.value
			})
			const body = res.data
			recordRows.value = body?.data || []
			total.value = Number(body?.total || 0)
			await syncRecordSelection()
		}
	} catch {
		ElMessage.error(t('audit.load.failed'))
	} finally {
		loading.value = false
	}
}

onMounted(() => {
	loadData()
})
</script>

<style scoped lang="scss">
.audit-panel {
	display: flex;
	flex-direction: column;
	height: 100%;
	gap: 12px;
	min-height: 0;
}

.toolbar {
	display: flex;
	flex-wrap: wrap;
	justify-content: space-between;
	gap: 12px;
}

.toolbar__group {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
}

.toolbar__filters {
	.el-select {
		width: 160px;
	}

	.el-input:not(.el-date-editor) {
		width: 160px;
	}

	:deep(.audit-user-picker__trigger) {
		min-width: 180px;
	}
}

.summary-bar {
	display: flex;
	flex-wrap: wrap;
	gap: 16px;
	padding: 10px 12px;
	border-radius: 8px;
	background: var(--n-color-bg-secondary);
	color: var(--n-color-text-muted);
	font-size: 13px;
}

.table-wrap {
	flex: 1;
	min-height: 0;
}
</style>
