<template>
	<div class="kb-table-container">
		<div class="header-actions">
			<div class="toolbar-primary">
				<el-select
					v-model="selectedCollection"
					class="action-collection"
					placeholder="请选择 Collection"
					clearable
					filterable
					:loading="collectionLoading"
					@change="handleCollectionChange"
					@clear="handleCollectionClear"
				>
					<el-option
						v-for="collection in collectionOptions"
						:key="collection"
						:label="collection"
						:value="collection"
					/>
				</el-select>
				<div class="toolbar-buttons">
					<el-button type="primary" :icon="Refresh" @click="loadKnowledge">
						{{ t('common.refresh') }}
					</el-button>
					<el-button type="warning" :loading="syncing" @click="handleRebuild">
						{{ t('kb.knowledge.rebuild') }}
					</el-button>
				</div>
			</div>
			<div class="toolbar-search">
				<el-input
					v-model="searchKeyword"
					class="action-search"
					:placeholder="t('common.search.placeholder.keyword')"
					clearable
					@keyup.enter="handleSearch"
					@clear="handleSearch"
				/>
				<el-button type="primary" @click="handleSearch">
					{{ t('common.search') }}
				</el-button>
			</div>
		</div>
		<div class="table-wrapper">
			<el-table
				ref="tableRef"
				:data="knowledgeList"
				class="kb-data-table"
				style="width: 100%; height: 100%"
				v-loading="loading"
				stripe
			>
				<el-table-column :label="t('kb.outline')" width="300" align="center">
					<template #default="scope">
						<template v-if="!isTableCellEmpty(scope.row.outline)">
							<el-popover effect="dark" trigger="hover" placement="top" width="400">
								<template #reference>
									<div class="outline-preview">
										{{ getOutlineDisplay(scope.row.outline) }}
									</div>
								</template>
								<div class="outline-full">
									<div v-for="(item, index) in scope.row.outline" :key="index">
										{{ index + 1 }}. {{ item }}
									</div>
								</div>
							</el-popover>
						</template>
						<span v-else class="empty-text">-</span>
					</template>
				</el-table-column>
				<el-table-column :label="t('kb.textChunk')" width="300">
					<template #default="scope">
						<template v-if="!isTableCellEmpty(scope.row.textChunk)">
							<el-popover
								effect="dark"
								trigger="hover"
								placement="top"
								width="400"
							>
								<template #reference>
									<div class="text-chunk-preview">{{ scope.row.textChunk }}</div>
								</template>
								<div class="text-chunk-full">{{ scope.row.textChunk }}</div>
							</el-popover>
						</template>
						<span v-else class="empty-text">-</span>
					</template>
				</el-table-column>
				<el-table-column
					:label="t('kb.description')"
					min-width="150"
					show-overflow-tooltip
				>
					<template #default="{ row }">
						<span v-if="isTableCellEmpty(row.description)" class="empty-text">-</span>
						<span v-else>{{ row.description }}</span>
					</template>
				</el-table-column>
				<el-table-column :label="t('kb.dimension')" width="130" align="center">
					<template #default="{ row }">
						<span v-if="isTableCellEmpty(row.dimension)" class="empty-text">-</span>
						<span v-else>{{ row.dimension }}</span>
					</template>
				</el-table-column>
				<el-table-column :label="t('kb.embeddingModel')" width="150">
					<template #default="{ row }">
						<span v-if="isTableCellEmpty(row.embeddingModel)" class="empty-text">-</span>
						<span v-else>{{ row.embeddingModel }}</span>
					</template>
				</el-table-column>
				<el-table-column :label="t('kb.embeddingProvider')" width="150">
					<template #default="{ row }">
						<span v-if="isTableCellEmpty(row.embeddingProvider)" class="empty-text">-</span>
						<span v-else>{{ row.embeddingProvider }}</span>
					</template>
				</el-table-column>
				<el-table-column label="源文件" min-width="220" show-overflow-tooltip>
					<template #default="{ row }">
						<span v-if="isTableCellEmpty(row.sourceFile)" class="empty-text">-</span>
						<span v-else>{{ row.sourceFile }}</span>
					</template>
				</el-table-column>
				<el-table-column
					:label="t('common.create.time')"
					width="180"
					align="center"
				>
					<template #default="scope">
						<span v-if="!formatDateTime(scope.row.createTime)" class="empty-text">-</span>
						<span v-else>{{ formatDateTime(scope.row.createTime) }}</span>
					</template>
				</el-table-column>
				<el-table-column
					:label="t('common.update.time')"
					width="180"
					align="center"
				>
					<template #default="scope">
						<span v-if="!formatDateTime(scope.row.updateTime)" class="empty-text">-</span>
						<span v-else>{{ formatDateTime(scope.row.updateTime) }}</span>
					</template>
				</el-table-column>
				<el-table-column :label="t('kb.create.username')" width="150">
					<template #default="{ row }">
						<span v-if="isTableCellEmpty(row.createUsername)" class="empty-text">-</span>
						<span v-else>{{ row.createUsername }}</span>
					</template>
				</el-table-column>
				<template #empty>
					<span class="table-empty-hint">{{ emptyTableMessage }}</span>
				</template>
			</el-table>
		</div>
		<div class="pagination-wrapper">
			<el-pagination
				v-model:current-page="currentPage"
				v-model:page-size="pageSize"
				:page-sizes="[10, 20, 50, 100]"
				:total="total"
				layout="total, sizes, prev, pager, next, jumper"
				@size-change="handleSizeChange"
				@current-change="handleCurrentChange"
			/>
		</div>
		<el-dialog
			v-model="rebuildDialogVisible"
			:title="t('kb.knowledge.rebuild.confirm.title')"
			class="rebuild-dialog n-dialog--danger"
			width="520px"
			align-center
			append-to-body
			draggable
			destroy-on-close
		>
			<div class="rebuild-dialog-content">
				<p class="rebuild-intro">{{ t('kb.knowledge.rebuild.confirm') }}</p>
				<el-form class="rebuild-form" label-width="120px">
					<el-form-item :label="t('kb.knowledge.rebuild.full.switch')">
						<el-switch v-model="fullRebuildEnabled" />
					</el-form-item>
					<el-form-item
						v-if="fullRebuildEnabled"
						:label="t('kb.knowledge.rebuild.full.confirm.label')"
					>
						<div class="full-rebuild-confirm-area">
							<el-input
								v-model="fullRebuildConfirmText"
								class="full-rebuild-input"
								:placeholder="t('kb.knowledge.rebuild.full.confirm.placeholder')"
							/>
							<div class="full-rebuild-tip">
								{{ t('kb.knowledge.rebuild.full.confirm.tip') }}
							</div>
						</div>
					</el-form-item>
				</el-form>
			</div>
			<template #footer>
				<div class="dialog-footer">
					<el-button @click="closeRebuildDialog">
						{{ t('kb.knowledge.rebuild.confirm.cancel') }}
					</el-button>
					<el-button
						type="warning"
						:disabled="isRebuildSubmitDisabled"
						@click="confirmRebuild"
					>
						{{ t('kb.knowledge.rebuild.confirm.ok') }}
					</el-button>
				</div>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
	ElButton,
	ElDialog,
	ElForm,
	ElFormItem,
	ElInput,
	ElMessage,
	ElOption,
	ElPagination,
	ElPopover,
	ElSelect,
	ElSwitch,
	ElTable,
	ElTableColumn
} from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { getKnowledge, getKnowledgeCollections, syncKnowledge } from '@/api/kb/kb.api'
import type { KnowledgeSyncResult } from '@/types/kb.model'
import { formatDateTime, getOutlineDisplay, isTableCellEmpty, t } from '@ai-system/lib'
import { KnowledgeDto } from '@/types/kb.model'

