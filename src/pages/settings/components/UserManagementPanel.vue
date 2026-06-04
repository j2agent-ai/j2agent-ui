<template>
	<div class="user-management">
		<el-tabs v-model="activeSubTab" class="user-sub-tabs">
			<el-tab-pane label="用户列表" name="list">
				<div class="user-management-toolbar">
					<el-button type="primary" size="small" @click="openCreateDialog">
						{{ t('user.management.create') }}
					</el-button>
					<el-button size="small" @click="loadUsers">
						{{ t('common.refresh') }}
					</el-button>
				</div>

				<el-table :data="users" v-loading="loading" stripe>
					<el-table-column prop="username" :label="t('user.management.username')" />
					<el-table-column prop="email" :label="t('user.management.email')" />
					<el-table-column prop="role" :label="t('user.management.role')">
						<template #default="{ row }">
							<el-select
								v-if="canEditRole(row)"
								v-model="row.role"
								size="small"
								@change="() => saveRole(row)"
							>
								<el-option
									v-for="roleOption in roleOptions"
									:key="roleOption.value"
									:label="roleOption.label"
									:value="roleOption.value"
								/>
							</el-select>
							<span v-else class="role-label">
								{{ getRoleLabel(row.role) }}
							</span>
						</template>
					</el-table-column>
					<el-table-column :label="t('common.action')" width="240">
						<template #default="{ row }">
							<el-button
								size="small"
								@click="openResetPassword(row)"
								:disabled="!canResetPassword(row)"
							>
								{{ t('user.management.reset.password') }}
							</el-button>
							<el-button
								size="small"
								type="danger"
								:disabled="isDeleteDisabled(row)"
								@click="confirmDelete(row)"
							>
								{{ t('common.delete') }}
							</el-button>
						</template>
					</el-table-column>
				</el-table>
			</el-tab-pane>
			<el-tab-pane label="邮箱自助注册" name="email-register">
				<EmailRegisterSettingsPanel />
			</el-tab-pane>
		</el-tabs>

		<el-dialog
			v-model="createDialogVisible"
			:title="t('user.management.create')"
			draggable
			append-to-body
		>
			<el-form :model="createForm" label-width="90px" autocomplete="off">
				<el-form-item :label="t('user.management.username')">
					<el-input v-model="createForm.username" autocomplete="off" />
				</el-form-item>
				<el-form-item :label="t('user.management.password')">
					<el-input
						v-model="createForm.password"
						type="password"
						autocomplete="new-password"
						show-password
					/>
				</el-form-item>
				<el-form-item :label="t('user.management.role')">
					<el-select v-model="createForm.role" :disabled="!isAdmin">
						<el-option
							v-for="roleOption in roleOptions"
							:key="roleOption.value"
							:label="roleOption.label"
							:value="roleOption.value"
						/>
					</el-select>
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="createDialogVisible = false">
					{{ t('common.cancel') }}
				</el-button>
				<el-button type="primary" :loading="saving" @click="handleCreate">
					{{ t('common.ok') }}
				</el-button>
			</template>
		</el-dialog>

		<el-dialog
			v-model="passwordDialogVisible"
			:title="t('user.management.reset.password')"
			draggable
			append-to-body
		>
			<el-form :model="passwordForm" label-width="90px" autocomplete="off">
				<el-form-item :label="t('user.management.password')">
					<el-input
						v-model="passwordForm.password"
						type="password"
						autocomplete="new-password"
						show-password
					/>
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="passwordDialogVisible = false">
					{{ t('common.cancel') }}
				</el-button>
				<el-button type="primary" :loading="saving" @click="handleResetPassword">
					{{ t('common.ok') }}
				</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import {
	ElButton,
	ElDialog,
	ElForm,
	ElFormItem,
	ElInput,
	ElMessage,
	ElMessageBox,
	ElOption,
	ElSelect,
	ElTabPane,
	ElTabs,
	ElTable,
	ElTableColumn
} from 'element-plus'
import { t } from '@ai-system/lib'
import {
	createUser,
	deleteUser,
	getUserList,
	updateUserPassword,
	updateUserRole,
	type UserDto
} from '@/api/user.api'
import { hasRoleAccess, ROLE_ADMIN, ROLE_USER } from '@/utils/role'
import EmailRegisterSettingsPanel from './EmailRegisterSettingsPanel.vue'

// 用户列表数据
const users = ref<UserDto[]>([])
// 当前激活的二级 Tab（list：用户列表；email-register：邮箱自助注册）
const activeSubTab = ref<'list' | 'email-register'>('list')
const loading = ref(false)
const saving = ref(false)
const createDialogVisible = ref(false)
const passwordDialogVisible = ref(false)
const selectedUser = ref<UserDto | null>(null)

const createForm = ref({
	username: '',
	password: '',
	role: ROLE_USER
})

const passwordForm = ref({
	password: ''
})

