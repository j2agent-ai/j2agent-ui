<template>
	<div class="agent-global-config-page" v-loading="loading">
		<div class="header">
			<h2>{{ t('agentGlobalConfig.config.title') }}</h2>
			<div class="actions">
				<el-button size="small" @click="formatConfig">
					{{ t('agentGlobalConfig.config.format') }}
				</el-button>
				<el-button type="primary" size="small" @click="saveConfig" :loading="saving">
					{{ t('settings.save') }}
				</el-button>
			</div>
		</div>
		<el-input
			v-model="configText"
			type="textarea"
			:autosize="{ minRows: 14 }"
			:placeholder="t('agentGlobalConfig.config.placeholder')"
			@blur="formatConfig"
		/>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElButton, ElInput, ElMessage } from 'element-plus'
import { t } from '@ai-system/lib'
import { getAgentGlobalConfig, putAgentGlobalConfig } from '@/api/agentGlobalConfig.api'

const DEFAULT_CONFIG = {
	datasource: {
		jdbcUrl: '',
		username: '',
		password: '',
		driverClassName: 'com.mysql.cj.jdbc.Driver'
	},
	service: {
		baseUrl: ''
	}
}

const loading = ref(false)
const saving = ref(false)
const configText = ref('')

const resolvePayload = (res: any) => {
	if (res?.data?.data) {
		return res.data.data
	}
	return res?.data ?? {}
}

const loadConfig = async () => {
	loading.value = true
	try {
		const res = await getAgentGlobalConfig()
		const data = resolvePayload(res)
		configText.value = JSON.stringify(data || DEFAULT_CONFIG, null, 2)
	} catch (error) {
		ElMessage.error(t('agentGlobalConfig.config.load.failed'))
	} finally {
		loading.value = false
	}
}

const formatConfig = () => {
	if (!configText.value.trim()) {
		configText.value = JSON.stringify(DEFAULT_CONFIG, null, 2)
		return
	}
	try {
		const parsed = JSON.parse(configText.value)
		configText.value = JSON.stringify(parsed, null, 2)
	} catch (error) {
		ElMessage.warning(t('agentGlobalConfig.config.invalid'))
	}
}

const saveConfig = async () => {
	saving.value = true
	try {
		const parsed = JSON.parse(configText.value)
		await putAgentGlobalConfig(parsed)
		configText.value = JSON.stringify(parsed, null, 2)
		ElMessage.success(t('settings.save.success'))
	} catch (error) {
		if (error instanceof SyntaxError) {
			ElMessage.error(t('agentGlobalConfig.config.invalid'))
		} else {
			ElMessage.error(t('settings.save.failed'))
		}
	} finally {
		saving.value = false
	}
}

onMounted(() => {
	loadConfig()
})
</script>

<style scoped lang="scss">
.agent-global-config-page {
	padding: 0;
}

.header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 10px;

	h2 {
		margin: 0;
		color: var(--n-color-text-primary);
		font-weight: 600;
	}
}

.actions {
	display: flex;
	gap: 8px;
}
</style>
