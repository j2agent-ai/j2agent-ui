<template>
  <div class="ask-question-card">
    <div class="ask-question-card__body">
      <div class="ask-question-card__title">
        {{ question.question }}
      </div>
      <div
        v-if="question.options?.length"
        class="ask-question-card__options"
      >
        <ElButton
          v-for="option in question.options"
          :key="option"
          size="small"
          type="primary"
          plain
          :disabled="disabled || pending"
          @click.stop="emitAnswer(option)"
        >
          {{ option }}
        </ElButton>
      </div>
      <div class="ask-question-card__custom">
        <ElInput
          v-model="customAnswer"
          size="small"
          :placeholder="t('ai.askQuestion.customPlaceholder')"
          :disabled="disabled || pending"
          maxlength="2000"
          @keydown.enter.prevent="submitCustomAnswer"
        />
        <ElButton
          class="ask-question-card__send-button"
          size="small"
          type="primary"
          circle
          :disabled="disabled || pending"
          :aria-label="t('ai.askQuestion.confirm')"
          @click.stop="submitCustomAnswer"
        >
          <ElIcon>
            <Position />
          </ElIcon>
        </ElButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Position } from '@element-plus/icons-vue'
import { ElButton, ElIcon, ElInput, ElMessage } from 'element-plus'
import { t } from '@ai-system/lib'
import type { AskQuestion } from '@/types/ai.types'

const props = defineProps<{
  question: AskQuestion
  disabled?: boolean
  pending?: boolean
}>()

const emit = defineEmits<{
  answer: [answer: string]
}>()

const customAnswer = ref('')

watch(
	() => props.question,
	() => {
		customAnswer.value = ''
	}
)

const emitAnswer = (answer: string) => {
	const normalized = answer.trim()
	if (!normalized) {
		ElMessage.warning(t('ai.askQuestion.empty'))
		return
	}
	emit('answer', normalized)
}

const submitCustomAnswer = () => {
	emitAnswer(customAnswer.value)
}
</script>

<style scoped lang="scss">
.ask-question-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.ask-question-card__body {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary), transparent 72%);
  border-radius: 8px;
  background: color-mix(in srgb, var(--el-color-primary-light-9), transparent 20%);
}

.ask-question-card__title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--n-color-text-primary);
  overflow-wrap: anywhere;
}

.ask-question-card__options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.ask-question-card__options :deep(.el-button) {
  max-width: 100%;
  height: auto;
  min-height: 26px;
  white-space: normal;
  text-align: left;
  overflow-wrap: anywhere;
}

.ask-question-card__custom {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  margin-top: 10px;
}

.ask-question-card__send-button {
  width: 28px;
  height: 28px;
}

@media (max-width: 520px) {
  .ask-question-card__custom {
    grid-template-columns: minmax(0, 1fr) auto;
  }
}
</style>
