<template>
	<div class="hit-test-container">
		<div class="hit-test-result">
			<div class="table-wrapper">
				<div class="table-header">
					<span class="table-header-title">{{
						t('settings.rag.weight.label')
					}}</span>
					<div class="rag-weight-slider compact">
						<el-slider
							:model-value="denseWeightPercent"
							:min="0"
							:max="100"
							:show-tooltip="true"
							:format-tooltip="formatWeightTooltip"
							disabled
						/>
						<div class="rag-weight-values">
							<span
								>{{ t('settings.rag.weight.dense') }}:
								{{ denseWeightPercent }}%</span
							>
							<span
								>{{ t('settings.rag.weight.sparse') }}:
								{{ sparseWeightPercent }}%</span
							>
						</div>
					</div>
				</div>
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
						<span class="table-empty-hint">暂无检索结果</span>
					</template>
				</el-table>
			</div>
		</div>
		<div class="hit-test-form">
			<el-form ref="formRef" :model="formData" label-width="120px">
				<el-form-item
					label="Collection"
					prop="collection"
					:rules="[{ required: true, message: t('common.input.required') }]"
				>
					<el-select
						v-model="formData.collection"
						placeholder="请选择 Collection"
						clearable
						filterable
						style="width: 260px"
						:loading="collectionLoading"
						@change="retrieveResultList = []"
					>
						<el-option
							v-for="collection in collectionOptions"
							:key="collection"
							:label="collection"
							:value="collection"
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
				<el-form-item
					:label="t('kb.knowledge.hit.test.text')"
					prop="text"
					class="input-area"
					:rules="[{ required: true, message: t('common.input.required') }]"
				>
					<div class="text-input-panel">
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
						<div class="text-input-actions">
							<el-button type="primary" @click="onSubmit">提交</el-button>
						</div>
					</div>
				</el-form-item>
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
	ElSlider,
	ElTable,
	ElTableColumn,
	ElTooltip,
	ElIcon
} from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { getOutlineDisplay, getOutlineItems, isTableCellEmpty, t } from '@ai-system/lib'
import { getKnowledgeCollections, retrieveKnowledge } from '@/api/kb/kb.api'
import { getProperties } from '@/api/property.api'
import { KnowledgeRetrieveItemDto } from '@/types/kb.model'
import { QuestionFilled } from '@element-plus/icons-vue'

const KEY_RETRIEVE_DENSE_WEIGHT = 'RETRIEVE_DENSE_WEIGHT'
const KEY_RETRIEVE_SPARSE_WEIGHT = 'RETRIEVE_SPARSE_WEIGHT'

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
const collectionOptions = ref<string[]>([])

const ragWeights = ref({
	denseWeight: 0.5,
	sparseWeight: 0.5
})

const normalizeRagWeights = () => {
	const dense = ragWeights.value.denseWeight
	const sparse = ragWeights.value.sparseWeight
	const total = dense + sparse
	if (!Number.isFinite(total) || total <= 0) {
		ragWeights.value.denseWeight = 0.5
		ragWeights.value.sparseWeight = 0.5
		return
	}
	ragWeights.value.denseWeight = dense / total
	ragWeights.value.sparseWeight = sparse / total
}

const parseNumber = (value: string | undefined, fallback: number) => {
	if (value === undefined || value === null) {
		return fallback
	}
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : fallback
}

const resolvePropertyMap = (res: any) => {
	if (res?.data?.data) {
		return res.data.data
	}
	return res?.data ?? {}
}

const denseWeightPercent = computed(() =>
	Math.round(ragWeights.value.denseWeight * 100)
)
const sparseWeightPercent = computed(() => 100 - denseWeightPercent.value)
const formatWeightTooltip = (value: number) => {
	const densePercent = Math.min(100, Math.max(0, Math.round(value)))
	const sparsePercent = 100 - densePercent
	return `${t('settings.rag.weight.dense')}: ${densePercent}% / ${t(
		'settings.rag.weight.sparse'
	)}: ${sparsePercent}%`
}

const loadCollections = async () => {
	collectionLoading.value = true
	try {
		const response = await getKnowledgeCollections()
		collectionOptions.value = response.data?.data || []
	} catch (error) {
		console.error('加载知识库 Collection 失败:', error)
		collectionOptions.value = []
	} finally {
		collectionLoading.value = false
	}
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
				console.error('检索知识库失败:', error)
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

const loadRagWeights = async () => {
	try {
		const res = await getProperties([
			KEY_RETRIEVE_DENSE_WEIGHT,
			KEY_RETRIEVE_SPARSE_WEIGHT
		])
		const data = resolvePropertyMap(res)
		ragWeights.value.denseWeight = parseNumber(
			KEY_RETRIEVE_DENSE_WEIGHT in data
				? data[KEY_RETRIEVE_DENSE_WEIGHT]
				: undefined,
			ragWeights.value.denseWeight
		)
		ragWeights.value.sparseWeight = parseNumber(
			KEY_RETRIEVE_SPARSE_WEIGHT in data
				? data[KEY_RETRIEVE_SPARSE_WEIGHT]
				: undefined,
			ragWeights.value.sparseWeight
		)
		normalizeRagWeights()
	} catch (error) {
		console.error('加载检索权重失败:', error)
	}
}

onMounted(() => {
	loadCollections()
	loadRagWeights()
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

			.table-header {
				display: flex;
				align-items: center;
				justify-content: flex-start;
				gap: 12px;
				padding: 8px 12px;
				flex-shrink: 0;
				border-bottom: 1px solid var(--n-color-border-soft);
				background-color: transparent;

				.table-header-title {
					font-weight: 600;
					color: var(--n-color-text-primary);
					white-space: nowrap;
				}

				.rag-weight-slider {
					flex: 0 0 auto;
				}
			}

			.rag-weight-slider {
				width: 280px;

				:deep(.el-slider__runway) {
					background-color: #f4a340;
				}

				:deep(.el-slider__bar) {
					background-color: var(--el-slider-main-bg-color);
				}

				.rag-weight-values {
					display: flex;
					justify-content: space-between;
					margin-top: 4px;
					color: var(--n-color-text-muted);
					font-size: 12px;
				}

				&.compact {
					.rag-weight-values {
						margin-top: 2px;
					}
				}
			}
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

		:deep(.el-form) {
			display: flex;
			flex-wrap: wrap;
			gap: 0 24px;
		}

		:deep(.el-form-item) {
			margin-bottom: 12px;
		}

		:deep(.el-form-item__label) {
			color: var(--n-color-text-primary);
			justify-content: flex-start;
		}

		.top-k-input {
			width: 100px;

			:deep(.el-input__wrapper) {
				height: 40px;
				background: var(--n-color-bg-glass-weak) !important;
			}

			:deep(.el-input-number) {
				width: 100%;

				.el-input__inner {
					text-align: left;
				}
			}
		}

		.input-area {
			flex: 1 1 100%;
			margin-bottom: 0;

			:deep(.el-form-item__content) {
				width: 100%;
			}
		}

		.text-input-panel {
			width: 100%;
			display: flex;
			flex-direction: column;
			gap: 10px;
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
		}
	}
}
</style>
