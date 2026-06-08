<template>
	<div
		v-if="content?.trim()"
		class="agent-thinking-block"
		:class="{ expanded, 'is-active': active }"
	>
		<div class="thinking-glass">
			<button
				type="button"
				class="thinking-toggle"
				:aria-expanded="expanded"
				@click="expanded = !expanded"
			>
				<span class="thinking-title">{{ titleLabel }}</span>
				<span class="thinking-controls">
					<span
						class="thinking-triangle"
						:class="{ expanded }"
						aria-hidden="true"
					/>
				</span>
			</button>
			<div v-if="!expanded" ref="previewRef" class="thinking-preview-scroll">
				<div class="thinking-preview-content thinking-plain-text">{{ content }}</div>
			</div>
			<div v-else class="thinking-body">
				<div class="thinking-full-content thinking-plain-text">{{ content }}</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { getCurrentLocale } from '../ts/stream/agent-ui'

const props = withDefaults(
	defineProps<{
		/** Provider reasoningContent 全文 */
		content: string
		/** 当前轮次是否 busy（流式中高亮折叠头） */
		active?: boolean
	}>(),
	{
		active: false
	}
)

const expanded = ref(false)
const previewRef = ref<HTMLElement | null>(null)

const titleLabel = computed(() => {
	const locale = getCurrentLocale()
	return locale === 'zh' ? '深度思考' : 'Deep thinking'
})

const scrollPreviewToBottom = () => {
	const el = previewRef.value
	if (!el) {
		return
	}
	el.scrollTop = el.scrollHeight
}

watch(
	() => [props.content, props.active, expanded.value] as const,
	() => {
		if (expanded.value || !props.active) {
			return
		}
		nextTick(scrollPreviewToBottom)
	}
)
</script>

<style scoped lang="scss">
.agent-thinking-block {
	margin-bottom: 8px;
	width: 100%;
	font-size: 12px;
	line-height: 1.55;
	color: var(--n-topbar-text);

	&.is-active .thinking-glass {
		box-shadow:
			var(--n-dark-panel-shadow),
			0 8px 24px rgba(0, 0, 0, 0.2);
	}
}

/* 深色染色毛玻璃（比顶栏更黑）+ 浅色文字 */
.thinking-glass {
	width: 100%;
	box-sizing: border-box;
	border-radius: 10px;
	background: var(--n-dark-panel-bg);
	backdrop-filter: blur(var(--n-dark-panel-blur)) saturate(var(--n-dark-panel-saturate));
	-webkit-backdrop-filter: blur(var(--n-dark-panel-blur))
		saturate(var(--n-dark-panel-saturate));
	border: 1px solid var(--n-dark-panel-border);
	box-shadow: var(--n-dark-panel-shadow);
	overflow: hidden;
	isolation: isolate;
}

.thinking-toggle {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	box-sizing: border-box;
	padding: 7px 10px;
	border: none;
	background: var(--n-topbar-hover-bg);
	color: var(--n-topbar-text);
	font: inherit;
	font-size: 12px;
	font-style: italic;
	text-align: left;
	cursor: pointer;
	transition:
		background 0.18s ease,
		color 0.18s ease;

	&:hover {
		background: color-mix(in srgb, var(--n-topbar-text) 14%, transparent);
	}
}

.thinking-title {
	flex: 1;
	font-size: 12px;
	font-weight: 600;
	font-style: italic;
	letter-spacing: 0.04em;
	color: var(--n-topbar-text);
	text-shadow: var(--n-topbar-text-shadow);
}

.thinking-controls {
	flex-shrink: 0;
	display: inline-flex;
	align-items: center;
}

.thinking-triangle {
	flex-shrink: 0;
	width: 0;
	height: 0;
	border-left: 4px solid transparent;
	border-right: 4px solid transparent;
	border-top: 5px solid var(--n-topbar-text);
	transition: transform 0.18s ease;

	&.expanded {
		transform: rotate(180deg);
	}
}

.thinking-preview-scroll {
	position: relative;
	max-height: 72px;
	overflow-y: auto;
	padding: 4px 10px 8px;
	border-top: 1px solid var(--n-topbar-divider);
	scroll-behavior: smooth;
	scrollbar-width: none;
	-ms-overflow-style: none;

	&::-webkit-scrollbar {
		display: none;
		width: 0;
		height: 0;
	}

	mask-image: linear-gradient(
		to bottom,
		transparent 0%,
		#000 12px,
		#000 100%
	);
}

.thinking-body {
	padding: 4px 10px 8px;
	border-top: 1px solid var(--n-topbar-divider);
}

.thinking-plain-text {
	word-break: break-word;
	white-space: pre-wrap;
	font-style: italic;
	color: var(--n-topbar-text-muted);
}
</style>
