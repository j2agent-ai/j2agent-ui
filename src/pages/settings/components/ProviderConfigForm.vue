<template>
	<el-form :model="formState" label-width="180px" autocomplete="off" @submit.prevent="() => {}">
		<!-- 诱饵字段，降低浏览器自动填充到真实输入框的概率 -->
		<input type="text" class="autofill-trap" tabindex="-1" autocomplete="username" aria-hidden="true" />
		<input type="password" class="autofill-trap" tabindex="-1" autocomplete="current-password" aria-hidden="true" />

		<div class="section-title">{{ t('providerConfig.section.basic') }}</div>
		<el-form-item required>
			<template #label>
				<FormFieldLabel :label="t('providerConfig.configName')" :tip="t('providerConfig.field.configName.tip')" />
			</template>
			<el-input v-model="formState.configName" maxlength="128" autocomplete="off" />
		</el-form-item>
		<el-form-item required>
			<template #label>
				<FormFieldLabel :label="t('providerConfig.providerType')" :tip="t('providerConfig.field.providerType.tip')" />
			</template>
			<el-select
				v-model="formState.providerType"
				class="form-select"
				fit-input-width
				autocomplete="off"
				@change="onProviderTypeChange"
			>
				<el-option
					v-for="opt in providerOptions"
					:key="opt.value"
					:label="opt.label"
					:value="opt.value"
				/>
			</el-select>
		</el-form-item>
		<el-form-item>
			<template #label>
				<FormFieldLabel :label="t('providerConfig.enabled')" :tip="t('providerConfig.field.enabled.tip')" />
			</template>
			<el-switch v-model="formState.enabled" />
		</el-form-item>
		<el-form-item v-if="showMakeCurrent">
			<template #label>
				<FormFieldLabel :label="t('providerConfig.makeCurrent')" :tip="t('providerConfig.field.makeCurrent.tip')" />
			</template>
			<el-switch v-model="formState.makeCurrent" :disabled="!formState.enabled" />
		</el-form-item>
		<el-form-item>
			<template #label>
				<FormFieldLabel :label="t('providerConfig.description')" :tip="t('providerConfig.field.description.tip')" />
			</template>
			<el-input
				v-model="formState.description"
				type="textarea"
				:rows="2"
				maxlength="512"
				autocomplete="off"
			/>
		</el-form-item>

		<div class="section-title">{{ t('providerConfig.section.params') }}</div>
		<el-form-item required>
			<template #label>
				<FormFieldLabel :label="t('settings.model.name')" :tip="t('providerConfig.field.modelName.tip')" />
			</template>
			<el-input v-model="formState.config.modelName" autocomplete="off" />
		</el-form-item>

		<el-form-item v-if="needsBaseUrl" :required="providerType !== 'anthropic'">
			<template #label>
				<FormFieldLabel :label="t('settings.base.url')" :tip="t('providerConfig.field.baseUrl.tip')" />
			</template>
			<el-input
				v-model="formState.config.baseUrl"
				:placeholder="baseUrlInputPlaceholder"
				autocomplete="off"
			/>
			<div class="field-example">{{ baseUrlExample }}</div>
		</el-form-item>

		<el-form-item v-if="needsApiKey">
			<template #label>
				<FormFieldLabel :label="t('settings.api.key')" :tip="t('providerConfig.field.apiKey.tip')" />
			</template>
			<el-input
				v-model="formState.config.apiKey"
				type="password"
				show-password
				autocomplete="new-password"
				:placeholder="t('providerConfig.apiKey.placeholder')"
			/>
		</el-form-item>

		<el-form-item v-if="needsCompletionsPath">
			<template #label>
				<FormFieldLabel
					:label="t('settings.completions.path')"
					:tip="t('providerConfig.field.completionsPath.tip')"
				/>
			</template>
			<el-input
				v-model="formState.config.completionsPath"
				:placeholder="completionsPathPlaceholder"
				autocomplete="off"
			/>
		</el-form-item>

		<el-form-item v-if="needsEmbeddingsPath">
			<template #label>
				<FormFieldLabel
					:label="t('settings.embeddings.path')"
					:tip="t('providerConfig.field.embeddingsPath.tip')"
				/>
			</template>
			<el-input
				v-model="formState.config.embeddingsPath"
				:placeholder="embeddingsPathPlaceholder"
				autocomplete="off"
			/>
		</el-form-item>

		<el-form-item v-if="isEmbedding">
			<template #label>
				<FormFieldLabel
					:label="t('providerConfig.field.embeddingBatchSize')"
					:tip="t('providerConfig.field.embeddingBatchSize.tip')"
				/>
			</template>
			<el-input-number
				v-model="formState.config.embeddingBatchSize"
				:min="1"
				:max="128"
				autocomplete="off"
			/>
		</el-form-item>

		<el-form-item v-if="needsKeepAlive">
			<template #label>
				<FormFieldLabel
					:label="t('settings.keep.alive.seconds')"
					:tip="t('providerConfig.field.keepAliveSeconds.tip')"
				/>
			</template>
			<el-input-number v-model="formState.config.keepAliveSeconds" :min="0" autocomplete="off" />
		</el-form-item>

		<el-form-item v-if="needsContextLength">
			<template #label>
				<FormFieldLabel
					:label="t('settings.context.length')"
					:tip="t('providerConfig.field.contextLength.tip')"
				/>
			</template>
			<el-input-number
				v-model="formState.config.contextLength"
				:min="1"
				:controls="true"
				clearable
				:value-on-clear="null"
				:placeholder="t('providerConfig.contextLength.placeholder')"
				autocomplete="off"
			/>
		</el-form-item>

		<el-form-item v-if="needsMaxTokens" required>
			<template #label>
				<FormFieldLabel :label="t('providerConfig.maxTokens')" :tip="t('providerConfig.field.maxTokens.tip')" />
			</template>
			<el-input-number
				v-model="formState.config.maxTokens"
				:min="1"
				:placeholder="t('providerConfig.maxTokens.placeholder')"
				autocomplete="off"
			/>
		</el-form-item>

		<template v-if="isLlm">
			<div class="section-title">{{ t('providerConfig.section.runtime') }}</div>
			<el-form-item>
				<template #label>
					<FormFieldLabel :label="t('settings.temperature')" :tip="t('providerConfig.field.temperature.tip')" />
				</template>
				<el-input-number
					v-model="formState.config.temperature"
					:min="0"
					:max="2"
					:step="0.1"
					autocomplete="off"
				/>
			</el-form-item>

			<template v-if="supportsThinking">
				<el-form-item>
					<template #label>
						<FormFieldLabel
							:label="t('providerConfig.thinkingMode')"
							:tip="t('providerConfig.field.thinkingMode.tip')"
						/>
					</template>
					<el-radio-group v-model="formState.config.thinkingMode" class="thinking-mode-group">
						<el-radio-button :label="THINKING_MODE_PROVIDER_DEFAULT">
							{{ t('providerConfig.thinkingMode.providerDefault') }}
						</el-radio-button>
						<el-radio-button :label="THINKING_MODE_ON">
							{{ t('providerConfig.thinkingMode.on') }}
						</el-radio-button>
						<el-radio-button :label="THINKING_MODE_OFF">
							{{ t('providerConfig.thinkingMode.off') }}
						</el-radio-button>
					</el-radio-group>
				</el-form-item>
				<el-form-item v-if="needsThinkingBudget">
					<template #label>
						<FormFieldLabel
							:label="t('providerConfig.thinkingBudgetTokens')"
							:tip="t(thinkingBudgetTipKey)"
						/>
					</template>
					<div class="thinking-budget-field">
						<el-input-number
							v-model="formState.config.thinkingBudgetTokens"
							class="thinking-budget-input"
							:min="1"
							:step="1024"
							controls-position="right"
							autocomplete="off"
						/>
						<div class="field-hint">{{ t(thinkingBudgetHintKey) }}</div>
					</div>
				</el-form-item>
			</template>
		</template>
	</el-form>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import {
	ElForm,
	ElFormItem,
	ElInput,
	ElInputNumber,
	ElOption,
	ElRadioButton,
	ElRadioGroup,
	ElSelect,
	ElSwitch
} from 'element-plus'
import { t } from '@ai-system/lib'
import FormFieldLabel from './FormFieldLabel.vue'
import type { ProviderApiType, ProviderConfigDto } from '@/api/provider-config.api'

