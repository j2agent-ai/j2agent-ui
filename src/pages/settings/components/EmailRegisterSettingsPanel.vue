<template>
	<div class="email-register-settings">
		<div class="email-register-header">
			<span>{{ t('user.emailRegister.title') }}</span>
			<el-switch v-model="enabled" />
		</div>
		<div v-if="enabled" class="smtp-form">
		<el-form
			:model="smtpForm"
			label-width="120px"
			autocomplete="off"
			@submit.prevent
		>
			<div class="whitelist-section">
				<div class="whitelist-header">
					<span>{{ t('user.emailRegister.whitelist.title') }}</span>
					<el-switch v-model="whitelistEnabled" />
				</div>
				<template v-if="whitelistEnabled">
					<el-form-item :label="t('user.emailRegister.whitelist.rules')">
						<el-input
							v-model="whitelistRules"
							type="textarea"
							:rows="3"
							:placeholder="t('user.emailRegister.whitelist.rules.placeholder')"
						/>
						<p class="field-hint">{{ t('user.emailRegister.whitelist.rules.hint') }}</p>
					</el-form-item>
					<el-form-item :label="t('user.emailRegister.whitelist.deniedMessage')">
						<el-input
							v-model="whitelistDeniedMessage"
							:placeholder="t('user.emailRegister.whitelist.deniedMessage.placeholder')"
						/>
					</el-form-item>
				</template>
			</div>
			<el-form-item :label="t('user.emailRegister.smtp.host')">
				<el-input v-model="smtpForm.host" />
			</el-form-item>
			<el-form-item :label="t('user.emailRegister.smtp.port')">
				<el-input-number v-model="smtpForm.port" :min="1" :max="65535" />
			</el-form-item>
			<el-form-item :label="t('user.emailRegister.smtp.username')">
				<el-input
					v-model="smtpForm.username"
					name="smtp-username"
					autocomplete="off"
					:readonly="smtpUsernameReadonly"
					@focus="smtpUsernameReadonly = false"
				/>
			</el-form-item>
			<el-form-item :label="t('user.emailRegister.smtp.password')">
				<el-input
					v-model="smtpForm.password"
					type="password"
					show-password
					name="smtp-password"
					autocomplete="off"
					:readonly="smtpPasswordReadonly"
					@focus="smtpPasswordReadonly = false"
				/>
			</el-form-item>
			<el-form-item :label="t('user.emailRegister.smtp.from')">
				<el-input v-model="smtpForm.from" />
			</el-form-item>
			<el-form-item :label="t('user.emailRegister.smtp.ssl')">
				<el-switch v-model="smtpForm.ssl" />
			</el-form-item>
			<el-form-item :label="t('user.emailRegister.smtp.startTls')">
				<el-switch v-model="smtpForm.startTls" />
			</el-form-item>
		</el-form>
		<div class="form-actions">
			<el-button type="primary" native-type="button" :loading="saving" @click="saveSettings">
				{{ t('user.emailRegister.save') }}
			</el-button>
		</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElButton, ElForm, ElFormItem, ElInput, ElInputNumber, ElMessage, ElSwitch } from 'element-plus'
import { t } from '@ai-system/lib'
import { getProperties, putProperties } from '@/api/property.api'

const KEY_ENABLED = 'user-email-register-enabled'
const KEY_SMTP_JSON = 'user-email-register-smtp-json'
const KEY_WHITELIST_ENABLED = 'user-email-register-whitelist-enabled'
const KEY_WHITELIST_RULES = 'user-email-register-whitelist-rules'
const KEY_WHITELIST_DENIED_MESSAGE = 'user-email-register-whitelist-denied-message'

const enabled = ref(false)
const whitelistEnabled = ref(false)
const whitelistRules = ref('')
const whitelistDeniedMessage = ref('')
const saving = ref(false)
/** 初始 readonly，避免浏览器将 SMTP 账号密码识别为登录凭据 */
const smtpUsernameReadonly = ref(true)
const smtpPasswordReadonly = ref(true)
const smtpForm = ref({
	host: '',
	port: 587,
	username: '',
	password: '',
	from: '',
	ssl: false,
	startTls: true
})

const parseBoolean = (value?: string) => {
	if (!value) return false
	return value.trim() === '1' || value.trim().toLowerCase() === 'true'
}

const loadSettings = async () => {
	try {
		const res = await getProperties([
			KEY_ENABLED,
			KEY_SMTP_JSON,
			KEY_WHITELIST_ENABLED,
			KEY_WHITELIST_RULES,
			KEY_WHITELIST_DENIED_MESSAGE
		])
		const data = res.data?.data ?? res.data ?? {}
		enabled.value = parseBoolean(data[KEY_ENABLED])
		whitelistEnabled.value = parseBoolean(data[KEY_WHITELIST_ENABLED])
		whitelistRules.value = data[KEY_WHITELIST_RULES] ?? ''
		whitelistDeniedMessage.value = data[KEY_WHITELIST_DENIED_MESSAGE] ?? ''
		if (data[KEY_SMTP_JSON]) {
			try {
				const parsed = JSON.parse(data[KEY_SMTP_JSON])
				smtpForm.value = {
					host: parsed.host ?? '',
					port: parsed.port ?? 587,
					username: parsed.username ?? '',
					password: parsed.password ?? '',
					from: parsed.from ?? '',
					ssl: !!parsed.ssl,
					startTls: parsed.startTls !== false
				}
			} catch {
				// 配置损坏时保持默认
			}
		}
	} catch {
		ElMessage.error(t('user.emailRegister.load.failed'))
	}
}

const saveSettings = async () => {
	if (whitelistEnabled.value && !whitelistRules.value.trim()) {
		ElMessage.warning(t('user.emailRegister.whitelist.rules.required'))
		return
	}
	saving.value = true
	try {
		await putProperties([
			{
				propertyName: KEY_ENABLED,
				propertyValue: enabled.value ? 'true' : 'false'
			},
			{
				propertyName: KEY_SMTP_JSON,
				propertyValue: JSON.stringify(smtpForm.value)
			},
			{
				propertyName: KEY_WHITELIST_ENABLED,
				propertyValue: whitelistEnabled.value ? 'true' : 'false'
			},
			{
				propertyName: KEY_WHITELIST_RULES,
				propertyValue: whitelistRules.value.trim()
			},
			{
				propertyName: KEY_WHITELIST_DENIED_MESSAGE,
				propertyValue: whitelistDeniedMessage.value.trim()
			}
		])
		ElMessage.success(t('common.success'))
	} catch {
		ElMessage.error(t('user.emailRegister.save.failed'))
	} finally {
		saving.value = false
	}
}

onMounted(() => {
	loadSettings()
})
</script>

<style scoped lang="scss">
@use '@/styles/platform' as *;

/* 已嵌套在 settings-tabs 面板内，不再叠加外层边框 */
.email-register-settings {
	padding: 4px 0 0;
}

.email-register-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 12px;
	font-weight: 600;
	color: var(--n-color-text-primary);
}

.smtp-form {
	max-width: 520px;
}

.whitelist-section {
	margin-bottom: 16px;
	padding-bottom: 16px;

	&:not(:last-child) {
		border-bottom: 1px solid var(--n-color-border-soft);
	}
}

.whitelist-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 12px;
	font-weight: 600;
	color: var(--n-color-text-primary);
}

.field-hint {
	margin: 4px 0 0;
	font-size: 12px;
	line-height: 1.4;
}

.form-actions {
	max-width: 520px;
	padding-left: 120px;
}
</style>
