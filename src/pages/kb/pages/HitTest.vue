<template>
	<div class="hit-test-container">
		<div class="hit-test-result">
			<div class="table-wrapper">
				<el-table
					ref="tableRef"
					:data="retrieveResultList"
					class="kb-data-table"
					style="width: 100%; height: 100%"
					v-loading="loading"
					stripe
				>
					<el-table-column :label="t('kb.outline')" width="300" align="center">
						<template #default="{ row }">
							<template v-if="!isTableCellEmpty(row.outline)">
								<el-popover
									effect="dark"
									trigger="hover"
									placement="top"
									width="400"
								>
									<template #reference>
										<div class="outline-preview">
											{{ getOutlineDisplay(row.outline) }}
										</div>
									</template>
									<div class="outline-full">
										<div
											v-for="(item, index) in getOutlineItems(row.outline)"
											:key="index"
										>
											{{ index + 1 }}. {{ item }}
										</div>
									</div>
								</el-popover>
							</template>
							<span v-else class="empty-text">-</span>
						</template>
					</el-table-column>
					<el-table-column
						:label="t('kb.knowledge.hit.test.dense.metric')"
						min-width="180"
						align="center"
					>
						<template #default="{ row }">
							<span v-if="isTableCellEmpty(row.denseMetricType)" class="empty-text">-</span>
							<span v-else>{{ row.denseMetricType }}</span>
						</template>
					</el-table-column>
					<el-table-column
						:label="t('kb.knowledge.hit.test.dense.score')"
						width="170"
						align="center"
					>
						<template #header>
							<div class="header-with-tooltip">
								<span>{{ t('kb.knowledge.hit.test.dense.score') }}</span>
								<el-tooltip
									effect="dark"
									placement="top"
									:raw-content="true"
									:content="t('kb.knowledge.hit.test.dense.score.tip')"
								>
									<el-icon class="info-icon">
										<QuestionFilled />
									</el-icon>
								</el-tooltip>
							</div>
						</template>
						<template #default="{ row }">
							<span v-if="!Number.isFinite(row.denseScore)" class="empty-text">-</span>
							<span v-else>{{ row.denseScore.toFixed(4) }}</span>
						</template>
					</el-table-column>
					<el-table-column
						:label="t('kb.knowledge.hit.test.sparse.metric')"
						min-width="180"
						align="center"
					>
						<template #default="{ row }">
							<span v-if="isTableCellEmpty(row.sparseMetricType)" class="empty-text">-</span>
							<span v-else>{{ row.sparseMetricType }}</span>
						</template>
					</el-table-column>
					<el-table-column
						:label="t('kb.knowledge.hit.test.sparse.score')"
						width="170"
						align="center"
					>
						<template #header>
							<div class="header-with-tooltip">
								<span>{{ t('kb.knowledge.hit.test.sparse.score') }}</span>
								<el-tooltip
									effect="dark"
									placement="top"
									:raw-content="true"
									:content="t('kb.knowledge.hit.test.sparse.score.tip')"
								>
									<el-icon class="info-icon">
										<QuestionFilled />
									</el-icon>
								</el-tooltip>
							</div>
						</template>
						<template #default="{ row }">
							<span v-if="!Number.isFinite(row.sparseScore)" class="empty-text">-</span>
							<span v-else>{{ row.sparseScore.toFixed(4) }}</span>
						</template>
					</el-table-column>
					<el-table-column
						:label="t('kb.knowledge.hit.test.hybrid.score')"
						width="170"
						align="center"
					>
						<template #default="{ row }">
							<span
								v-if="!Number.isFinite(row.hybridScore ?? row.score)"
								class="empty-text"
							>-</span>
							<span v-else>{{ (row.hybridScore ?? row.score)!.toFixed(4) }}</span>
						</template>
					</el-table-column>
					<el-table-column
						:label="t('kb.knowledge.hit.test.is.hit')"
						width="150"
						align="center"
					>
						<template #default="{ row }">
							{{ row.isFiltered ? t('common.no') : t('common.yes') }}
						</template>
					</el-table-column>
					<el-table-column :label="t('kb.textChunk')" width="400">
						<template #default="{ row }">
							<template v-if="!isTableCellEmpty(row.textChunk)">
								<el-popover
									effect="dark"
									trigger="hover"
									placement="top"
									width="400"
								>
									<template #reference>
										<div class="text-chunk-preview">
											{{ row.textChunk }}
										</div>
									</template>
									<div class="text-chunk-full">{{ row.textChunk }}</div>
								</el-popover>
							</template>
							<span v-else class="empty-text">-</span>
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
					<template #empty>
						<span class="table-empty-hint">{{ t('kb.knowledge.hit.test.empty') }}</span>
					</template>
				</el-table>
			</div>
		</div>
		<div class="hit-test-form">
			<el-form ref="formRef" :model="formData" label-width="120px" class="hit-test-form__body">
				<div class="hit-test-form__row">
					<el-form-item
						label="Collection"
						prop="collection"
						:rules="[{ required: true, message: t('common.input.required') }]"
					>
						<el-select
							v-model="formData.collection"
							:placeholder="t('kb.collection.select.placeholder')"
							clearable
							filterable
							class="collection-select"
							:loading="collectionLoading"
							@change="retrieveResultList = []"
						>
							<el-option
								v-for="collection in collectionOptions"
								:key="collection.collection"
								:label="formatCollectionLabel(collection)"
								:value="collection.collection"
							/>
						</el-select>
					</el-form-item>
					<el-form-item
						label="TOP-K"
						prop="topK"
						:rules="[{ required: true, message: t('common.input.required') }]"
					>
						<el-input-number
							class="top-k-input"
							v-model="formData.topK"
							:min="1"
							:max="15"
							controls-position="right"
						/>
					</el-form-item>
				</div>
				<el-form-item
					:label="t('kb.knowledge.hit.test.text')"
					prop="text"
					class="input-area"
					:rules="[{ required: true, message: t('common.input.required') }]"
				>
					<ElInput
						v-model="formData.text"
						class="text-input"
						:placeholder="t('kb.knowledge.hit.test.text.placeholder')"
						type="textarea"
						:rows="4"
						:maxlength="32768"
						show-word-limit
						@keydown="handleKeydown"
						@input="handleInput"
						@keyup="handleKeyup"
					/>
				</el-form-item>
				<div class="text-input-actions">
					<el-button type="primary" @click="onSubmit">
						{{ t('common.submit') }}
					</el-button>
				</div>
			</el-form>
		</div>
	</div>