/** Anthropic 表单 maxTokens 缺省填写值（非运行时兜底，保存须为正整数） */
const ANTHROPIC_FORM_DEFAULT_MAX_TOKENS = 16384
/** 深度思考 budget 表单默认值（与后端 LlmThinkingSupport.DEFAULT_THINKING_BUDGET 一致） */
const DEFAULT_THINKING_BUDGET = 4096
/** LM Studio 默认服务地址（与后端 LlmBackedChatModelFactory 一致） */
const LM_STUDIO_DEFAULT_BASE_URL = 'http://127.0.0.1:1234'
const LM_STUDIO_DEFAULT_COMPLETIONS_PATH = '/v1/chat/completions'

const THINKING_MODE_PROVIDER_DEFAULT = 'provider_default'
const LEGACY_THINKING_MODE_AUTO = 'auto'
const THINKING_MODE_ON = 'on'
const THINKING_MODE_OFF = 'off'

type FormState = {
	configName: string
	providerType: string
	enabled: boolean
	makeCurrent: boolean
	description: string
	config: Record<string, any>
}

const props = defineProps<{
	apiType: ProviderApiType
	mode: 'create' | 'edit'
	source?: ProviderConfigDto | null
}>()

const emit = defineEmits<{
	(e: 'update', value: FormState): void
}>()

