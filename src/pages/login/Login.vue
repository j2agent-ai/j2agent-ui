<template>
	<AuthPageLayout>
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
			<el-form-item prop="captcha">
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
	</AuthPageLayout>
</template>

<script setup lang="ts">
import axios from 'axios'
import { onMounted, reactive, ref, watch } from 'vue'
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
import { setAuthToken } from '@/utils/token'
import SlipCaptcha from '@/pages/login/components/SlipCaptcha.vue'
import AuthPageLayout from '@/pages/login/AuthPageLayout.vue'
import { loadRegisterEnabled, useRegisterEnabled } from '@/composables/useRegisterEnabled'
import { useLoginCaptcha } from '@/composables/useLoginCaptcha'

import { t } from '@ai-system/lib'
import { goTo, NAV_POST_LOGIN_PATH_KEY } from '@/routes'
import { hasRoleAccess, ROLE_ADMIN, setSessionInfo } from '@/utils/role'

const resolvePostLoginPath = (): string => {
	try {
		const saved = sessionStorage.getItem(NAV_POST_LOGIN_PATH_KEY)
		sessionStorage.removeItem(NAV_POST_LOGIN_PATH_KEY)
		if (saved && saved !== '/login' && saved !== '/logout') {
			return saved
		}
	} catch {
		/* ignore */
	}
	return hasRoleAccess(ROLE_ADMIN) ? '/' : '/agents'
}
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
	password: '',
	captcha: ''
})

const rules = {
	username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
	password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
	captcha: [
		{
			validator: (_rule, _value, callback) => {
				if (captchaToken.value) {
					callback()
				} else {
					callback(new Error(t('login.captchaRequired')))
				}
			},
			trigger: 'change'
		}
	]
}

watch(captchaToken, (token) => {
	if (token) {
		loginForm.value?.clearValidate('captcha')
	}
})

function onDialogClose() {
	onCaptchaDialogClose()
	loading.value = false
}

async function submitLogin() {
	const form = loginForm.value
	if (!form) return
	try {
		await form.validate()
	} catch {
		return
	}
	loading.value = true
	try {
		const loginResponse = await login(
			loginData.username,
			loginData.password,
			captchaToken.value.code,
			captchaToken.value.hash
		)
		const authResult = loginResponse.data
		if (authResult?.token && authResult.expiresIn) {
			setAuthToken(authResult.token, authResult.expiresIn)
		}
		try {
			const sessionResponse = await getSessionInfo()
			setSessionInfo(sessionResponse.data)
			void goTo(resolvePostLoginPath())
		} catch (error) {
			setSessionInfo(null)
			void goTo('/')
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
@use './login-form.scss' as loginForm;

.login-container {
	display: flex;
	justify-content: center;
	align-items: center;
	width: 100%;

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

	@include loginForm.login-auth-form-controls;

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
