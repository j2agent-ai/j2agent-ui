<template>
	<section class="audit-panel">
		<div class="toolbar">
			<div class="toolbar__group">
				<el-button @click="refreshData">
					{{ t('common.refresh') }}
				</el-button>
				<el-button
					type="danger"
					:disabled="selectedContextKeys.size === 0"
					:loading="deleting"
					@click="deleteSelectedContexts"
				>
					{{ t('audit.delete.selected', { count: selectedContextKeys.size }) }}
				</el-button>
			</div>
			<div class="toolbar__group toolbar__filters">
				<AuditUserPicker
					v-model="selectedUserId"
					v-model:username="selectedUsername"
					clearable
					source="context"
					:placeholder="t('audit.filter.user')"
					@change="onUserPicked"
				/>
				<el-input
					v-model="titleKeyword"
					clearable
					:placeholder="t('audit.filter.title')"
					@keyup.enter="resetAndLoad"
					@clear="resetAndLoad"
				/>
				<el-input
					v-model="agentId"
					clearable
					:placeholder="t('audit.filter.agent')"
					@keyup.enter="resetAndLoad"
					@clear="resetAndLoad"
				/>
				<GlassTimeRangePicker v-model="dateRange" @change="resetAndLoad" />
				<el-button type="primary" @click="resetAndLoad">
					{{ t('common.search') }}
				</el-button>
			</div>
		</div>

		<div class="table-wrap">
			<el-table
				v-loading="loading"
				:data="sessions"
				ref="contextTableRef"
				height="100%"
				:row-key="contextKey"
				@selection-change="onContextSelectionChange"
			>
				<el-table-column type="selection" width="46" reserve-selection />
				<el-table-column :label="t('common.action')" width="100" fixed="left">
					<template #default="{ row }">
						<el-button link type="primary" @click="openMessages(row)">
							{{ t('audit.chat.view') }}
						</el-button>
					</template>
				</el-table-column>
				<el-table-column
					prop="title"
					:label="t('audit.col.title')"
					min-width="200"
					show-overflow-tooltip
				/>
				<el-table-column
					prop="userId"
					:label="t('audit.col.userId')"
					min-width="160"
					show-overflow-tooltip
				/>
				<el-table-column
					:label="t('audit.col.username')"
					min-width="120"
					show-overflow-tooltip
				>
					<template #default="{ row }">{{ auditUsername(row.username) }}</template>
				</el-table-column>
				<el-table-column
					prop="agentId"
					:label="t('audit.col.agentId')"
					min-width="140"
					show-overflow-tooltip
				/>
				<el-table-column
					prop="contextId"
					:label="t('audit.col.contextId')"
					min-width="180"
					show-overflow-tooltip
				/>
				<el-table-column
					prop="lastUpdateTime"
					:label="t('common.update.time')"
					width="180"
				>
					<template #default="{ row }">
						{{ formatTime(row.lastUpdateTime) }}
					</template>
				</el-table-column>
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

		<el-drawer
			v-model="drawerVisible"
			:title="drawerTitle"
			size="720px"
			append-to-body
			destroy-on-close
			:modal="false"
			class="audit-chat-detail-drawer"
			@closed="onDrawerClosed"
		>
			<div v-loading="drawerLoading" class="detail-panel">
				<header v-if="drawerMeta" class="detail-summary">
					<div class="summary-main">
						<div class="summary-title">{{ drawerMeta.title }}</div>
						<div class="summary-subtitle">{{ drawerMeta.contextId }}</div>
					</div>
					<div class="summary-aside">
						<div class="summary-tags">
							<span class="glass-chip">{{ drawerMeta.agentId }}</span>
							<span v-if="drawerMeta.userLabel" class="glass-chip">{{ drawerMeta.userLabel }}</span>
						</div>
						<div class="content-view-toggle" role="group" :aria-label="t('audit.chat.mode.markdown')">
							<button
								type="button"
								class="content-view-toggle__btn"
								:class="{ 'is-active': contentViewMode === 'markdown' }"
								@click="contentViewMode = 'markdown'"
							>
								{{ t('audit.chat.mode.markdown') }}
							</button>
							<button
								type="button"
								class="content-view-toggle__btn"
								:class="{ 'is-active': contentViewMode === 'raw' }"
								@click="contentViewMode = 'raw'"
							>
								{{ t('audit.chat.mode.raw') }}
							</button>
						</div>
					</div>
				</header>

				<div ref="messageListRef" class="message-list">
					<div
						v-for="(msg, idx) in messages"
						:key="`${msg.index ?? idx}-${contentViewMode}`"
						class="message-item"
						:class="`role-${msg.role}`"
					>
						<div class="message-meta">
							<span class="role">{{ msg.role }}</span>
							<span v-if="msg.index != null" class="index">#{{ msg.index }}</span>
						</div>
						<template v-if="contentViewMode === 'markdown'">
							<div
								v-if="msg.content"
								class="message-content message-md"
								v-html="renderMessageHtml(msg.content)"
							/>
							<div v-else class="message-content empty-content">-</div>
							<div
								v-if="msg.reasoningContent"
								class="message-reasoning message-md"
								v-html="renderMessageHtml(msg.reasoningContent)"
							/>
						</template>
						<template v-else>
							<pre class="message-content message-raw">{{ msg.content || '-' }}</pre>
							<pre
								v-if="msg.reasoningContent"
								class="message-reasoning message-raw"
							>{{ msg.reasoningContent }}</pre>
						</template>
					</div>
					<div v-if="!drawerLoading && messages.length === 0" class="empty-hint">
						{{ t('audit.chat.empty') }}
					</div>
				</div>
			</div>
		</el-drawer>
	</section>