const isLlm = computed(() => props.apiType === 'llm')
const isEmbedding = computed(() => props.apiType === 'embedding')
const showMakeCurrent = computed(() => props.mode === 'create')

const providerOptions = computed(() => {
	if (isLlm.value) {
		return [
			{ label: t('providerConfig.provider.openai'), value: 'open-ai' },
			{ label: t('providerConfig.provider.vllm'), value: 'vllm' },
			{ label: t('providerConfig.provider.anthropic'), value: 'anthropic' },
			{ label: t('providerConfig.provider.lmStudio'), value: 'lm-studio' },
			{ label: t('providerConfig.provider.ollama'), value: 'ollama' }
		]
	}
	return [
		{ label: t('providerConfig.provider.openai'), value: 'open-ai' },
		{ label: t('providerConfig.provider.ollama'), value: 'ollama' }
	]
})

const defaultLlmConfig = () => ({
	modelName: '',
	baseUrl: '',
	apiKey: '',
	completionsPath: '',
	keepAliveSeconds: 3600,
	contextLength: undefined as number | undefined,
	maxTokens: undefined as number | undefined,
	temperature: 0.2,
	thinkingMode: THINKING_MODE_PROVIDER_DEFAULT as string,
	thinkingBudgetTokens: undefined as number | undefined
})

const defaultEmbeddingConfig = () => ({
	modelName: '',
	baseUrl: '',
	apiKey: '',
	embeddingsPath: '',
	keepAliveSeconds: 3600,
	embeddingBatchSize: 10
})

const buildInitialConfig = () => (isLlm.value ? defaultLlmConfig() : defaultEmbeddingConfig())

/** 表单内规范深度思考字段 */
function normalizeThinkingInForm(config: Record<string, any>, provider: string) {
	if (provider !== 'anthropic' && provider !== 'ollama' && provider !== 'lm-studio') {
		delete config.thinkingMode
		delete config.thinkingBudgetTokens
		return
	}
	const raw = config.thinkingMode
	let mode = typeof raw === 'string' ? raw.trim().toLowerCase() : THINKING_MODE_PROVIDER_DEFAULT
	if (mode === LEGACY_THINKING_MODE_AUTO) {
		mode = THINKING_MODE_PROVIDER_DEFAULT
	}
	if (mode !== THINKING_MODE_ON && mode !== THINKING_MODE_OFF) {
		mode = THINKING_MODE_PROVIDER_DEFAULT
	}
	config.thinkingMode = mode
	if (mode !== THINKING_MODE_ON) {
		config.thinkingBudgetTokens = undefined
	} else if (
		config.thinkingBudgetTokens == null ||
		config.thinkingBudgetTokens === undefined ||
		config.thinkingBudgetTokens === 0
	) {
		config.thinkingBudgetTokens = DEFAULT_THINKING_BUDGET
	}
}

