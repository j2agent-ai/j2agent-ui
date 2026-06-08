<template>
	<div class="login-container">
		<el-form
			ref="registerForm"
			:model="formData"
			:rules="rules"
			label-position="left"
			label-width="0px"
			class="login-form"
			autocomplete="off"
			@keyup.enter="handleRegister"
		>
			<div class="logo-container">
				<h2 class="logo-text">{{ t('user.emailRegister.pageTitle') }}</h2>
			</div>
			<el-form-item prop="email">
				<el-input
					v-model="formData.email"
					autocomplete="email"
					:placeholder="t('user.emailRegister.email')"
				/>
			</el-form-item>
			<el-form-item prop="password">
				<el-input
					v-model="formData.password"
					type="password"
					show-password
					autocomplete="new-password"
					:placeholder="t('user.management.password')"
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
						:placeholder="t('user.emailRegister.code')"
					/>
					<el-button
						:disabled="sendingCode || sendCodeCooldown > 0"
						:loading="sendingCode"
						@click="handleSendCode"
					>
						<template v-if="sendCodeCooldown > 0">
							{{ t('user.emailRegister.sendCode.retryIn', { seconds: sendCodeCooldown }) }}
						</template>
						<template v-else>{{ t('user.emailRegister.sendCode') }}</template>
					</el-button>
				</div>
			</el-form-item>
			<el-form-item>
				<el-button
					type="primary"
					class="submit-btn"
					:loading="loading"
					@click="handleRegister"
				>
					{{ t('user.emailRegister.submit') }}
				</el-button>
			</el-form-item>
			<p class="login-hint">{{ t('user.emailRegister.loginHint') }}</p>
			<div class="footer-link">
				<router-link to="/login">{{ t('user.emailRegister.backLogin') }}</router-link>
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
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
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
import { registerByEmail, sendRegisterCode } from '@/api/register.api'
import SlipCaptcha from '@/pages/login/components/SlipCaptcha.vue'
import { loadRegisterEnabled } from '@/composables/useRegisterEnabled'
import { withDraggableMessageBoxOptions } from '@ai-system/common/elementPlusDialog'
import { extractApiErrorMessage, useLoginCaptcha } from '@/composables/useLoginCaptcha'
import { t } from '@ai-system/lib'

const router = useRouter()
const registerForm = ref<FormInstance>()
const SEND_CODE_COOLDOWN_SEC = 60

const loading = ref(false)
const sendingCode = ref(false)
/** 获取验证码按钮倒计时（秒），大于 0 时禁用按钮 */
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
	password: '',
	email: '',
	code: '',
	captcha: ''
})

const rules = {
	email: [{ required: true, message: t('common.input.required'), trigger: 'blur' }],
	password: [{ required: true, message: t('common.input.required'), trigger: 'blur' }],
	code: [{ required: true, message: t('common.input.required'), trigger: 'blur' }],
	captcha: [
		{
			validator: (_rule, _value, callback) => {
				if (captchaToken.value) {
					callback()
				} else {
					callback(new Error(t('user.emailRegister.captchaRequired')))
				}
			},
			trigger: 'change'
		}
	]
}

watch(captchaToken, (token) => {
	if (token) {
		registerForm.value?.clearValidate('captcha')
	}
})

async function showRegisterErrorAlert(
	message: string,
	type: 'error' | 'warning' = 'error'
): Promise<void> {
	await ElMessageBox.alert(
		message,
		t('user.emailRegister.error.title'),
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

/** 发送成功后启动 60 秒倒计时 */
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

onMounted(async () => {
	const enabled = await loadRegisterEnabled()
	if (!enabled) {
		ElMessage.warning(t('user.emailRegister.disabled'))
		router.replace('/login')
	}
})

async function handleSendCode() {
	if (!captchaToken.value) {
		await registerForm.value?.validateField('captcha').catch(() => {})
		return
	}
	if (!formData.email.trim()) {
		await registerForm.value?.validateField('email').catch(() => {})
		return
	}
	sendingCode.value = true
	try {
		await sendRegisterCode({
			email: formData.email.trim(),
			validateCode: captchaToken.value.code,
			hash: captchaToken.value.hash
		})
		ElMessage.success(t('user.emailRegister.codeSent'))
		startSendCodeCooldown()
	} catch (e: unknown) {
		resetCaptcha()
		await showRegisterErrorAlert(
			extractApiErrorMessage(e, t('user.emailRegister.sendCode.failed'))
		)
	} finally {
		sendingCode.value = false
	}
}

async function handleRegister() {
	const form = registerForm.value
	if (!form) return
	try {
		await form.validate()
	} catch {
		return
	}
	loading.value = true
	try {
		await registerByEmail({
			password: formData.password,
			email: formData.email.trim(),
			code: formData.code.trim()
		})
		ElMessage.success(t('user.emailRegister.success'))
		router.push('/login')
	} catch (e: unknown) {
		await showRegisterErrorAlert(extractApiErrorMessage(e, t('user.emailRegister.failed')))
	} finally {
		loading.value = false
	}
}
</script>

<style lang="scss" scoped>
@use '@/styles/platform' as *;
@use './login-captcha.scss';
@use './login-form.scss' as loginForm;

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

	@include loginForm.login-auth-form-controls;

	.login-hint {
		margin: 0 0 8px;
		text-align: center;
		font-size: 12px;
		color: var(--el-text-color-secondary);
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
