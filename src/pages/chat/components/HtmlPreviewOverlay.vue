<template>
	<Teleport to="body">
		<Transition name="html-preview-fade" appear>
			<div
				v-if="visible"
				ref="overlayRef"
				class="html-preview-wrapper"
				tabindex="-1"
			>
				<div class="html-preview-mask" @click="emit('close')" />

				<button
					type="button"
					class="html-preview-close"
					aria-label="关闭预览"
					@click="emit('close')"
				>
					<ElIcon><Close /></ElIcon>
				</button>

				<span
					v-if="!isSingle"
					class="html-preview-btn html-preview-prev"
					:class="{ 'is-disabled': !infinite && isFirst }"
					@click="prev"
				>
					<ElIcon><ArrowLeft /></ElIcon>
				</span>

				<span
					v-if="!isSingle"
					class="html-preview-btn html-preview-next"
					:class="{ 'is-disabled': !infinite && isLast }"
					@click="next"
				>
					<ElIcon><ArrowRight /></ElIcon>
				</span>

				<div v-if="!isSingle" class="html-preview-progress">
					{{ activeIndex + 1 }} / {{ sources.length }}
				</div>

				<div class="html-preview-panel">
					<iframe
						ref="iframeRef"
						class="html-preview-frame"
						:srcdoc="currentSrcdoc"
						sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
						scrolling="auto"
						title="HTML 预览"
					/>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup lang="ts">
import { ArrowLeft, ArrowRight, Close } from '@element-plus/icons-vue'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { ElIcon } from 'element-plus'
import {
	buildMarkdownHtmlPreviewSrcdoc,
	resizeMarkdownHtmlPreviewExpanded
} from '@/utils/markdownRenderer'

const props = withDefaults(
	defineProps<{
		visible: boolean
		sources: string[]
		initialIndex?: number
		infinite?: boolean
	}>(),
	{
		initialIndex: 0,
		infinite: true
	}
)

const emit = defineEmits<{
	close: []
}>()

const overlayRef = ref<HTMLElement>()
const iframeRef = ref<HTMLIFrameElement>()
const activeIndex = ref(0)

const isSingle = computed(() => props.sources.length <= 1)
const isFirst = computed(() => activeIndex.value <= 0)
const isLast = computed(
	() => activeIndex.value >= props.sources.length - 1
)
const currentSrcdoc = computed(() =>
	buildMarkdownHtmlPreviewSrcdoc(props.sources[activeIndex.value] ?? '')
)

const fitExpandedIframe = () => {
	const iframe = iframeRef.value
	if (!iframe) {
		return
	}
	resizeMarkdownHtmlPreviewExpanded(iframe)
}

const onIframeLoad = () => {
	fitExpandedIframe()
}

const setActiveIndex = (index: number) => {
	if (!props.sources.length) {
		return
	}
	const len = props.sources.length
	let nextIndex = index
	if (props.infinite) {
		nextIndex = ((index % len) + len) % len
	} else {
		nextIndex = Math.min(Math.max(index, 0), len - 1)
	}
	activeIndex.value = nextIndex
}

const prev = () => {
	if (!props.infinite && isFirst.value) {
		return
	}
	setActiveIndex(activeIndex.value - 1)
}

const next = () => {
	if (!props.infinite && isLast.value) {
		return
	}
	setActiveIndex(activeIndex.value + 1)
}

let prevBodyOverflow = ''

watch(
	() => props.visible,
	(visible) => {
		if (visible) {
			prevBodyOverflow = document.body.style.overflow
			document.body.style.overflow = 'hidden'
			activeIndex.value = Math.min(
				Math.max(props.initialIndex, 0),
				Math.max(props.sources.length - 1, 0)
			)
			nextTick(() => overlayRef.value?.focus())
			return
		}
		document.body.style.overflow = prevBodyOverflow
	},
	{ immediate: true }
)

watch(
	() => [props.visible, activeIndex.value, currentSrcdoc.value] as const,
	([visible]) => {
		if (!visible) {
			return
		}
		nextTick(() => {
			const iframe = iframeRef.value
			if (!iframe) {
				return
			}
			iframe.removeEventListener('load', onIframeLoad)
			iframe.addEventListener('load', onIframeLoad, { once: true })
			if (iframe.contentDocument?.readyState === 'complete') {
				fitExpandedIframe()
			}
		})
	}
)

onUnmounted(() => {
	document.body.style.overflow = prevBodyOverflow
	iframeRef.value?.removeEventListener('load', onIframeLoad)
})
</script>

<style scoped lang="scss">
.html-preview-wrapper {
	position: fixed;
	inset: 0;
	z-index: 2050;
	outline: none;
}

.html-preview-mask {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.5);
}

.html-preview-close {
	position: absolute;
	z-index: 3;
	top: 24px;
	right: 24px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 40px;
	height: 40px;
	padding: 0;
	border: none;
	border-radius: 50%;
	background: rgba(96, 98, 102, 0.85);
	color: #fff;
	font-size: 20px;
	cursor: pointer;

	&:hover {
		background: rgba(96, 98, 102, 1);
	}
}

.html-preview-panel {
	position: absolute;
	z-index: 1;
	top: 72px;
	right: 24px;
	bottom: 24px;
	left: 24px;
	overflow: auto;
	border-radius: 12px;
	background: #fff;
	box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
	-webkit-overflow-scrolling: touch;
}

.html-preview-frame {
	display: block;
	width: 100%;
	min-height: 100%;
	border: none;
	background: #fff;
}

.html-preview-btn,
.html-preview-progress {
	pointer-events: auto;
}

.html-preview-btn {
	position: absolute;
	z-index: 2;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 44px;
	height: 44px;
	border-radius: 50%;
	background: rgba(96, 98, 102, 0.8);
	color: #fff;
	font-size: 24px;
	cursor: pointer;
	user-select: none;

	&:hover:not(.is-disabled) {
		background: rgba(96, 98, 102, 1);
	}

	&.is-disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
}

.html-preview-prev {
	top: 50%;
	left: 40px;
	transform: translateY(-50%);
}

.html-preview-next {
	top: 50%;
	right: 40px;
	transform: translateY(-50%);
}

.html-preview-progress {
	position: absolute;
	z-index: 2;
	left: 50%;
	bottom: 40px;
	transform: translateX(-50%);
	color: #fff;
	font-size: 14px;
	line-height: 1.4;
}

.html-preview-fade-enter-active,
.html-preview-fade-leave-active {
	transition: opacity 0.2s ease;
}

.html-preview-fade-enter-from,
.html-preview-fade-leave-to {
	opacity: 0;
}
</style>
