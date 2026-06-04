<template>
	<el-dialog
		:title="t('kb.knowledge.add')"
		:close-on-click-modal="false"
		@close="handleClose"
		v-model="show"
		append-to-body
		width="1000px"
		draggable
		:loading="dialogLoading"
	>
		<div class="container">
			<el-tabs v-model="tabName" type="card">
				<el-tab-pane :label="t('kb.knowledge.add.qa')" name="qa">
					<QAForm
						ref="qaFormRef"
						@addSuccess="addSuccess"
						@loading-change="handleLoadingChange"
					/>
				</el-tab-pane>
				<el-tab-pane :label="t('kb.knowledge.add.json.template')" name="json">
					<JsonTemplateForm
						ref="jsonTemplateFormRef"
						@addSuccess="addSuccess"
						@loading-change="handleLoadingChange"
					/>
				</el-tab-pane>
			</el-tabs>
		</div>
	</el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElDialog, ElTabPane, ElTabs } from 'element-plus'
import { t } from '@ai-system/lib'
import QAForm from '@/pages/kb/components/QAForm.vue'
import JsonTemplateForm from '@/pages/kb/components/JsonTemplateForm.vue'

const qaFormRef = ref()
const jsonTemplateFormRef = ref()
const props = defineProps<{
	modelValue: boolean
}>()

const emit = defineEmits<{
	(e: 'update:modelValue', value: boolean): void
	(e: 'add-success'): void
}>()

const tabName = ref('qa')
const show = ref(props.modelValue)
const dialogLoading = ref(false) // 添加对话框加载状态

watch(
	() => props.modelValue,
	(newVal) => {
		show.value = newVal
	}
)

// 处理子组件的加载状态变化
const handleLoadingChange = (loading: boolean) => {
	dialogLoading.value = loading
}

const addSuccess = () => {
	emit('add-success')
	handleClose()
}

const handleClose = () => {
	tabName.value = 'qa'
	qaFormRef.value.clearForm()
	jsonTemplateFormRef.value.clearForm()
	emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
@use '@/styles/platform' as *;

.container {
	width: 100%;
	min-height: 500px;
	padding: 20px;
	@include n-glass-surface(2);
	border-radius: var(--n-radius-triple);
}

:deep(.el-upload-dragger) {
	padding: 20px;
}
</style>
