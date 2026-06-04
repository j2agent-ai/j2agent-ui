<template>
	<div class="login-container">
		<el-form
			ref="forgotForm"
			:model="formData"
			:rules="rules"
			label-position="left"
			label-width="0px"
			class="login-form"
			autocomplete="off"
			@keyup.enter="handleSubmit"
		>
			<div class="logo-container">
				<h2 class="logo-text">{{ t('user.resetPassword.pageTitle') }}</h2>
			</div>
			<el-form-item prop="email">
				<el-input
					v-model="formData.email"
					autocomplete="email"
					:placeholder="t('user.resetPassword.email')"
				/>
			</el-form-item>
			<el-form-item prop="newPassword">
				<el-input
					v-model="formData.newPassword"
					type="password"
					show-password
					autocomplete="new-password"
					:placeholder="t('user.resetPassword.newPassword')"
				/>
			</el-form-item>
			<el-form-item prop="confirmPassword">
				<el-input
					v-model="formData.confirmPassword"
					type="password"
					show-password
					autocomplete="new-password"
					:placeholder="t('user.resetPassword.confirmPassword')"
				/>
			</el-form-item>
			<el-form-item prop="captcha">
				<div
					class="captcha-check-panel"
					:class="{
						'is-checked': !!captchaToken,
						'is-loading': powLoading || challengeLoading || captchaDialogShow,
						'is-disabled': loading
					}"
					@click="handlePrimaryAction(loading)"
				>
					<div
						class="captcha-check-box"
						:class="{
							'is-checked': !!captchaToken,
							'is-loading': powLoading || challengeLoading || captchaDialogShow,
							'is-disabled':
								loading || powLoading || challengeLoading || captchaDialogShow
						}"
					></div>
					<div class="captcha-check-text">
						<template v-if="powLoading || challengeLoading || captchaDialogShow">{{
							t('login.verifying')
						}}</template>
						<template v-else>{{ t('login.check.captcha') }}</template>
					</div>
					<div class="captcha-brand">
						<div class="captcha-brand-icon">
							<span class="arc arc-primary"></span>
							<span class="arc arc-black"></span>
						</div>
						<span class="captcha-brand-text">CAPTCHA</span>
					</div>
				</div>
			</el-form-item>
			<el-form-item prop="code">
				<div class="code-row">
					<el-input
						v-model="formData.code"
						autocomplete="one-time-code"
						:placeholder="t('user.resetPassword.code')"
					/>
					<el-button
						:disabled="sendingCode || sendCodeCooldown > 0"
						:loading="sendingCode"
						@click="handleSendCode"
					>
						<template v-if="sendCodeCooldown > 0">
							{{ t('user.resetPassword.sendCode.retryIn', { seconds: sendCodeCooldown }) }}
						</template>
						<template v-else>{{ t('user.resetPassword.sendCode') }}</template>
					</el-button>
				</div>
			</el-form-item>
			<el-form-item>
				<el-button
					type="primary"
					class="submit-btn"
					:loading="loading"
					:disabled="!captchaToken || powLoading || challengeLoading || captchaDialogShow"
					@click="handleSubmit"
				>
					{{ t('user.resetPassword.submit') }}
				</el-button>
			</el-form-item>
			<div class="footer-link">
				<router-link to="/login">{{ t('user.resetPassword.backLogin') }}</router-link>
			</div>
		</el-form>

		<ElDialog
			v-model="captchaDialogShow"
			class="captcha-dialog"
			align-center
			show-close
			@close="onCaptchaDialogClose"
			draggable
		>
			<SlipCaptcha ref="slideCaptchaRef" @valid-pass="slideCaptchaSuccess" />
		</ElDialog>
	</div>
</template>

<script setup lang="ts">
import { onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
	ElButton,
	ElDialog,
	ElForm,
	ElFormItem,
	ElInput,
	ElMessage,
	ElMessageBox
} from 'element-plus'
import type { FormInstance } from 'element-plus'
import { resetPasswordByEmail, sendResetPasswordCode } from '@/api/reset-password.api'
import SlipCaptcha from '@/pages/login/components/SlipCaptcha.vue'
import { withDraggableMessageBoxOptions } from '@ai-system/common/elementPlusDialog'
import { extractApiErrorMessage, useLoginCaptcha } from '@/composables/useLoginCaptcha'
import { t } from '@ai-system/lib'

const router = useRouter()
const forgotForm = ref<FormInstance>()
const SEND_CODE_COOLDOWN_SEC = 60

const loading = ref(false)
const sendingCode = ref(false)
const sendCodeCooldown = ref(0)
let sendCodeCooldownTimer: ReturnType<typeof setInterval> | null = null

const {
	slideCaptchaRef,
	powLoading,
	captchaDialogShow,
	captchaToken,
	challengeLoading,
	onCaptchaDialogClose,
	slideCaptchaSuccess,
	handlePrimaryAction,
	resetCaptcha
} = useLoginCaptcha()

const formData = reactive({
	email: '',
	newPassword: '',
	confirmPassword: '',
	code: '',
	captcha: ''
})

