<template>
	<div
		v-if="steps.length"
		class="agent-turn-timeline"
		:class="{ expanded, 'is-turn-running': isTurnRunning }"
		:style="{ '--timeline-summary-rows': collapsedHeaderSteps.length }"
	>
		<div v-if="!expanded" class="timeline-glass">
			<button
				type="button"
				class="timeline-toggle"
				:class="{ active: isTurnRunning }"
				aria-expanded="false"
				@click="expanded = true"
			>
				<span class="toggle-steps">
					<span
						v-for="(step, hIdx) in collapsedHeaderSteps"
						:key="hIdx"
						class="timeline-step"
						:class="
							stepRowClass(
								step,
								collapsedHeaderStepIndex(hIdx)
							)
						"
					>
						<span class="step-node" aria-hidden="true">
							<span
								v-if="
									resolveStatus(
										step,
										collapsedHeaderStepIndex(hIdx)
									) === 'running'
								"
								class="step-dot step-dot--running"
							/>
							<span v-else class="step-dot step-dot--solid" />
						</span>
						<span class="step-label">
							<span class="step-state-text">{{
								labelParts(step).stateText
							}}</span>
							<code
								v-if="labelParts(step).toolName"
								class="step-inline-name"
								>{{ labelParts(step).toolName }}</code
							>
						</span>
					</span>
				</span>
				<span class="timeline-controls">
					<span class="toggle-count">{{ steps.length }}</span>
					<span class="toggle-triangle" aria-hidden="true" />
				</span>
			</button>
		</div>

		<div v-else class="timeline-glass timeline-glass--expanded">
			<button
				type="button"
				class="timeline-toggle timeline-expanded-header"
				aria-expanded="true"
				@click="expanded = false"
			>
				<span class="timeline-toolbar-spacer" aria-hidden="true" />
				<span class="timeline-controls">
					<span class="toggle-count">{{ steps.length }}</span>
					<span class="toggle-triangle expanded" aria-hidden="true" />
				</span>
			</button>
			<div class="timeline-expanded-body">
				<ul class="timeline-steps">
					<li
						v-for="(step, idx) in steps"
						:key="idx"
						class="timeline-step"
						:class="stepRowClass(step, idx)"
					>
						<span class="step-node" aria-hidden="true">
							<span
								v-if="resolveStatus(step, idx) === 'running'"
								class="step-dot step-dot--running"
							/>
							<span v-else class="step-dot step-dot--solid" />
						</span>
						<span class="step-label">
							<span class="step-state-text">{{
								labelParts(step).stateText
							}}</span>
							<code
								v-if="labelParts(step).toolName"
								class="step-inline-name"
								>{{ labelParts(step).toolName }}</code
							>
						</span>
					</li>
				</ul>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AgentState, TurnStepItem, TurnStepStatus } from '@/types/ai.types'
import {
	formatStepLabelParts,
	getCurrentLocale,
	isBusyAgentState,
	resolveTurnStepStatus
} from './agentStateI18n'

const props = withDefaults(
	defineProps<{
		steps: TurnStepItem[]
		/** 当前轮次是否 busy（末条 assistant 且非终态） */
		active?: boolean
		/** 与 envelope.state 对齐的当前状态机状态 */
		currentState?: AgentState | null
	}>(),
	{
		active: false,
		currentState: null
	}
)

const expanded = ref(false)

/** 折叠头展示最近两步（不足两步时展示全部）。 */
const collapsedHeaderSteps = computed(() => {
	const n = props.steps.length
	if (n <= 2) {
		return props.steps
	}
	return props.steps.slice(n - 2)
})

const collapsedHeaderStepIndex = (hIdx: number) =>
	props.steps.length - collapsedHeaderSteps.value.length + hIdx

const labelParts = (step: TurnStepItem) =>
	formatStepLabelParts(step, getCurrentLocale())

const timelineContext = computed(() => ({
	active: props.active,
	currentState: props.currentState
}))

/** 整轮是否处于状态机 busy 段（THINKING/STREAMING_TEXT/CALLING_TOOL/LOAD_SKILL）。 */
const isTurnRunning = computed(
	() => props.active && isBusyAgentState(props.currentState)
)

const resolveStatus = (step: TurnStepItem, idx: number): TurnStepStatus =>
	resolveTurnStepStatus(step, idx, props.steps, timelineContext.value)

const stepRowClass = (step: TurnStepItem, idx: number) => {
	const status = resolveStatus(step, idx)
	return {
		'is-running': status === 'running',
		'is-completed': status === 'completed',
		'is-failed': status === 'failed'
	}
}
</script>

<style scoped lang="scss">
@use '@/styles/platform' as *;

.agent-turn-timeline {
	margin-top: 10px;
	width: 100%;
	--timeline-summary-rows: 1;
	--timeline-header-min-height: calc(
		12px + var(--timeline-summary-rows) * 24px
	);

	&.is-turn-running .timeline-glass {
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, var(--n-glass-highlight) 98%, transparent),
			0 6px 14px rgba(0, 0, 0, 0.08),
			0 16px 40px rgba(0, 0, 0, 0.12);
	}
}