</template>

<script setup lang="ts">
import { computed, nextTick, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue'
import {
	ElButton,
	ElDrawer,
	ElInput,
	ElMessage,
	ElMessageBox,
	ElPagination,
	ElTable,
	ElTableColumn
} from 'element-plus'
import { t } from '@ai-system/lib'
import {
	deleteAuditContexts,
	getAuditContext,
	getAuditContexts
} from '@/api/audit.api'
import type { AuditContextItem, AuditMessage } from '@/types/audit.types'
import type { UserDto } from '@/api/user.api'
import GlassTimeRangePicker from '@/components/GlassTimeRangePicker/GlassTimeRangePicker.vue'
import AuditUserPicker from '@/pages/audit/components/AuditUserPicker.vue'
import {
	buildMdViewerPrefetchRootMargin,
	cancelPendingMarkdownRenderWork,
	preloadDiagramRuntimes,
	renderMarkdownBlocks,
	renderMarkdownCached
} from '@/utils/markdownRenderer'

const selectedUserId = ref<string>()
const selectedUsername = ref<string>()
const titleKeyword = ref('')
const agentId = ref('')
const dateRange = ref<[string, string] | null>(null)

const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const sessions = ref<AuditContextItem[]>([])
const selectedContextKeys = ref(new Set<string>())
const deleting = ref(false)
const contextTableRef = ref<{
	clearSelection: () => void
	toggleRowSelection: (row: AuditContextItem, selected?: boolean) => void
} | null>(null)
let syncingContextSelection = false

const drawerVisible = ref(false)
const drawerLoading = ref(false)
const drawerTitle = ref('')
const drawerContextId = ref('')
const drawerAgentId = ref('')
const drawerUserId = ref('')
const messages = ref<AuditMessage[]>([])
const messageListRef = ref<HTMLElement | null>(null)
/** 详情内容展示模式：Markdown 渲染 / 原文 */
const contentViewMode = ref<'markdown' | 'raw'>('markdown')
/** 防止抽屉关闭回调清空正在加载的详情 */
let detailLoadSeq = 0

const drawerMeta = computed(() => {
	if (!drawerVisible.value) {
		return null
	}
	return {
		title: drawerTitle.value || '-',
		contextId: drawerContextId.value || '-',
		agentId: drawerAgentId.value || '-',
		userLabel: selectedUsername.value || drawerUserId.value || ''
	}
})

let activateToken = 0
let activateDebounceTimer = 0
let diagramPreloadStarted = false

/** 将 Markdown 原文转为 HTML（含图表占位） */
function renderMessageHtml(content: string) {
	return renderMarkdownCached(content)
}

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

function contextKey(row: AuditContextItem) {
	return `${row.contextId}\u0000${row.agentId}`
}

function resetAndLoad() {
	clearContextSelection()
	page.value = 1
	loadData()
}

function refreshData() {
	clearContextSelection()
	loadData()
}

/** 用户选择弹窗确认后刷新会话列表 */
function onUserPicked(_user: UserDto | null) {
	resetAndLoad()
}

function onContextSelectionChange(rows: AuditContextItem[]) {
	if (syncingContextSelection) {
		return
	}
	const currentKeys = sessions.value.map(contextKey)
	for (const key of currentKeys) {
		selectedContextKeys.value.delete(key)
	}
	for (const row of rows) {
		selectedContextKeys.value.add(contextKey(row))
	}
}

function clearContextSelection() {
	selectedContextKeys.value.clear()
	syncingContextSelection = true
	contextTableRef.value?.clearSelection()
	syncingContextSelection = false
}

async function syncContextSelection() {
	await nextTick()
	const table = contextTableRef.value
	if (!table) {
		return
	}
	syncingContextSelection = true
	table.clearSelection()
	for (const row of sessions.value) {
		if (selectedContextKeys.value.has(contextKey(row))) {
			table.toggleRowSelection(row, true)
		}
	}
	syncingContextSelection = false
}

async function deleteSelectedContexts() {
	const keys = Array.from(selectedContextKeys.value)
	const items = keys.map((key) => {
		const [contextId, agentId] = key.split('\u0000')
		return { contextId, agentId }
	})
	try {
		await ElMessageBox.confirm(
			t('audit.delete.context.confirm', { count: items.length }),
			t('common.delete'),
			{
				type: 'warning',
				confirmButtonText: t('common.ok'),
				cancelButtonText: t('common.cancel')
			}
		)
		deleting.value = true
		await deleteAuditContexts(items)
		const openKey = `${drawerContextId.value}\u0000${drawerAgentId.value}`
		if (selectedContextKeys.value.has(openKey)) {
			drawerVisible.value = false
		}
		clearContextSelection()
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

async function loadData() {
	loading.value = true
	try {
		const res = await getAuditContexts({
			'user-id': selectedUserId.value || undefined,
			title: titleKeyword.value.trim() || undefined,
			'agent-id': agentId.value.trim() || undefined,
			...timeParams(),
			offset: (page.value - 1) * pageSize.value,
			limit: pageSize.value
		})
			sessions.value = res.data?.data || []
			total.value = Number(res.data?.total || 0)
			await syncContextSelection()
	} catch {
		ElMessage.error(t('audit.load.failed'))
	} finally {
		loading.value = false
	}
}

/** 调度抽屉内 Mermaid / 表格等异步块渲染 */
function scheduleActivateMarkdown() {
	if (activateDebounceTimer) {
		window.clearTimeout(activateDebounceTimer)
	}
	activateDebounceTimer = window.setTimeout(() => {
		activateDebounceTimer = 0
		void activateMarkdown()
	}, 80)
}

async function activateMarkdown() {
	await nextTick()
	const root = messageListRef.value
	if (!root || !drawerVisible.value || drawerLoading.value) {
		return
	}
	ensureDiagramPreload()
	const token = ++activateToken
	await renderMarkdownBlocks(root, {
		scrollRoot: root,
		concurrency: 4,
		backgroundConcurrency: 2,
		prefetchRootMargin: buildMdViewerPrefetchRootMargin(root),
		lazy: true
	})
	if (token !== activateToken) {
		return
	}
}

function ensureDiagramPreload() {
	if (diagramPreloadStarted) {
		return
	}
	diagramPreloadStarted = true
	preloadDiagramRuntimes()
}

function onDrawerClosed() {
	activateToken++
	cancelPendingMarkdownRenderWork(messageListRef.value)
	// 仅在无进行中的详情请求时清空，避免与再次打开竞态
	if (!drawerLoading.value) {
		messages.value = []
		drawerContextId.value = ''
		drawerAgentId.value = ''
		drawerUserId.value = ''
		contentViewMode.value = 'markdown'
	}
}

/** 点击抽屉左侧（遮罩外区域）时收起，与知识库详情抽屉一致 */
function handleDrawerOutsidePointerDown(event: PointerEvent) {
	if (!drawerVisible.value) {
		return
	}
	const target = event.target as HTMLElement | null
	if (
		target?.closest('.audit-chat-detail-drawer') ||
		target?.closest('.audit-user-picker-dialog') ||
		target?.closest('.el-popper') ||
		target?.closest('.el-message')
	) {
		return
	}
	drawerVisible.value = false
}

/** 打开会话消息抽屉（审计专用 /audit/context） */
async function openMessages(row: AuditContextItem) {
	const loadSeq = ++detailLoadSeq
	drawerTitle.value = row.title || row.contextId
	drawerContextId.value = row.contextId
	drawerAgentId.value = row.agentId
	drawerUserId.value = row.userId || ''
	drawerVisible.value = true
	drawerLoading.value = true
	messages.value = []
	contentViewMode.value = 'markdown'
	if (row.username) {
		selectedUsername.value = row.username
	} else {
		selectedUsername.value = auditUsername(row.username)
	}
	try {
		const res = await getAuditContext({
			'context-id': row.contextId,
			'agent-id': row.agentId
		})
		if (loadSeq !== detailLoadSeq) {
			return
		}
		if (res.data?.username) {
			selectedUsername.value = res.data.username
		} else {
			selectedUsername.value = auditUsername(res.data?.username)
		}
		const list = res.data?.messages || []
		// 审计页展示会话气泡；隐藏纯工具/审计行
		messages.value = list.filter((m) => m.displayInChat !== false)
	} catch {
		if (loadSeq === detailLoadSeq) {
			ElMessage.error(t('audit.chat.load.failed'))
		}
	} finally {
		if (loadSeq === detailLoadSeq) {
			drawerLoading.value = false
		}
	}
}

watch(
	() =>
		[
			drawerVisible.value,
			drawerLoading.value,
			messages.value,
			contentViewMode.value
		] as const,
	([visible, isLoading, msgs, mode]) => {
		if (!visible || isLoading || !msgs.length || mode !== 'markdown') {
			return
		}
		scheduleActivateMarkdown()
	}
)

onMounted(() => {
	loadData()
	document.addEventListener('pointerdown', handleDrawerOutsidePointerDown, true)
})

/** keep-alive 切走时收起抽屉，避免浮在其他面板上；列表筛选状态保留 */
onDeactivated(() => {
	drawerVisible.value = false
})

onUnmounted(() => {
	document.removeEventListener('pointerdown', handleDrawerOutsidePointerDown, true)
	if (activateDebounceTimer) {
		window.clearTimeout(activateDebounceTimer)
	}
	cancelPendingMarkdownRenderWork(messageListRef.value)
})
</script>

<style scoped lang="scss">
@use '@/styles/platform' as *;

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
	.el-input:not(.el-date-editor) {
		width: 180px;
	}

	:deep(.audit-user-picker__trigger) {
		min-width: 180px;
	}
}

.table-wrap {
	flex: 1;
	min-height: 0;
}

.empty-hint {
	padding: 24px;
	text-align: center;
	color: var(--n-color-text-muted);
}

:global(.audit-chat-detail-drawer.el-drawer) {
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

:global(.audit-chat-detail-drawer .el-drawer__header) {
	flex-shrink: 0;
	min-height: 56px;
	margin: 0;
	padding: 16px 20px 12px;
	display: flex;
	align-items: center;
	background: transparent;
	border-bottom: 1px solid var(--n-color-border-soft);
}

:global(.audit-chat-detail-drawer .el-drawer__title) {
	color: var(--n-color-text-primary);
	font-size: 16px;
	font-weight: bolder;
}

:global(.audit-chat-detail-drawer .el-drawer__close) {
	color: color-mix(in srgb, var(--n-color-text-primary), transparent 50%);
	text-shadow: var(--el-color-primary-light-3);
}

:global(.audit-chat-detail-drawer .el-drawer__body) {
	padding: 0;
	overflow: hidden;
	background: transparent;
}

.detail-panel {
	height: 100%;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	padding: 20px 24px 24px;
	color: var(--n-color-text-primary);
	box-sizing: border-box;
}

.detail-summary {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 16px;
	padding-bottom: 18px;
	margin-bottom: 16px;
	border-bottom: 1px solid var(--n-color-border-soft);
	flex-shrink: 0;
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
	font-size: 12px;
	line-height: 1.4;
	color: var(--n-color-text-muted);
	word-break: break-all;
}

.summary-aside {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 10px;
	flex-shrink: 0;
}

.summary-tags {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: 8px;
	max-width: 100%;
}

.glass-chip {
	display: inline-flex;
	align-items: center;
	max-width: 220px;
	padding: 4px 10px;
	border-radius: 999px;
	font-size: 12px;
	line-height: 1.3;
	color: var(--n-color-text-primary);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	@include n-glass-surface(1);
	box-shadow: var(--n-shadow-elevation-1);
	border: 1px solid color-mix(in srgb, var(--n-color-border-soft) 70%, transparent);
}

.content-view-toggle {
	display: inline-flex;
	align-items: center;
	padding: 3px;
	gap: 2px;
	border-radius: 999px;
	flex-shrink: 0;
	@include n-glass-surface(1);
	border: 1px solid color-mix(in srgb, var(--n-color-border-soft) 75%, transparent);
	box-shadow: var(--n-shadow-elevation-1);
}

.content-view-toggle__btn {
	appearance: none;
	border: 0;
	background: transparent;
	color: var(--n-color-text-muted);
	font-size: 12px;
	font-weight: 600;
	line-height: 1;
	padding: 7px 12px;
	border-radius: 999px;
	cursor: pointer;
	transition:
		color 0.15s ease,
		background-color 0.15s ease,
		box-shadow 0.15s ease;

	&:hover {
		color: var(--n-color-text-primary);
	}

	&.is-active {
		color: var(--n-color-text-inverse);
		background: var(--el-color-primary);
		box-shadow: var(--n-shadow-elevation-2);
	}
}

.message-list {
	display: flex;
	flex-direction: column;
	gap: 12px;
	flex: 1;
	min-height: 0;
	overflow: auto;
	scrollbar-width: thin;
}

.message-item {
	padding: 12px;
	border-radius: 8px;
	background: color-mix(in srgb, var(--n-color-bg-secondary) 82%, transparent);
	border: 1px solid color-mix(in srgb, var(--n-color-border-soft) 70%, transparent);
}

.message-meta {
	display: flex;
	gap: 8px;
	margin-bottom: 8px;
	font-size: 12px;
	color: var(--n-color-text-muted);

	.role {
		font-weight: 600;
		text-transform: uppercase;
	}
}

.message-content,
.message-reasoning {
	margin: 0;
	word-break: break-word;
	font-size: 13px;
	line-height: 1.5;
	overflow-x: auto;
}

.message-raw {
	white-space: pre-wrap;
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	font-size: 12px;
	line-height: 1.55;
}

.empty-content {
	color: var(--n-color-text-muted);
}

.message-reasoning {
	margin-top: 8px;
	padding-top: 8px;
	border-top: 1px solid var(--n-color-border-soft);
	color: var(--n-color-text-muted);
}

.role-user {
	border-left: 3px solid var(--el-color-primary);
}

.role-assistant {
	border-left: 3px solid var(--el-color-success);
}

.role-system,
.role-tool {
	border-left: 3px solid var(--n-color-text-muted);
}

@media (max-width: 640px) {
	:global(.audit-chat-detail-drawer.el-drawer) {
		width: min(100vw, 720px) !important;
	}

	.detail-summary {
		flex-direction: column;
	}

	.summary-aside {
		align-items: flex-start;
		width: 100%;
	}

	.summary-tags {
		justify-content: flex-start;
		max-width: none;
	}
}
</style>