const roleOptions = computed(() => {
	const options = [{ value: ROLE_USER, label: t('user.management.role.user') }]
	if (isAdmin.value) {
		options.unshift({ value: ROLE_ADMIN, label: t('user.management.role.admin') })
	}
	return options
})

const isAdmin = computed(() => hasRoleAccess(ROLE_ADMIN))

const canEditRole = (user: UserDto) => {
	if (isAdmin.value) {
		return user.username !== 'aiadmin'
	}
	return false
}

const getRoleLabel = (role: number) => {
	return role === ROLE_ADMIN ? t('user.management.role.admin') : t('user.management.role.user')
}

const canResetPassword = (user: UserDto) => {
	return canEditRole(user)
}

const isDeleteDisabled = (user: UserDto) => {
	return user.username === 'aiadmin' || !canEditRole(user)
}

// 加载用户列表数据
const loadUsers = async () => {
	loading.value = true
	try {
		const res = await getUserList()
		users.value = res.data?.data ?? []
	} catch (error) {
		ElMessage.error(t('user.management.load.failed'))
	} finally {
		loading.value = false
	}
}

// 打开新建用户弹窗
const openCreateDialog = () => {
	createForm.value = {
		username: '',
		password: '',
		role: ROLE_USER
	}
	createDialogVisible.value = true
	nextTick(() => {
		createForm.value.username = ''
		createForm.value.password = ''
	})
}

// 保存新建用户
const handleCreate = async () => {
	if (!createForm.value.username || !createForm.value.password) {
		ElMessage.error(t('common.input.required'))
		return
	}
	saving.value = true
	try {
		await createUser({
			username: createForm.value.username,
			password: createForm.value.password,
			role: createForm.value.role
		})
		ElMessage.success(t('common.success'))
		createDialogVisible.value = false
		await loadUsers()
	} catch (error) {
		ElMessage.error(t('user.management.create.failed'))
	} finally {
		saving.value = false
	}
}

// 确认并删除用户
const confirmDelete = async (user: UserDto) => {
	try {
		await ElMessageBox.confirm(
			`${t('user.management.delete.confirm')} ${user.username}`,
			t('common.delete'),
			{
				confirmButtonText: t('common.ok'),
				cancelButtonText: t('common.cancel'),
				type: 'warning'
			}
		)
		await deleteUser(user.userId)
		ElMessage.success(t('common.success'))
		await loadUsers()
	} catch (error) {
		if (error !== 'cancel') {
			ElMessage.error(t('user.management.delete.failed'))
		}
	}
}

// 保存用户角色变更
const saveRole = async (user: UserDto) => {
	try {
		await updateUserRole({ userId: user.userId, role: user.role })
		ElMessage.success(t('common.success'))
	} catch (error) {
		ElMessage.error(t('user.management.role.update.failed'))
		await loadUsers()
	}
}

// 打开重置密码弹窗
const openResetPassword = (user: UserDto) => {
	selectedUser.value = user
	passwordForm.value.password = ''
	passwordDialogVisible.value = true
}

// 提交重置密码
const handleResetPassword = async () => {
	if (!selectedUser.value) {
		return
	}
	if (!passwordForm.value.password) {
		ElMessage.error(t('common.input.required'))
		return
	}
	saving.value = true
	try {
		await updateUserPassword({
			userId: selectedUser.value.userId,
			newPassword: passwordForm.value.password
		})
		ElMessage.success(t('common.success'))
		passwordDialogVisible.value = false
	} catch (error) {
		ElMessage.error(t('user.management.password.update.failed'))
	} finally {
		saving.value = false
	}
}

onMounted(() => {
	loadUsers()
})
</script>

<style scoped lang="scss">
.user-management {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.user-management-toolbar {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 4px 2px 6px;
	margin-bottom: 12px;
}

.user-sub-tabs {
	:deep(.el-tabs__header) {
		margin-bottom: 10px;
	}

	:deep(.el-tabs__nav-wrap::after) {
		height: 1px;
		background-color: var(--n-color-border-soft);
	}

	:deep(.el-tabs__item) {
		height: 34px;
		line-height: 34px;
		padding: 0 14px;
		border-radius: 8px 8px 0 0;
		font-weight: 500;
		color: color-mix(in srgb, var(--n-color-text-primary) 72%, transparent);
		transition: color 0.2s ease;
	}

	:deep(.el-tabs__item:hover) {
		color: var(--n-color-text-primary);
	}

	:deep(.el-tabs__item.is-active) {
		color: var(--el-color-primary);
		background: transparent !important;
	}

	:deep(.el-tabs__active-bar) {
		height: 2px;
		border-radius: 2px;
		background-color: var(--el-color-primary);
	}

	:deep(.el-tabs__content),
	:deep(.el-tab-pane) {
		background: transparent;
	}
}

.role-label {
	color: var(--n-color-text-primary);
	font-weight: 500;
}
</style>