const formState = reactive<FormState>({
	configName: '',
	providerType: isLlm.value ? 'open-ai' : 'open-ai',
	enabled: true,
	makeCurrent: false,
	description: '',
	config: buildInitialConfig()
})

watch(
	() => props.source,
	src => {
		if (!src) {
			Object.assign(formState, {
				configName: '',
				providerType: isLlm.value ? 'open-ai' : 'open-ai',
				enabled: true,
				makeCurrent: false,
				description: '',
				config: buildInitialConfig()
			})
			return
		}
		formState.configName = src.configName
		formState.providerType = src.providerType
		formState.enabled = src.enabled
		formState.makeCurrent = false
		formState.description = src.description ?? ''
		const merged = {
			...buildInitialConfig(),
			...src.config,
			apiKey: ''
		}
		if (merged.contextLength == null || merged.contextLength === 0) {
			merged.contextLength = undefined
		}
		if (src.providerType === 'anthropic' && (merged.maxTokens == null || merged.maxTokens === undefined)) {
			merged.maxTokens = ANTHROPIC_FORM_DEFAULT_MAX_TOKENS
		}
		if (!isLlm.value && (merged.embeddingBatchSize == null || merged.embeddingBatchSize === undefined)) {
			merged.embeddingBatchSize = 10
		}
		normalizeThinkingInForm(merged, src.providerType)
		formState.config = merged
	},
	{ immediate: true }
)

watch(formState, value => emit('update', value), { deep: true })

const providerType = computed(() => formState.providerType)

const needsBaseUrl = computed(() => true)
const needsApiKey = computed(() => true)
const needsCompletionsPath = computed(
	() =>
		isLlm.value &&
		(providerType.value === 'open-ai' ||
			providerType.value === 'vllm' ||
			providerType.value === 'lm-studio')
)
const needsEmbeddingsPath = computed(() => !isLlm.value && providerType.value === 'open-ai')
const needsKeepAlive = computed(() => providerType.value === 'ollama')
/** 仅 Ollama 使用 num_ctx；留空则使用模型默认上下文长度 */
const needsContextLength = computed(() => isLlm.value && providerType.value === 'ollama')
const needsMaxTokens = computed(() => isLlm.value && providerType.value === 'anthropic')
/** Anthropic / LM Studio / Ollama 支持深度思考配置 */
const supportsThinking = computed(
	() =>
		isLlm.value &&
		(providerType.value === 'anthropic' ||
			providerType.value === 'lm-studio' ||
			providerType.value === 'ollama')
)
const needsThinkingBudget = computed(
	() =>
		(providerType.value === 'anthropic' || providerType.value === 'lm-studio') &&
		formState.config.thinkingMode === THINKING_MODE_ON
)
const thinkingBudgetTipKey = computed(() =>
	providerType.value === 'lm-studio'
		? 'providerConfig.field.thinkingBudgetTokens.tip.lmStudio'
		: 'providerConfig.field.thinkingBudgetTokens.tip'
)
const thinkingBudgetHintKey = computed(() =>
	providerType.value === 'lm-studio'
		? 'providerConfig.thinkingBudgetTokens.hint.lmStudio'
		: 'providerConfig.thinkingBudgetTokens.hint'
)

/** 切换为「开启」时预填默认 budget，避免窄输入框 placeholder 显示不全 */
watch(
	() => [formState.config.thinkingMode, formState.providerType] as const,
	([mode, provider]) => {
		if ((provider === 'anthropic' || provider === 'lm-studio') && mode === THINKING_MODE_ON) {
			if (
				formState.config.thinkingBudgetTokens == null ||
				formState.config.thinkingBudgetTokens === undefined
			) {
				formState.config.thinkingBudgetTokens = DEFAULT_THINKING_BUDGET
			}
		}
	}
)

