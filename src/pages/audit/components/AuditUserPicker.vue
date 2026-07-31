<template>
	<div class="audit-user-picker">
		<div
			class="audit-user-picker__trigger"
			role="button"
			tabindex="0"
			@click="openDialog"
			@keydown.enter.prevent="openDialog"
		>
			<span
				class="audit-user-picker__label"
				:class="{ 'is-placeholder': !displayName }"
			>
				{{ displayName || placeholder }}
			</span>
			<button
				v-if="clearable && modelValue"
				type="button"
				class="audit-user-picker__clear"
				:aria-label="t('common.cancel')"
				@click.stop="clearSelection"
			>
				×
			</button>
			<span class="audit-user-picker__caret" aria-hidden="true" />
		</div>

		<el-dialog
			v-model="visible"
			:title="t('audit.user.picker.title')"
			width="560px"
			align-center
			append-to-body
			class="audit-user-picker-dialog"
			@opened="onOpened"
		>
			<div class="picker-body">
				<div class="picker-toolbar">
					<el-input
						v-model="keywordInput"
						clearable
						:placeholder="t('audit.user.picker.search')"
						@keyup.enter="applySearch"
						@clear="clearSearch"
					>
						<template #prefix>
							<button
								type="button"
								class="picker-search-icon"
								:aria-label="t('common.search')"
								@click="applySearch"
							>
								<el-icon><Search /></el-icon>
							</button>
						</template>
					</el-input>
					<el-button type="primary" :icon="Search" @click="applySearch">
						{{ t('common.search') }}
					</el-button>
					<el-button :icon="Refresh" :loading="loading" @click="loadUsers">
						{{ t('common.refresh') }}
					</el-button>
				</div>

				<div v-loading="loading" class="picker-list">
					<button
						v-for="user in pagedUsers"
						:key="user.userId"
						type="button"
						class="picker-item"
						:class="{ 'is-active': user.userId === modelValue }"
						@click="selectUser(user)"
					>
						<div class="picker-item__main">
							<div class="picker-item__name">{{ user.username }}</div>
							<div class="picker-item__meta">
								<span>{{ roleLabel(user.role) }}</span>
								<span v-if="user.email" class="dot">·</span>
								<span v-if="user.email" class="email">{{ user.email }}</span>
							</div>
							<div class="picker-item__id">{{ user.userId }}</div>
						</div>
						<span class="picker-item__action">
							{{
								user.userId === modelValue
									? t('audit.user.picker.current')
									: t('audit.user.picker.select')
							}}
						</span>
					</button>

					<div v-if="!loading && filteredUsers.length === 0" class="picker-empty">
						{{ t('audit.user.picker.empty') }}
					</div>
				</div>

				<div class="picker-footer">
					<el-pagination
						v-model:current-page="page"
						v-model:page-size="pageSize"
						:total="filteredUsers.length"
						:page-sizes="[8, 16, 32]"
						layout="total, sizes, prev, pager, next"
						small
					/>
				</div>
			</div>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { computed, onDeactivated, ref, watch } from 'vue'
import { Refresh, Search } from '@element-plus/icons-vue'
import {
	ElButton,
	ElDialog,
	ElIcon,
	ElInput,
	ElMessage,
	ElPagination
} from 'element-plus'
import { t } from '@ai-system/lib'
import { getUserList, type UserDto } from '@/api/user.api'
import { ROLE_ADMIN, ROLE_KB_ADMIN } from '@/utils/role'

const props = withDefaults(
	defineProps<{
		/** 已选用户 ID */
		modelValue?: string
		/** 已选用户名（外部可同步展示） */
		username?: string
		placeholder?: string
		clearable?: boolean
	}>(),
	{
		modelValue: undefined,
		username: undefined,
		placeholder: undefined,
		clearable: false
	}
)

const emit = defineEmits<{
	'update:modelValue': [value: string | undefined]
	'update:username': [value: string | undefined]
	change: [user: UserDto | null]
}>()

