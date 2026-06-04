<template>
	<el-dialog
		:title="t('kb.knowledge.edit')"
		:close-on-click-modal="false"
		@close="handleClose"
		v-model="show"
		append-to-body
		width="800px"
		draggable
		:loading="dialogLoading"
	>
		<div class="container">
			<QAForm
				ref="qaFormRef"
				@addSuccess="editSuccess"
				@loading-change="handleLoadingChange"
			/>
		</div>
	</el-dialog>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { ElDialog } from 'element-plus'
import { t } from '@ai-system/lib'
import QAForm from '@/pages/kb/components/QAForm.vue'
import { KnowledgeDto } from '@/types/kb.model'

const qaFormRef = ref()
const props = defineProps<{
	modelValue: boolean
	knowledge?: KnowledgeDto | null
}>()

const emit = defineEmits<{
	(e: 'update:modelValue', value: boolean): void
	(e: 'edit-success'): void
}>()

const show = ref(props.modelValue)
const dialogLoading = ref(false)

const syncFormData = async () => {
	if (!show.value || !props.knowledge) return
	await nextTick()
	qaFormRef.value?.setFormData(props.knowledge)
}

watch(
	() => props.modelValue,
	(newVal) => {
		show.value = newVal
		if (newVal) {
			syncFormData()
		}
	}
)

watch(
	() => props.knowledge,
	() => {
		syncFormData()
	}
)

const handleLoadingChange = (loading: boolean) => {
	dialogLoading.value = loading
}

const editSuccess = () => {
	emit('edit-success')
	handleClose()
}

const handleClose = () => {
	qaFormRef.value?.clearForm()
	emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
@use '@/styles/platform' as *;

.container {
	width: 100%;
	min-height: 320px;
	padding: 20px;
	@include n-glass-surface(2);
	border-radius: var(--n-radius-triple);
}
</style>