.timeline-glass {
	width: 100%;
	box-sizing: border-box;
	border-radius: 10px;
	@include n-glass-surface(2);
	background: var(--n-color-bg-glass);
	/* 覆盖 elevation 主题色散光，与聊天气泡一致用黑色投影 */
	box-shadow:
		inset 0 1px 0 color-mix(in srgb, var(--n-glass-highlight) 95%, transparent),
		0 4px 10px rgba(0, 0, 0, 0.06),
		0 12px 32px rgba(0, 0, 0, 0.1);
	overflow: hidden;
	transition:
		box-shadow 0.2s ease,
		background 0.2s ease;
}

.timeline-toggle {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	width: 100%;
	box-sizing: border-box;
	min-height: var(--timeline-header-min-height);
	padding: 6px 10px;
	border: none;
	background: transparent;
	color: var(--n-color-text-secondary, var(--el-text-color-secondary));
	font: inherit;
	font-size: 12.5px;
	line-height: 1.4;
	text-align: left;
	cursor: pointer;
	transition:
		background 0.18s ease,
		color 0.18s ease;

	&:hover {
		background: color-mix(in srgb, var(--n-color-neutral-6), transparent 92%);
		color: var(--n-color-text-primary, var(--el-text-color-primary));
	}
}

.timeline-glass--expanded .timeline-expanded-header {
	border-bottom: 1px solid var(--n-glass-border-2);
}

.timeline-expanded-body {
	padding: 4px 10px 8px;
}

.timeline-toolbar-spacer {
	flex: 1;
	min-width: 0;
}

.toggle-steps {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
}

.toggle-count {
	min-width: 16px;
	height: 16px;
	padding: 0 5px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	border-radius: 999px;
	font-size: 11px;
	line-height: 1;
	color: var(--n-color-text-secondary, var(--el-text-color-secondary));
	background: color-mix(in srgb, var(--n-color-neutral-6), transparent 88%);
	border: 1px solid var(--n-glass-border-2);
}

.timeline-controls {
	flex-shrink: 0;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	margin-top: calc(3px + 8.5px - 3px);
}

.toggle-triangle {
	flex-shrink: 0;
	width: 0;
	height: 0;
	border-left: 5px solid transparent;
	border-right: 5px solid transparent;
	border-top: 6px solid
		color-mix(in srgb, var(--n-color-neutral-6) 55%, currentColor);
	opacity: 0.85;
	transition: transform 0.2s ease;

	&.expanded {
		transform: rotate(180deg);
	}
}

.timeline-steps {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
}

.timeline-step {
	position: relative;
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 3px 0;
	padding-left: 2px;
	font-size: 12px;
	line-height: 1.5;
	color: var(--n-color-text-secondary, var(--el-text-color-secondary));

	&:not(:last-child) .step-node::after {
		content: '';
		position: absolute;
		left: 7.5px;
		top: 13px;
		bottom: -6px;
		width: 1px;
		background: linear-gradient(
			to bottom,
			color-mix(in srgb, var(--n-color-neutral-6), transparent 72%),
			color-mix(in srgb, var(--n-color-neutral-6), transparent 88%)
		);
	}

	&.is-running {
		color: var(--el-color-primary);

		.step-state-text {
			color: var(--el-color-primary);
			font-weight: 500;
		}
	}
}

.timeline-toggle.active {
	color: var(--el-color-primary);
}

.step-node {
	position: relative;
	flex-shrink: 0;
	width: 17px;
	height: 17px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	z-index: 1;
}

.step-dot {
	display: block;
	flex-shrink: 0;
	border-radius: 50%;
	transition:
		background 0.2s ease,
		box-shadow 0.2s ease,
		transform 0.2s ease;
}

.step-dot--solid {
	width: 6px;
	height: 6px;
	background: color-mix(in srgb, var(--n-color-neutral-6), transparent 30%);
	box-shadow: 0 0 0 2.5px
		color-mix(in srgb, var(--n-color-neutral-6), transparent 88%);
}

.step-dot--running {
	width: 8px;
	height: 8px;
	background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
	border: 1.5px solid
		color-mix(in srgb, var(--el-color-primary) 35%, transparent);
	border-top-color: var(--el-color-primary);
	box-shadow: 0 0 0 2px
		color-mix(in srgb, var(--el-color-primary-light-7) 55%, transparent);
	animation: step-spin 0.9s linear infinite;
}

@keyframes step-spin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

.step-label {
	flex: 1;
	min-width: 0;
	display: inline-flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: 6px;
}

.step-state-text {
	font-weight: 400;
}

.step-inline-name {
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	font-size: 11px;
	padding: 0 5px;
	border-radius: 4px;
	background: color-mix(in srgb, var(--n-color-neutral-6), transparent 92%);
	border: 1px solid var(--n-glass-border-2);
	color: var(--n-color-text-primary, var(--el-text-color-primary));
	word-break: break-all;
}
</style>