const visible = ref(false)
const loading = ref(false)
const users = ref<UserDto[]>([])
/** 输入框内容（未提交） */
const keywordInput = ref('')
/** 已生效的搜索关键字 */
const appliedKeyword = ref('')
const page = ref(1)
const pageSize = ref(8)

const displayName = computed(() => props.username || '')

const placeholder = computed(
	() => props.placeholder || t('audit.filter.user.required')
)

const filteredUsers = computed(() => {
	const q = appliedKeyword.value.trim().toLowerCase()
	if (!q) {
		return users.value
	}
	return users.value.filter((u) => {
		const name = (u.username || '').toLowerCase()
		const email = (u.email || '').toLowerCase()
		const id = (u.userId || '').toLowerCase()
		return name.includes(q) || email.includes(q) || id.includes(q)
	})
})

const pagedUsers = computed(() => {
	const start = (page.value - 1) * pageSize.value
	return filteredUsers.value.slice(start, start + pageSize.value)
})

watch(filteredUsers, (list) => {
	const maxPage = Math.max(1, Math.ceil(list.length / pageSize.value) || 1)
	if (page.value > maxPage) {
		page.value = maxPage
	}
})

function roleLabel(role: number) {
	if (role === ROLE_ADMIN) {
		return t('user.management.role.admin')
	}
	if (role === ROLE_KB_ADMIN) {
		return t('user.management.role.kbAdmin')
	}
	return t('user.management.role.user')
}

/** 回车 / 点击搜索：提交关键字并回到第一页 */
function applySearch() {
	appliedKeyword.value = keywordInput.value.trim()
	page.value = 1
}

/** 清空输入时同时清除已生效搜索 */
function clearSearch() {
	keywordInput.value = ''
	appliedKeyword.value = ''
	page.value = 1
}

async function loadUsers() {
	loading.value = true
	try {
		const res = await getUserList()
		users.value = res.data?.data || []
	} catch {
		ElMessage.error(t('audit.load.users.failed'))
	} finally {
		loading.value = false
	}
}

function openDialog() {
	visible.value = true
}

async function onOpened() {
	if (!users.value.length) {
		await loadUsers()
	}
	if (props.modelValue) {
		const idx = filteredUsers.value.findIndex((u) => u.userId === props.modelValue)
		if (idx >= 0) {
			page.value = Math.floor(idx / pageSize.value) + 1
		}
	}
}

/** keep-alive 切走侧栏时仅隐藏弹窗，保留搜索/分页/列表状态 */
onDeactivated(() => {
	visible.value = false
})

/** 单击条目即选中并关闭 */
function selectUser(user: UserDto) {
	emit('update:modelValue', user.userId)
	emit('update:username', user.username)
	emit('change', user)
	visible.value = false
}

function clearSelection() {
	emit('update:modelValue', undefined)
	emit('update:username', undefined)
	emit('change', null)
}
</script>

<style scoped lang="scss">
@use '@/styles/platform' as *;

.audit-user-picker {
	display: inline-flex;
}

.audit-user-picker__trigger {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	min-width: 200px;
	max-width: 280px;
	height: 32px;
	padding: 0 10px 0 12px;
	box-sizing: border-box;
	border: 1px solid var(--el-border-color);
	border-radius: var(--el-border-radius-base);
	background: var(--el-fill-color-blank);
	cursor: pointer;
	transition: border-color 0.15s ease;

	&:hover,
	&:focus {
		border-color: var(--el-color-primary);
		outline: none;
	}
}

.audit-user-picker__label {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 14px;
	color: var(--el-text-color-regular);
	text-align: left;

	&.is-placeholder {
		color: var(--el-text-color-placeholder);
	}
}

.audit-user-picker__clear {
	flex-shrink: 0;
	width: 16px;
	height: 16px;
	padding: 0;
	border: 0;
	border-radius: 50%;
	background: var(--el-text-color-placeholder);
	color: #fff;
	line-height: 14px;
	font-size: 12px;
	cursor: pointer;

	&:hover {
		background: var(--el-text-color-secondary);
	}
}