// 状态定义
const knowledgeList = ref<KnowledgeDto[]>([])
const loading = ref(false)
const syncing = ref(false)
const collectionLoading = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const searchKeyword = ref('') // 搜索关键词
const selectedCollection = ref('')
const collectionOptions = ref<string[]>([])
const rebuildDialogVisible = ref(false)
const fullRebuildEnabled = ref(false)
const fullRebuildConfirmText = ref('')
const FULL_REBUILD_CONFIRM_TEXT = '完全重建'

const emptyTableMessage = computed(() =>
	selectedCollection.value ? '暂无数据' : '请先选择 Collection'
)

// 加载 collection 列表
const loadCollections = async () => {
	collectionLoading.value = true
	try {
		const response = await getKnowledgeCollections()
		collectionOptions.value = response.data?.data || []
	} catch (error) {
		console.error('Failed to load knowledge collections:', error)
		collectionOptions.value = []
	} finally {
		collectionLoading.value = false
	}
}

// 加载数据
const loadKnowledge = async () => {
	if (!selectedCollection.value) {
		knowledgeList.value = []
		total.value = 0
		return
	}
	loading.value = true
	try {
		const response = await getKnowledge(
			(currentPage.value - 1) * pageSize.value,
			pageSize.value + 1,
			selectedCollection.value,
			searchKeyword.value
		)
		const data = response.data?.data || []

		// 如果是前端模拟分页/搜索，可以在这里对 data 进行 filter 处理

		if (data.length > pageSize.value) {
			knowledgeList.value = data.slice(0, pageSize.value)
			total.value = (currentPage.value + 1) * pageSize.value
		} else {
			knowledgeList.value = data
			total.value = (currentPage.value - 1) * pageSize.value + data.length
		}
	} catch (error) {
		console.error('Failed to load knowledge:', error)
		knowledgeList.value = []
		total.value = 0
	} finally {
		loading.value = false
	}
}