</template>

<script setup lang="ts">
import {
	ElButton,
	ElForm,
	ElFormItem,
	ElInput,
	ElInputNumber,
	ElPopover,
	ElOption,
	ElSelect,
	ElTable,
	ElTableColumn,
	ElTooltip,
	ElIcon
} from 'element-plus'
import { onMounted, ref } from 'vue'
import { getOutlineDisplay, getOutlineItems, isTableCellEmpty, t } from '@ai-system/lib'
import { getKnowledgeCollections, retrieveKnowledge } from '@/api/kb/kb.api'
import type { KnowledgeCollectionDto, KnowledgeRetrieveItemDto } from '@/types/kb.model'
import { QuestionFilled } from '@element-plus/icons-vue'

// 表单数据
const formData = ref({
	collection: '',
	text: '',
	topK: 5
})

// 表单引用
const formRef = ref<InstanceType<typeof ElForm>>()

const loading = ref(false)
const collectionLoading = ref(false)
const retrieveResultList = ref<KnowledgeRetrieveItemDto[]>([])
const collectionOptions = ref<KnowledgeCollectionDto[]>([])

const loadCollections = async () => {
	collectionLoading.value = true
	try {
		const response = await getKnowledgeCollections()
		const body = response.data as { data?: KnowledgeCollectionDto[] } | undefined
		collectionOptions.value = dedupeCollectionOptions(
			(body?.data ?? []).filter((item) => Boolean(item.collection?.trim()))
		)
	} catch (error) {
		console.error('Failed to load knowledge collections:', error)
		collectionOptions.value = []
	} finally {
		collectionLoading.value = false
	}
}