.audit-user-picker__caret {
	flex-shrink: 0;
	width: 0;
	height: 0;
	margin-left: 2px;
	border-left: 4px solid transparent;
	border-right: 4px solid transparent;
	border-top: 5px solid var(--el-text-color-placeholder);
}

.picker-body {
	display: flex;
	flex-direction: column;
	gap: 12px;
	min-height: 0;
}

.picker-toolbar {
	display: flex;
	gap: 8px;

	.el-input {
		flex: 1;
	}
}

.picker-search-icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 0;
	border: 0;
	background: transparent;
	color: var(--el-text-color-placeholder);
	cursor: pointer;
	line-height: 1;

	&:hover {
		color: var(--el-color-primary);
	}
}

.picker-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-height: 320px;
	max-height: 420px;
	overflow: auto;
	padding: 2px;
	scrollbar-width: thin;
}

.picker-item {
	display: flex;
	align-items: center;
	gap: 12px;
	width: 100%;
	padding: 12px 14px;
	border: 1px solid color-mix(in srgb, var(--n-color-border-soft) 80%, transparent);
	border-radius: 10px;
	background: color-mix(in srgb, var(--n-color-bg-secondary) 70%, transparent);
	color: inherit;
	text-align: left;
	cursor: pointer;
	transition:
		border-color 0.15s ease,
		background-color 0.15s ease,
		box-shadow 0.15s ease;

	&:hover {
		border-color: color-mix(in srgb, var(--el-color-primary) 45%, transparent);
		background: color-mix(in srgb, var(--el-color-primary-light-9) 55%, transparent);
	}

	&.is-active {
		border-color: var(--el-color-primary);
		background: color-mix(in srgb, var(--el-color-primary-light-9) 72%, transparent);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--el-color-primary) 25%, transparent);
	}
}

.picker-item__main {
	flex: 1;
	min-width: 0;
}

.picker-item__name {
	font-size: 14px;
	font-weight: 600;
	color: var(--n-color-text-primary);
	line-height: 1.35;
}

.picker-item__meta {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 4px;
	margin-top: 4px;
	font-size: 12px;
	color: var(--n-color-text-muted);

	.email {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 220px;
	}
}

.picker-item__id {
	margin-top: 4px;
	font-size: 11px;
	color: color-mix(in srgb, var(--n-color-text-muted) 85%, transparent);
	word-break: break-all;
}

.picker-item__action {
	flex-shrink: 0;
	padding: 4px 10px;
	border-radius: 999px;
	font-size: 12px;
	font-weight: 600;
	color: var(--el-color-primary);
	background: color-mix(in srgb, var(--el-color-primary-light-8) 80%, transparent);
}

.picker-item.is-active .picker-item__action {
	color: #fff;
	background: var(--el-color-primary);
}

.picker-empty {
	display: flex;
	align-items: center;
	justify-content: center;
	flex: 1;
	min-height: 200px;
	color: var(--n-color-text-muted);
	font-size: 13px;
}

.picker-footer {
	display: flex;
	justify-content: flex-end;
	padding-top: 4px;
	border-top: 1px solid var(--n-color-border-soft);
}
</style>

<style lang="scss">
@use '@/styles/platform' as *;

.audit-user-picker-dialog.el-dialog {
	@include n-glass-surface(2);
	background: var(--n-color-bg-glass) !important;
	--el-dialog-bg-color: var(--n-color-bg-glass);
	border: 1px solid var(--n-color-border-soft);
	border-radius: var(--n-dialog-border-radius);
	box-shadow: var(--n-shadow-elevation-4) !important;
	overflow: hidden;

	.el-dialog__header {
		margin: 0;
		padding: 16px 20px 12px;
		border-bottom: 1px solid var(--n-color-border-soft);
	}

	.el-dialog__title {
		color: var(--n-color-text-primary);
		font-size: 16px;
		font-weight: 700;
	}

	.el-dialog__headerbtn .el-dialog__close {
		color: color-mix(in srgb, var(--n-color-text-primary), transparent 45%);
	}

	.el-dialog__body {
		padding: 16px 20px 18px;
		background: transparent;
	}
}
</style>
