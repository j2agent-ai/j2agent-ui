<template>
	<div class="login-container">
		<el-form
			ref="loginForm"
			:model="loginData"
			:rules="rules"
			label-position="left"
			label-width="0px"
			class="login-form"
			@keyup.enter="handleLoginClick"
		>
			<div class="logo-container">
				<h2 class="logo-text">{{ t('ai.title') }}</h2>
			</div>
			<el-form-item prop="username">
				<el-input
					v-model="loginData.username"
					autocomplete="username"
					placeholder="用户名"
				></el-input>
			</el-form-item>
			<el-form-item prop="password">
				<el-input
					v-model="loginData.password"
					type="password"
					autocomplete="current-password"
					placeholder="密码"
				></el-input>
			</el-form-item>
			<el-form-item>
				<div
					class="captcha-check-panel"
					:class="{
						'is-checked': !!captchaToken,
						'is-loading': powLoading || challengeLoading || captchaDialogShow,
						'is-disabled': loading
					}"
					@click="handleCaptchaClick"
				>
					<div
						class="captcha-check-box"
						:class="{
							'is-checked': !!captchaToken,
							'is-loading': powLoading || challengeLoading || captchaDialogShow,
							'is-disabled': loading || powLoading || challengeLoading || captchaDialogShow
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
			<el-form-item>
				<el-button
					type="primary"
					class="submit-btn"
					:loading="loading"
					:disabled="!captchaToken || powLoading || challengeLoading || captchaDialogShow"
					@click="handleLoginClick"
				>
					{{ t('login.submit') }}
				</el-button>
			</el-form-item>
			<div class="footer-link">
				<router-link to="/forgot-password">{{ t('user.resetPassword.goForgot') }}</router-link>
				<span v-if="registerEnabled === true" class="footer-sep" aria-hidden="true"></span>
				<router-link v-if="registerEnabled === true" to="/register">{{
					t('user.emailRegister.goRegister')
				}}</router-link>
			</div>
		</el-form>

		<ElDialog
			v-model="captchaDialogShow"
			class="captcha-dialog"
			align-center
			:loading="loading"
			show-close
			@close="onDialogClose"
			draggable
		>
			<SlipCaptcha
				ref="slideCaptchaRef"
				:loading="loading"
				@valid-pass="slideCaptchaSuccess"
			/>
		</ElDialog>
	</div>
</template>

<script setup lang="ts">
import axios from 'axios'
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
	ElForm,
	ElFormItem,
	ElInput,
	ElButton,
	ElDialog,
	ElMessage
} from 'element-plus'
import type { FormInstance } from 'element-plus'
import { getSessionInfo, login } from '@/api/login.api'
import SlipCaptcha from '@/pages/login/components/SlipCaptcha.vue'
import { loadRegisterEnabled, useRegisterEnabled } from '@/composables/useRegisterEnabled'
import { useLoginCaptcha } from '@/composables/useLoginCaptcha'

import { t } from '@ai-system/lib'
import { hasRoleAccess, ROLE_ADMIN, setSessionInfo } from '@/utils/role'

const router = useRouter()
const loginForm = ref<FormInstance>()
const loading = ref<boolean>(false)
const { registerEnabled } = useRegisterEnabled()

const {
	slideCaptchaRef,
	powLoading,
	captchaDialogShow,
	captchaToken,
	challengeLoading,
	onCaptchaDialogClose,
	slideCaptchaSuccess: applySlideCaptcha,
	handlePrimaryAction,
	resetCaptcha
} = useLoginCaptcha()

function slideCaptchaSuccess(e: { code: string; hash: string }) {
	applySlideCaptcha(e)
	void submitLogin()
}

const loginData = reactive({
	username: '',
	password: ''
})

const rules = {
	username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
	password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

function onDialogClose() {
	onCaptchaDialogClose()
	loading.value = false
}

async function submitLogin() {
	if (!captchaToken.value) return
	const form = loginForm.value
	if (!form) return
	try {
		await form.validate()
	} catch {
		return
	}
	loading.value = true
	try {
		await login(
			loginData.username,
			loginData.password,
			captchaToken.value.code,
			captchaToken.value.hash
		)
		try {
			const sessionResponse = await getSessionInfo()
			setSessionInfo(sessionResponse.data)
			if (hasRoleAccess(ROLE_ADMIN)) {
				router.push('/')
			} else {
				router.push('/agents')
			}
		} catch (error) {
			setSessionInfo(null)
			router.push('/')
		}
	} catch (e: unknown) {
		console.log(e)
		if (axios.isAxiosError(e) && e.response?.status === 401) {
			captchaDialogShow.value = false
			resetCaptcha()
			ElMessage.error(t('login.fail'))
		}
	} finally {
		loading.value = false
	}
}

async function handleCaptchaClick() {
	await handlePrimaryAction(loading.value)
}

function handleLoginClick() {
	void submitLogin()
}

onMounted(() => {
	void loadRegisterEnabled()
})
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
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 28px;
		margin-top: 4px;

		:deep(a),
		:deep(a:visited) {
			color: var(--el-color-primary);
			text-decoration: none;
		}

		:deep(a:hover) {
			color: color-mix(in srgb, var(--el-color-primary), white 12%);
		}

		.footer-sep {
			width: 1px;
			height: 14px;
			background: color-mix(in srgb, var(--el-color-primary), transparent 55%);
			flex-shrink: 0;
		}
	}

}
</style>
