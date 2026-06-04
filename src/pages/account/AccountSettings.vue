<template>
	<div class="account-page">
		<top-bar />
		<div class="account-content">
			<div class="account-card">
				<div class="account-header">
					<h2>{{ t('account.title') }}</h2>
					<p class="account-desc">{{ t('account.desc') }}</p>
				</div>
				<el-form :model="form" label-position="top" class="account-form">
					<el-form-item :label="t('account.old.password')">
						<el-input v-model="form.oldPassword" type="password" show-password />
					</el-form-item>
					<el-form-item :label="t('account.new.password')">
						<el-input v-model="form.newPassword" type="password" show-password />
					</el-form-item>
					<el-form-item :label="t('account.confirm.password')">
						<el-input v-model="form.confirmPassword" type="password" show-password />
					</el-form-item>
					<el-form-item class="action-row">
						<el-button type="primary" :loading="saving" @click="save" class="submit-btn">
							{{ t('common.ok') }}
						</el-button>
					</el-form-item>
				</el-form>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElButton, ElForm, ElFormItem, ElInput, ElMessage } from 'element-plus'
import { t } from '@ai-system/lib'
import topBar from '@/pages/components/topBar.vue'
import { updateUserPassword } from '@/api/user.api'

const saving = ref(false)
const form = ref({
	oldPassword: '',
	newPassword: '',
	confirmPassword: ''
})

const save = async () => {
	if (!form.value.oldPassword || !form.value.newPassword) {
		ElMessage.error(t('common.input.required'))
		return
	}
	if (form.value.newPassword !== form.value.confirmPassword) {
		ElMessage.error(t('account.password.mismatch'))
		return
	}
	saving.value = true
	try {
		await updateUserPassword({
			oldPassword: form.value.oldPassword,
			newPassword: form.value.newPassword
		})
		ElMessage.success(t('common.success'))
		form.value.oldPassword = ''
		form.value.newPassword = ''
		form.value.confirmPassword = ''
	} catch (error) {
		ElMessage.error(t('account.password.update.failed'))
	} finally {
		saving.value = false
	}
}
</script>

<style scoped lang="scss">
@use '@/styles/platform' as *;

.account-page {
	height: 100%;
	padding-top: 50px;
}

.account-content {
	min-height: calc(100vh - 50px);
	display: flex;
	justify-content: center;
	align-items: flex-start;
	padding: 40px 20px 60px;
}

.account-card {
	width: min(520px, 92vw);
	@include n-glass-surface(3);
	border-radius: 16px;
	padding: 28px 28px 20px;
}

.account-header {
	margin-bottom: 20px;

	h2 {
		margin: 0 0 6px 0;
		font-size: 22px;
		font-weight: 600;
		color: var(--n-color-text-primary);
	}
}

.account-desc {
	margin: 0;
	font-size: 14px;
	color: var(--n-color-text-muted);
}

.account-form {
	:deep(.el-form-item__label) {
		font-weight: 500;
		color: var(--n-color-text-primary);
	}

	:deep(.el-input__wrapper) {
		border-radius: 10px;
	}
}

.action-row {
	margin-top: 8px;
}

.submit-btn {
	width: 100%;
	height: 42px;
	font-weight: 600;
}
</style>
