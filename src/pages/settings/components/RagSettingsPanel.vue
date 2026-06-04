<template>
	<div>
		<div v-if="showTitle" class="section-title">{{ t('settings.rag.section') }}</div>
		<el-form :model="form" label-width="220px">
			<el-form-item :label="t('settings.rag.topk')">
				<el-input-number v-model="form.topK" :min="1" />
			</el-form-item>
			<el-form-item :label="t('settings.rag.metric.type.dense')">
				<el-select v-model="form.metricType" class="settings-select">
					<el-option label="COSINE" value="COSINE" />
					<el-option label="IP" value="IP" />
					<el-option label="L2" value="L2" />
				</el-select>
			</el-form-item>
			<el-form-item :label="t('settings.rag.metric.type.sparse')">
				<el-select :model-value="'BM25'" class="settings-select" disabled>
					<el-option label="BM25" value="BM25" />
				</el-select>
			</el-form-item>
			<el-form-item :label="t('settings.rag.weight.label')">
				<div class="rag-weight-slider">
					<el-slider
						v-model="denseWeightPercent"
						:min="0"
						:max="100"
						:show-tooltip="true"
						:format-tooltip="formatWeightTooltip"
					/>
					<div class="rag-weight-values">
						<span>{{ t('settings.rag.weight.dense') }}: {{ denseWeightPercent }}%</span>
						<span>{{ t('settings.rag.weight.sparse') }}: {{ 100 - denseWeightPercent }}%</span>
					</div>
				</div>
			</el-form-item>
			<el-form-item :label="t('settings.rag.metric.score.expr')">
				<el-input v-model="form.metricScoreExpr" />
			</el-form-item>
		</el-form>
		<div class="settings-actions">
			<el-button type="primary" :loading="saving" @click="emit('save')">
				{{ t('settings.save') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, toRef, withDefaults } from 'vue'
import {
	ElButton,
	ElForm,
	ElFormItem,
	ElInput,
	ElInputNumber,
	ElOption,
	ElSelect,
	ElSlider
} from 'element-plus'
import { t } from '@ai-system/lib'

type RagForm = {
	topK: number
	metricType: string
	metricScoreExpr: string
	denseWeight: number
	sparseWeight: number
}

const props = withDefaults(
	defineProps<{
		form: RagForm
		saving: boolean
		showTitle?: boolean
	}>(),
	{
		showTitle: false
	}
)

const emit = defineEmits<{
	(e: 'save'): void
}>()

const form = toRef(props, 'form')
const saving = toRef(props, 'saving')

const denseWeightPercent = computed({
	get: () => Math.round(form.value.denseWeight * 100),
	set: (value: number) => {
		const clamped = Math.min(100, Math.max(0, value))
		form.value.denseWeight = clamped / 100
		form.value.sparseWeight = (100 - clamped) / 100
	}
})

const formatWeightTooltip = (value: number) => {
	const densePercent = Math.min(100, Math.max(0, Math.round(value)))
	const sparsePercent = 100 - densePercent
	return `${t('settings.rag.weight.dense')}: ${densePercent}% / ${t('settings.rag.weight.sparse')}: ${sparsePercent}%`
}
</script>

<style scoped lang="scss">
.section-title {
	margin-bottom: 12px;
	font-weight: 600;
	color: var(--n-color-text-primary);
}

.settings-select {
	width: 240px;
}

.rag-weight-slider {
	width: 320px;

	:deep(.el-slider__runway) {
		background-color: #f4a340;
	}

	.rag-weight-values {
		display: flex;
		justify-content: space-between;
		margin-top: 6px;
		color: var(--n-color-text-primary);
		font-size: 12px;
	}
}

.settings-actions {
	display: flex;
	justify-content: flex-end;
	margin-top: 10px;
	padding-bottom: 10px;
}
</style>