const handleCollectionChange = () => {
	currentPage.value = 1
	loadKnowledge()
}

const handleCollectionClear = () => {
	currentPage.value = 1
	knowledgeList.value = []
	total.value = 0
}

// 事件处理：分页
const handleSizeChange = (val: number) => {
	pageSize.value = val
	loadKnowledge()
}

const handleCurrentChange = (val: number) => {
	currentPage.value = val
	loadKnowledge()
}

// 事件处理：搜索
const handleSearch = () => {
	currentPage.value = 1 // 搜索时重置回第一页
	loadKnowledge()
}

const isRebuildSubmitDisabled = computed(
	() => fullRebuildEnabled.value && fullRebuildConfirmText.value.trim() !== FULL_REBUILD_CONFIRM_TEXT
)

// 打开重建弹窗
const handleRebuild = async () => {
	rebuildDialogVisible.value = true
}

// 关闭重建弹窗并重置状态
const closeRebuildDialog = () => {
	rebuildDialogVisible.value = false
	fullRebuildEnabled.value = false
	fullRebuildConfirmText.value = ''
}

// 确认执行重建
const confirmRebuild = async () => {
	if (isRebuildSubmitDisabled.value) {
		return
	}
	const fullRebuild = fullRebuildEnabled.value
	closeRebuildDialog()
	try {
		syncing.value = true
		const res = await syncKnowledge(fullRebuild)
		const result: KnowledgeSyncResult = res.data ?? { success: false }
		if (result.success) {
			ElMessage.success(t('kb.knowledge.rebuild.success'))
			await loadCollections()
			await loadKnowledge()
		} else {
			ElMessage.error(result.message || t('kb.knowledge.rebuild.failed'))
		}
	} catch (err: unknown) {
		const data = (err as { response?: { data?: KnowledgeSyncResult } })?.response?.data
		ElMessage.error(data?.message || t('kb.knowledge.rebuild.failed'))
	} finally {
		syncing.value = false
	}
}

onMounted(() => {
	loadCollections()
})
</script>

<style scoped lang="scss">
@use '@/styles/platform' as *;

.kb-table-container {
	font-family: Arial, sans-serif;
	height: 100%;
	min-width: 0;
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
	@include n-data-table-panel;
	// 1. 顶部工具栏
	.header-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px 16px;
		padding-bottom: 12px;
		margin-bottom: 12px;
		border-bottom: 1px solid var(--n-color-border-soft);
		flex-shrink: 0;

		.toolbar-primary {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 10px;
			min-width: 0;
			flex: 1 1 360px;
		}

		.toolbar-buttons {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
		}

		.action-collection {
			width: 260px;
			max-width: 100%;
		}

		.toolbar-search {
			display: flex;
			align-items: center;
			gap: 10px;
			flex: 0 1 auto;
			min-width: 0;
			max-width: 100%;
		}

		.action-search {
			width: 240px;
			max-width: 100%;
		}
	}

	// 3. 分页样式
	.pagination-wrapper {
		margin-top: 16px;
		display: flex;
		justify-content: flex-end;
		flex-shrink: 0; // 防止分页被压缩
	}

	.dialog-footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	// 内容预览样式
	.text-chunk-preview,
	.outline-preview {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
		color: var(--el-color-primary);
	}

	.text-chunk-full,
	.outline-full {
		max-height: 300px;
		overflow-y: auto;
	}
}
</style>