const rules = {
	email: [{ required: true, message: t('common.input.required'), trigger: 'blur' }],
	newPassword: [{ required: true, message: t('common.input.required'), trigger: 'blur' }],
	confirmPassword: [
		{ required: true, message: t('common.input.required'), trigger: 'blur' },
		{
			validator: (_rule, _value, callback) => {
				if (formData.newPassword === formData.confirmPassword) {
					callback()
				} else {
					callback(new Error(t('user.resetPassword.passwordMismatch')))
				}
			},
			trigger: 'blur'
		}
	],
	code: [{ required: true, message: t('common.input.required'), trigger: 'blur' }],
	captcha: [
		{
			validator: (_rule, _value, callback) => {
				if (captchaToken.value) {
					callback()
				} else {
					callback(new Error(t('user.resetPassword.captchaRequired')))
				}
			},
			trigger: 'change'
		}
	]
}

watch(captchaToken, (token) => {
	if (token) {
		forgotForm.value?.clearValidate('captcha')
	}
})

async function showErrorAlert(message: string, type: 'error' | 'warning' = 'error'): Promise<void> {
	await ElMessageBox.alert(
		message,
		t('user.resetPassword.error.title'),
		withDraggableMessageBoxOptions({
			type,
			confirmButtonText: t('common.ok')
		})
	)
}

function clearSendCodeCooldownTimer() {
	if (sendCodeCooldownTimer) {
		clearInterval(sendCodeCooldownTimer)
		sendCodeCooldownTimer = null
	}
}

function startSendCodeCooldown() {
	clearSendCodeCooldownTimer()
	sendCodeCooldown.value = SEND_CODE_COOLDOWN_SEC
	sendCodeCooldownTimer = setInterval(() => {
		if (sendCodeCooldown.value <= 1) {
			sendCodeCooldown.value = 0
			clearSendCodeCooldownTimer()
		} else {
			sendCodeCooldown.value -= 1
		}
	}, 1000)
}

onUnmounted(() => {
	clearSendCodeCooldownTimer()
})

async function handleSendCode() {
	if (!captchaToken.value) {
		await forgotForm.value?.validateField('captcha').catch(() => {})
		return
	}
	if (!formData.email.trim()) {
		await forgotForm.value?.validateField('email').catch(() => {})
		return
	}
	sendingCode.value = true
	try {
		await sendResetPasswordCode({
			email: formData.email.trim(),
			validateCode: captchaToken.value.code,
			hash: captchaToken.value.hash
		})
		ElMessage.success(t('user.resetPassword.codeSent'))
		startSendCodeCooldown()
	} catch (e: unknown) {
		resetCaptcha()
		await showErrorAlert(
			extractApiErrorMessage(e, t('user.resetPassword.sendCode.failed'))
		)
	} finally {
		sendingCode.value = false
	}
}

async function handleSubmit() {
	const form = forgotForm.value
	if (!form) return
	try {
		await form.validate()
	} catch {
		return
	}
	loading.value = true
	try {
		await resetPasswordByEmail({
			email: formData.email.trim(),
			newPassword: formData.newPassword,
			code: formData.code.trim()
		})
		ElMessage.success(t('user.resetPassword.success'))
		router.push('/login')
	} catch (e: unknown) {
		await showErrorAlert(extractApiErrorMessage(e, t('user.resetPassword.failed')))
	} finally {
		loading.value = false
	}
}
</script>

<style lang="scss" scoped>
@use '@/styles/platform' as *;
@use './login-captcha.scss';

.login-container {
	display: flex;
	justify-content: center;
	align-items: center;
	height: 100vh;

	.login-form {
		width: 380px;
		padding: 24px 22px 20px;
		@include n-glass-surface(3);
		border-radius: 8px;
	}

	.logo-container {
		text-align: center;
		margin-bottom: 18px;
	}

	.logo-text {
		font-size: var(--n-font-size-4);
		font-weight: bold;
		color: var(--el-color-primary);
		margin: 0;
	}

	.code-row {
		display: flex;
		gap: 8px;
		width: 100%;
	}

	.submit-btn {
		width: 100%;
	}

	:deep(.el-form-item) {
		margin-bottom: 12px;
	}

	:deep(.el-input__wrapper) {
		min-height: 38px;
		background: var(--n-color-bg-glass-weak) !important;
		backdrop-filter: blur(var(--n-glass-blur-1));
		border-radius: 5px;
	}

	:deep(.el-input__inner) {
		background-color: transparent !important;
		color: var(--n-color-text-primary);
		font-family: inherit !important;
	}

	:deep(.el-input__inner::placeholder) {
		color: var(--el-text-color-placeholder);
	}

	:deep(input:-webkit-autofill),
	:deep(input:-webkit-autofill:hover),
	:deep(input:-webkit-autofill:focus),
	:deep(input:-webkit-autofill:active) {
		-webkit-box-shadow: 0 0 0 1000px var(--n-color-bg-glass-weak) inset !important;
		-webkit-text-fill-color: var(--n-color-text-primary) !important;
		caret-color: var(--n-color-text-primary);
		transition: background-color 9999s ease-out;
	}

	.footer-link {
		text-align: center;

		:deep(a),
		:deep(a:visited) {
			color: var(--el-color-primary);
			text-decoration: none;
		}

		:deep(a:hover) {
			color: color-mix(in srgb, var(--el-color-primary), white 12%);
		}
	}
}
</style>
