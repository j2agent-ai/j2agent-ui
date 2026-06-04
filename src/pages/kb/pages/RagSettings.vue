<template>
	<div class="rag-settings-page" v-loading="loading">
		<RagSettingsPanel
			:form="ragForm"
			:saving="saving"
			show-title
			@save="saveRagSettings"
		/>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { t } from '@ai-system/lib'
import RagSettingsPanel from '@/pages/settings/components/RagSettingsPanel.vue'
import { getProperties, putProperties } from '@/api/property.api'

const KEY_RETRIEVE_TOP_K = 'RETRIEVE_TOP_K'
const KEY_RETRIEVE_METRIC_TYPE = 'RETRIEVE_METRIC_TYPE'
const KEY_RETRIEVE_METRIC_SCORE_COMPARE_EXPR = 'RETRIEVE_METRIC_SCORE_COMPARE_EXPR'
const KEY_RETRIEVE_DENSE_WEIGHT = 'RETRIEVE_DENSE_WEIGHT'
const KEY_RETRIEVE_SPARSE_WEIGHT = 'RETRIEVE_SPARSE_WEIGHT'

const loading = ref(false)
const saving = ref(false)

const ragForm = ref({
	topK: 5,
	metricType: 'COSINE',
	metricScoreExpr: '> 0.7',
	denseWeight: 0.5,
	sparseWeight: 0.5
})
const ragMetricSnapshot = ref(ragForm.value.metricType)

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

const loadRagSettings = async () => {
	loading.value = true
	try {
		const res = await getProperties([
			KEY_RETRIEVE_TOP_K,
			KEY_RETRIEVE_METRIC_TYPE,
			KEY_RETRIEVE_METRIC_SCORE_COMPARE_EXPR,
			KEY_RETRIEVE_DENSE_WEIGHT,
			KEY_RETRIEVE_SPARSE_WEIGHT
		])
		const data = resolvePropertyMap(res)
		ragForm.value.topK = parseNumber(
			KEY_RETRIEVE_TOP_K in data ? data[KEY_RETRIEVE_TOP_K] : undefined,
			ragForm.value.topK
		)
		ragForm.value.metricType =
			data[KEY_RETRIEVE_METRIC_TYPE] || ragForm.value.metricType
		ragForm.value.metricScoreExpr =
			data[KEY_RETRIEVE_METRIC_SCORE_COMPARE_EXPR] || ragForm.value.metricScoreExpr
		ragForm.value.denseWeight = parseNumber(
			KEY_RETRIEVE_DENSE_WEIGHT in data ? data[KEY_RETRIEVE_DENSE_WEIGHT] : undefined,
			ragForm.value.denseWeight
		)
		ragForm.value.sparseWeight = parseNumber(
			KEY_RETRIEVE_SPARSE_WEIGHT in data ? data[KEY_RETRIEVE_SPARSE_WEIGHT] : undefined,
			ragForm.value.sparseWeight
		)
		normalizeRagWeights()
		ragMetricSnapshot.value = ragForm.value.metricType
	} catch (error) {
		ElMessage.error(t('settings.load.failed'))
	} finally {
		loading.value = false
	}
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

const saveRagSettings = async () => {
	saving.value = true
	try {
		if (isRagMetricTypeChanged()) {
			await confirmEmbeddingRebuild()
		}
		normalizeRagWeights()
		await putProperties([
			{ propertyName: KEY_RETRIEVE_TOP_K, propertyValue: String(ragForm.value.topK) },
			{ propertyName: KEY_RETRIEVE_METRIC_TYPE, propertyValue: ragForm.value.metricType },
			{
				propertyName: KEY_RETRIEVE_METRIC_SCORE_COMPARE_EXPR,
				propertyValue: ragForm.value.metricScoreExpr
			},
			{ propertyName: KEY_RETRIEVE_DENSE_WEIGHT, propertyValue: String(ragForm.value.denseWeight) },
			{ propertyName: KEY_RETRIEVE_SPARSE_WEIGHT, propertyValue: String(ragForm.value.sparseWeight) }
		])
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

onMounted(() => {
	loadRagSettings()
})
</script>

<style scoped lang="scss">
@use '@/styles/platform' as *;

.rag-settings-page {
	padding: 20px;
	@include n-glass-surface(2);
	border-radius: var(--n-radius-triple);
}
</style>