/** baseUrl 示例文案键：按 apiType + providerType 区分 */
const baseUrlExampleKey = computed(() => {
	const kind = isLlm.value ? 'llm' : 'embedding'
	const provider = providerType.value
	if (provider === 'open-ai') {
		return `providerConfig.baseUrl.example.${kind}.openAi`
	}
	if (provider === 'vllm') {
		return 'providerConfig.baseUrl.example.llm.vllm'
	}
	if (provider === 'anthropic') {
		return 'providerConfig.baseUrl.example.llm.anthropic'
	}
	if (provider === 'ollama') {
		return `providerConfig.baseUrl.example.${kind}.ollama`
	}
	if (provider === 'lm-studio') {
		return 'providerConfig.baseUrl.example.llm.lmStudio'
	}
	return `providerConfig.baseUrl.example.${kind}.openAi`
})

const baseUrlExample = computed(() => t(baseUrlExampleKey.value))

/** 输入框占位：示例见下方灰色说明区，不自动填入 URL */
const baseUrlInputPlaceholder = computed(() =>
	providerType.value === 'anthropic' ? t('providerConfig.baseUrl.optional') : ''
)

const completionsPathPlaceholder = computed(() => '/v1/chat/completions')

const embeddingsPathPlaceholder = computed(() => '/v1/embeddings')

const onProviderTypeChange = () => {
	if (providerType.value === 'ollama') {
		formState.config.completionsPath = ''
	} else if (providerType.value === 'vllm' || providerType.value === 'lm-studio') {
		if (!formState.config.completionsPath) {
			formState.config.completionsPath = LM_STUDIO_DEFAULT_COMPLETIONS_PATH
		}
	}
	if (providerType.value === 'lm-studio') {
		if (!formState.config.baseUrl) {
			formState.config.baseUrl = LM_STUDIO_DEFAULT_BASE_URL
		}
	}
	if (providerType.value !== 'ollama') {
		formState.config.contextLength = undefined
	}
	if (providerType.value === 'anthropic') {
		if (formState.config.maxTokens == null || formState.config.maxTokens === undefined) {
			formState.config.maxTokens = ANTHROPIC_FORM_DEFAULT_MAX_TOKENS
		}
	} else {
		formState.config.maxTokens = undefined
	}
	if (
		providerType.value === 'anthropic' ||
		providerType.value === 'lm-studio' ||
		providerType.value === 'ollama'
	) {
		if (!formState.config.thinkingMode) {
			formState.config.thinkingMode = THINKING_MODE_PROVIDER_DEFAULT
		}
	} else {
		formState.config.thinkingMode = undefined
		formState.config.thinkingBudgetTokens = undefined
	}
}

defineExpose({
	getValue: () => formState
})
</script>

<style scoped lang="scss">
:deep(.el-form-item.is-required:not(.is-no-asterisk) > .el-form-item__label::before) {
	font-size: 15px;
	font-weight: 700;
	line-height: 1;
	color: #e63232;
	margin-right: 6px;
	text-shadow: 0 0 1px rgba(255, 255, 255, 0.75);
}

:deep(.el-form-item__label) {
	color: var(--n-color-text-primary);
}

.autofill-trap {
	position: absolute;
	width: 0;
	height: 0;
	opacity: 0;
	pointer-events: none;
}

.form-select {
	width: 240px;
}

.section-title {
	margin: 20px 0 10px;
	font-weight: 600;
	color: var(--n-color-text-primary);
}

.field-example {
	width: 100%;
	margin-top: 8px;
	padding: 7px 10px;
	font-size: 13px;
	line-height: 1.5;
	color: var(--n-color-text-primary);
	background: color-mix(in srgb, var(--el-color-primary), transparent 92%);
	border-left: 3px solid var(--el-color-primary);
	border-radius: var(--n-radius-double);
	word-break: break-all;
}

.thinking-budget-field {
	width: 100%;
}

.thinking-budget-input {
	width: 220px;
}
</style>
