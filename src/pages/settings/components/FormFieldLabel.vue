<template>
	<div class="field-label-with-tip">
		<span>{{ label }}</span>
		<el-tooltip v-if="tip" effect="dark" placement="top" :content="tip">
			<el-icon class="info-icon">
				<QuestionFilled />
			</el-icon>
		</el-tooltip>
	</div>
</template>

<script setup lang="ts">
import { ElIcon, ElTooltip } from 'element-plus'
import { QuestionFilled } from '@element-plus/icons-vue'

/** 表单项标签 + 感叹号说明（hover 显示 tooltip） */
defineProps<{
	label: string
	tip?: string
}>()
</script>

<style scoped lang="scss">
.field-label-with-tip {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	color: var(--n-color-text-primary);
	font-weight: 500;
}

.info-icon {
	font-size: 15px;
	color: #2b6afd;
	cursor: help;
	filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.7));
}
</style>
