<template>
	<el-dialog
		v-model="visible"
		:title="t('kb.repository.tasks.title')"
		width="min(760px, calc(100vw - 32px))"
		class="resource-dialog"
		append-to-body
		align-center
		@open="load"
	>
		<div class="resource-dialog-content">
			<div class="resource-context">
				<span>{{ t('kb.repository.tasks.current') }}</span
				><code>{{ resourceName || resourceId }}</code>
			</div>
			<section class="resource-section" v-loading="loading">
				<div class="resource-section-heading">
					<h3>
						{{ t('kb.repository.tasks.recent') }}
						<el-tag size="small" type="info" round>{{ tasks.length }}</el-tag>
					</h3>
					<el-button :loading="loading" @click="load">{{
						t('common.refresh')
					}}</el-button>
				</div>
				<p>{{ t('kb.repository.tasks.hint') }}</p>
				<el-alert
					v-if="error"
					class="task-error"
					:title="t('kb.repository.tasks.load.failed')"
					type="error"
					show-icon
					:closable="false"
				/>
				<el-empty
					v-else-if="!loading && !tasks.length"
					:image-size="72"
					:description="t('kb.repository.tasks.empty')"
				/>
				<ol v-else class="task-list">
					<li v-for="task in tasks" :key="task.id" class="task-item">
						<div class="task-heading">
							<strong>{{ operationLabel(task.operation) }}</strong
							><el-tag :type="statusType(task.status)" size="small">{{
								statusLabel(task.status)
							}}</el-tag>
						</div>
						<div class="task-meta">
							<span>{{
								t('kb.repository.tasks.submittedAt', {
									time: formatTime(task.createdAt)
								})
							}}</span
							><span>{{
								t('kb.repository.tasks.updatedAt', {
									time: formatTime(task.updatedAt)
								})
							}}</span>
						</div>
						<code class="task-id">{{ task.id }}</code>
						<div v-if="task.errorMessage" class="task-failure">
							{{ task.errorMessage }}
						</div>
					</li>
				</ol>
			</section>
		</div>
		<template #footer>
			<div class="resource-dialog-footer">
				<span>{{ t('kb.repository.tasks.footer') }}</span>
				<el-button @click="visible = false">{{ t('common.close') }}</el-button>
			</div>
		</template>
	</el-dialog>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import http from '@ai-system/http/loginInterceptor'
import { globalUrlPrefix, programTag } from '@/oem.js'
import { t } from '@ai-system/lib'
import '@/styles/resource-management.scss'
const props = defineProps<{
	modelValue: boolean
	resourceId: string
	resourceName?: string
}>()
const emit = defineEmits(['update:modelValue'])
const visible = computed({
	get: () => props.modelValue,
	set: (value) => emit('update:modelValue', value)
})
interface Task {
	id: string
	operation: string
	status: string
	createdAt?: string | number
	updatedAt?: string | number
	errorMessage?: string
}
const tasks = ref<Task[]>([]),
	loading = ref(false),
	error = ref(false)
async function load() {
	tasks.value = []
	loading.value = true
	error.value = false
	try {
		const response = await http.get<Task[]>(
			`/v1${globalUrlPrefix}rest/${programTag}/knowledge/repositories/${encodeURIComponent(
				props.resourceId
			)}/tasks`
		)
		tasks.value = response.data
	} catch {
		error.value = true
	} finally {
		loading.value = false
	}
}
const formatTime = (value?: string | number) =>
	value ? new Date(value).toLocaleString() : '—'
/** 任务操作类型文案 */
const operationLabel = (operation: string) => {
	const key = `kb.repository.tasks.operation.${operation}`
	const label = t(key)
	return label === key ? operation : label
}
const statusLabel = (status: string) => {
	const key = `kb.repository.tasks.status.${status}`
	const label = t(key)
	return label === key ? status : label
}
const statusType = (status: string) =>
	status === 'FAILED'
		? 'danger'
		: status === 'COMPLETED'
			? 'success'
			: status === 'RUNNING'
				? 'warning'
				: 'info'
</script>
<style scoped lang="scss">
.task-list {
	list-style: none;
	padding: 0;
	margin: 20px 0 0;
}
.task-item {
	padding: 16px 0;
	border-top: 1px solid var(--n-color-border-soft);
}
.task-item:last-child {
	padding-bottom: 0;
}
.task-heading {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	font-size: 14px;
}
.task-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 6px 20px;
	margin-top: 10px;
	font-size: 12px;
	line-height: 1.6;
	color: var(--n-color-text-muted);
}
.task-id {
	display: block;
	margin-top: 6px;
	font-size: 11px;
	color: var(--n-color-text-muted);
	overflow-wrap: anywhere;
}
.task-failure {
	margin-top: 12px;
	padding: 10px 12px;
	border-radius: 8px;
	background: var(--el-color-danger-light-9);
	color: var(--el-color-danger);
	font-size: 12px;
	line-height: 1.7;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}
.task-error {
	margin-top: 16px;
}
</style>