/** 按 collection 去重，保留首次出现的选项 */
const dedupeCollectionOptions = (items: KnowledgeCollectionDto[]) => {
	const optionByCollection = new Map<string, KnowledgeCollectionDto>()
	for (const item of items) {
		const collection = item.collection?.trim()
		if (collection && !optionByCollection.has(collection)) {
			optionByCollection.set(collection, item)
		}
	}
	return [...optionByCollection.values()]
}

/** 格式化 collection 下拉展示名 */
const formatCollectionLabel = (collection: KnowledgeCollectionDto) => {
	const value = collection.collection?.trim()
	const name = collection.name?.trim()
	return name && value && name !== value ? `${name} (${value})` : value || name || ''
}

const onSubmit = async () => {
	if (!formRef.value) return
	await formRef.value.validate(async (valid) => {
		if (valid) {
			try {
				loading.value = true
				const response = await retrieveKnowledge(
					formData.value.text,
					formData.value.topK,
					formData.value.collection
				)
				retrieveResultList.value = response.data?.data || []
			} catch (error) {
				console.error('Failed to retrieve knowledge:', error)
			} finally {
				loading.value = false
			}
		}
	})
}
let send: boolean = true

const handleKeydown = (event: KeyboardEvent) => {
	if (event.key === 'Enter' && !event.shiftKey) {
		send = true
		event.preventDefault()
	}
}

const handleInput = () => {
	send = false
}

const handleKeyup = () => {
	if (send) {
		send = false
		onSubmit()
	}
}

onMounted(() => {
	loadCollections()
})
</script>

<style scoped lang="scss">
@use '@/styles/platform' as *;

.hit-test-container {
	font-family: Arial, sans-serif;
	height: 100%;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 16px;

	.header-with-tooltip {
		display: flex;
		align-items: center;
		gap: 4px;
		white-space: nowrap;
	}

	.hit-test-result {
		@include n-data-table-panel;
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
		min-height: 240px;
		overflow: hidden;

		.table-wrapper {
			border-radius: var(--n-radius-triple);
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

	.hit-test-form {
		flex-shrink: 0;
		padding: 16px 20px;
		box-sizing: border-box;
		@include n-glass-surface(2);
		border-radius: var(--n-radius-triple);

		:deep(.hit-test-form__body.el-form) {
			display: block;
		}

		.hit-test-form__row {
			display: flex;
			flex-wrap: wrap;
			align-items: flex-start;
			gap: 0 24px;
		}

		:deep(.el-form-item) {
			margin-bottom: 18px;
		}

		:deep(.el-form-item__label) {
			color: var(--n-color-text-primary);
			justify-content: flex-start;
		}

		/* 错误信息贴在控件下方、与内容列左对齐 */
		:deep(.el-form-item__error) {
			padding-top: 2px;
			left: 0;
		}

		.collection-select {
			width: 260px;
		}

		.top-k-input {
			width: 100px;

			:deep(.el-input-number) {
				width: 100%;

				.el-input__inner {
					text-align: left;
				}
			}
		}

		.input-area {
			width: 100%;
			margin-bottom: 8px;

			:deep(.el-form-item__content) {
				width: 100%;
			}

			:deep(.el-form-item__label) {
				align-items: flex-start;
				line-height: 32px;
			}
		}

		.text-input {
			width: 100%;

			:deep(.el-textarea__inner) {
				background: var(--n-table-row-bg);
				padding: 12px 16px;
				border-radius: var(--n-radius-triple);
				word-wrap: break-word;
				word-break: break-all;
				border: 1px solid var(--n-color-border-control);
				box-shadow: none;
				resize: vertical;
				min-height: 96px;
			}

			:deep(.el-input__count) {
				background: transparent;
			}
		}

		.text-input-actions {
			display: flex;
			justify-content: flex-end;
			/* 与 label-width 对齐，按钮落在内容列右侧 */
			padding-left: 120px;
			box-sizing: border-box;
		}
	}
}
</style>
