<template>
	<Teleport to="body">
		<Transition name="md-viewer-fade" appear>
			<div
				v-if="visible"
				ref="overlayRef"
				class="md-viewer-wrapper"
				tabindex="-1"
			>
				<div class="md-viewer-mask" @click="emit('close')" />

				<div class="md-viewer-shell">
					<div class="md-viewer-panel">
						<header
							class="md-viewer-header"
							:class="{ 'md-viewer-header--single': isSingle }"
						>
							<div v-if="!isSingle" class="md-viewer-nav">
								<button
									type="button"
									class="md-viewer-nav-btn"
									:class="{ 'is-disabled': !infinite && isFirst }"
									:aria-label="t('mdViewer.prev')"
									@click="prev"
								>
									<ElIcon><ArrowLeft /></ElIcon>
								</button>
								<span class="md-viewer-progress">
									{{ activeIndex + 1 }} / {{ sources.length }}
								</span>
								<button
									type="button"
									class="md-viewer-nav-btn"
									:class="{ 'is-disabled': !infinite && isLast }"
									:aria-label="t('mdViewer.next')"
									@click="next"
								>
									<ElIcon><ArrowRight /></ElIcon>
								</button>
							</div>

							<h2 class="md-viewer-title">{{ currentTitle }}</h2>

							<div class="md-viewer-header__actions">
								<button
									type="button"
									class="md-viewer-action-btn"
									:disabled="!canDownload"
									:title="t('mdViewer.download')"
									:aria-label="t('mdViewer.download')"
									@click="downloadCurrentMarkdown"
								>
									<ElIcon><Download /></ElIcon>
									<span>{{ t('mdViewer.download') }}</span>
								</button>
								<button
									type="button"
									class="md-viewer-action-btn md-viewer-action-btn--icon"
									:aria-label="t('mdViewer.close')"
									@click="emit('close')"
								>
									<ElIcon><Close /></ElIcon>
								</button>
							</div>
						</header>

					<div
						v-if="loading"
						class="md-viewer-state"
						role="status"
						aria-live="polite"
					>
						<ElIcon class="md-viewer-spinner"><Loading /></ElIcon>
						<span>{{ t('mdViewer.loading') }}</span>
					</div>

					<div v-else-if="error" class="md-viewer-state md-viewer-state--error">
						{{ error }}
					</div>

						<div
							v-else
							ref="contentRef"
							class="md-viewer-content message-md"
							@click="handleContentClick"
							v-html="renderedHtml"
						/>
					</div>
				</div>

				<ElImageViewer
					v-if="imagePreviewVisible"
					:url-list="imagePreviewUrlList"
					:initial-index="imagePreviewIndex"
					hide-on-click-modal
					@close="closeImagePreview"
				/>
				<DiagramPreviewOverlay
					:visible="diagramPreviewVisible"
					:diagrams="diagramPreviewSvgs"
					:initial-index="diagramPreviewIndex"
					@close="closeDiagramPreview"
				/>
				<HtmlPreviewOverlay
					:visible="htmlPreviewVisible"
					:sources="htmlPreviewSources"
					:initial-index="htmlPreviewIndex"
					@close="closeHtmlPreview"
				/>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup lang="ts">
import {
	ArrowLeft,
	ArrowRight,
	Close,
	Download,
	Loading
} from '@element-plus/icons-vue'
import {
	computed,
	nextTick,
	onUnmounted,
	ref,
	watch
} from 'vue'
import { ElIcon, ElImageViewer, ElMessage } from 'element-plus'
import { t } from '@ai-system/lib'
import DiagramPreviewOverlay from './DiagramPreviewOverlay.vue'
import HtmlPreviewOverlay from './HtmlPreviewOverlay.vue'
import { cloneSvgForPreview } from '@/utils/diagramPreview'
import {
	getMarkdownCodeBlockText,
	getMarkdownHtmlBlockSource,
	preloadDiagramRuntimes,
	renderMarkdown,
	renderMarkdownBlocks
} from '@/utils/markdownRenderer'
import {
	normalizeMarkdownRepoFileUrls,
	rewriteMarkdownRelativeRepoUrls
} from '@/utils/repoFileUrl'

export type MdViewerSource = {
	url: string
	title: string
	relativePath?: string
}

const props = withDefaults(
	defineProps<{
		visible: boolean
		sources: MdViewerSource[]
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
const contentRef = ref<HTMLElement>()
const activeIndex = ref(0)
const loading = ref(false)
const error = ref('')
const rawMarkdown = ref('')
let fetchToken = 0
let preloadStarted = false

const imagePreviewVisible = ref(false)
const imagePreviewUrlList = ref<string[]>([])
const imagePreviewIndex = ref(0)
const diagramPreviewVisible = ref(false)
const diagramPreviewSvgs = ref<SVGElement[]>([])
const diagramPreviewIndex = ref(0)
const htmlPreviewVisible = ref(false)
const htmlPreviewSources = ref<string[]>([])
const htmlPreviewIndex = ref(0)

const isSingle = computed(() => props.sources.length <= 1)
const isFirst = computed(() => activeIndex.value <= 0)
const isLast = computed(
	() => activeIndex.value >= props.sources.length - 1
)
const currentSource = computed(
	() => props.sources[activeIndex.value] ?? null
)
const currentTitle = computed(() => currentSource.value?.title || '')

const downloadFilename = computed(() => {
	const relativePath = currentSource.value?.relativePath?.trim()
	if (relativePath) {
		const name = relativePath.split('/').pop() || relativePath
		if (/\.md$/i.test(name)) {
			return name
		}
	}
	const title = currentTitle.value.trim()
	if (title && /\.md$/i.test(title)) {
		return title
	}
	if (title) {
		return `${title}.md`
	}
	return 'document.md'
})

const canDownload = computed(() => !!currentSource.value?.url)

const downloadCurrentMarkdown = () => {
	const source = currentSource.value
	if (!source?.url) {
		return
	}
	const filename = downloadFilename.value
	if (rawMarkdown.value) {
		const blob = new Blob([rawMarkdown.value], {
			type: 'text/markdown;charset=utf-8'
		})
		const objectUrl = URL.createObjectURL(blob)
		const anchor = document.createElement('a')
		anchor.href = objectUrl
		anchor.download = filename
		anchor.click()
		URL.revokeObjectURL(objectUrl)
		return
	}
	const anchor = document.createElement('a')
	anchor.href = source.url
	anchor.download = filename
	anchor.rel = 'noopener noreferrer'
	anchor.target = '_blank'
	anchor.click()
}

const prepareMarkdown = (text: string, relativePath?: string) => {
	let markdown = text
	if (relativePath?.trim()) {
		markdown = rewriteMarkdownRelativeRepoUrls(markdown, relativePath)
	}
	markdown = normalizeMarkdownRepoFileUrls(markdown)
	return markdown
}

const renderedHtml = computed(() => renderMarkdown(prepareMarkdown(rawMarkdown.value, currentSource.value?.relativePath)))

const loadCurrentSource = async () => {
	const source = currentSource.value
	if (!source?.url) {
		rawMarkdown.value = ''
		error.value = t('mdViewer.loadFailed')
		loading.value = false
		return
	}
	const token = ++fetchToken
	loading.value = true
	error.value = ''
	rawMarkdown.value = ''
	try {
		const response = await fetch(source.url, { credentials: 'include' })
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`)
		}
		const text = await response.text()
		if (token !== fetchToken) {
			return
		}
		rawMarkdown.value = text
	} catch {
		if (token !== fetchToken) {
			return
		}
		error.value = t('mdViewer.loadFailed')
	} finally {
		if (token === fetchToken) {
			loading.value = false
		}
	}
}

const activateMarkdown = async () => {
	await nextTick()
	const root = contentRef.value
	if (!root) {
		return
	}
	await renderMarkdownBlocks(root)
}

const ensureDiagramPreload = () => {
	if (preloadStarted) {
		return
	}
	preloadStarted = true
	preloadDiagramRuntimes()
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

const copyText = async (content?: string) => {
	if (!content) {
		return
	}
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(content)
		} else {
			const textarea = document.createElement('textarea')
			textarea.value = content
			textarea.style.position = 'fixed'
			textarea.style.opacity = '0'
			document.body.appendChild(textarea)
			textarea.select()
			document.execCommand('copy')
			document.body.removeChild(textarea)
		}
		ElMessage.success(t('common.success'))
	} catch {
		ElMessage.error(t('common.fail'))
	}
}

const closeImagePreview = () => {
	imagePreviewVisible.value = false
}

const closeDiagramPreview = () => {
	diagramPreviewVisible.value = false
	diagramPreviewSvgs.value = []
}

const closeHtmlPreview = () => {
	htmlPreviewVisible.value = false
	htmlPreviewSources.value = []
}

const openImagePreview = (
	messageContent: Element,
	targetImg: HTMLImageElement
) => {
	closeDiagramPreview()
	closeHtmlPreview()
	const imgs = messageContent.querySelectorAll('img')
	const urlList: string[] = []
	let index = 0
	imgs.forEach((el) => {
		const src = (el as HTMLImageElement).src?.trim()
		if (!src) {
			return
		}
		if (el === targetImg) {
			index = urlList.length
		}
		urlList.push(src)
	})
	if (!urlList.length) {
		return
	}
	imagePreviewUrlList.value = urlList
	imagePreviewIndex.value = index
	imagePreviewVisible.value = true
}

const openDiagramPreview = (
	messageContent: Element,
	targetSvg: SVGElement
) => {
	closeImagePreview()
	closeHtmlPreview()
	const svgs = messageContent.querySelectorAll(
		'.md-diagram:not(.md-diagram-error) .md-diagram-body svg'
	)
	const clones: SVGElement[] = []
	let index = 0
	svgs.forEach((el) => {
		if (!(el instanceof SVGElement)) {
			return
		}
		if (el === targetSvg) {
			index = clones.length
		}
		clones.push(cloneSvgForPreview(el))
	})
	if (!clones.length) {
		return
	}
	diagramPreviewSvgs.value = clones
	diagramPreviewIndex.value = index
	diagramPreviewVisible.value = true
}

const openHtmlPreview = (
	messageContent: Element,
	targetWrap: HTMLElement
) => {
	closeImagePreview()
	closeDiagramPreview()
	const blocks = messageContent.querySelectorAll(
		'.md-html-block[data-md-rendered="true"]'
	)
	const sources: string[] = []
	let index = 0
	blocks.forEach((block) => {
		const wrap = block.querySelector('.md-html-preview-wrap')
		const source = getMarkdownHtmlBlockSource(block)
		if (!source.trim()) {
			return
		}
		if (wrap === targetWrap) {
			index = sources.length
		}
		sources.push(source)
	})
	if (!sources.length) {
		return
	}
	htmlPreviewSources.value = sources
	htmlPreviewIndex.value = index
	htmlPreviewVisible.value = true
}

const handleContentClick = (event: MouseEvent) => {
	const target = event.target
	if (!(target instanceof Element)) {
		return
	}
	const messageContent = target.closest('.md-viewer-content')
	if (!messageContent) {
		return
	}

	const copyBtn = target.closest('.md-code-copy')
	if (copyBtn) {
		event.preventDefault()
		event.stopPropagation()
		const block = copyBtn.closest('.md-code-block')
		if (block) {
			void copyText(getMarkdownCodeBlockText(block))
		}
		return
	}

	const htmlPreviewWrap = target.closest(
		'.md-html-preview-wrap:not(.md-block-pending)'
	)
	if (htmlPreviewWrap instanceof HTMLElement) {
		event.preventDefault()
		event.stopPropagation()
		openHtmlPreview(messageContent, htmlPreviewWrap)
		return
	}

	if (target instanceof HTMLImageElement) {
		openImagePreview(messageContent, target)
		return
	}

	const diagramBody = target.closest('.md-diagram-body')
	if (!diagramBody || diagramBody.closest('.md-diagram-error')) {
		return
	}
	const svg = diagramBody.querySelector('svg')
	if (!(svg instanceof SVGElement)) {
		return
	}
	openDiagramPreview(messageContent, svg)
}

let prevBodyOverflow = ''

const handleKeydown = (event: KeyboardEvent) => {
	if (event.key !== 'Escape') {
		return
	}
	if (
		event.target instanceof Element &&
		event.target.closest('.el-image-viewer__wrapper')
	) {
		return
	}
	event.preventDefault()
	if (htmlPreviewVisible.value) {
		closeHtmlPreview()
		return
	}
	if (diagramPreviewVisible.value) {
		closeDiagramPreview()
		return
	}
	if (imagePreviewVisible.value) {
		return
	}
	emit('close')
}

const registerKeydownListener = () => {
	document.addEventListener('keydown', handleKeydown)
}

const unregisterKeydownListener = () => {
	document.removeEventListener('keydown', handleKeydown)
}

watch(
	() => props.visible,
	(visible) => {
		if (visible) {
			prevBodyOverflow = document.body.style.overflow
			document.body.style.overflow = 'hidden'
			registerKeydownListener()
			activeIndex.value = Math.min(
				Math.max(props.initialIndex, 0),
				Math.max(props.sources.length - 1, 0)
			)
			ensureDiagramPreload()
			void loadCurrentSource()
			nextTick(() => overlayRef.value?.focus())
			return
		}
		unregisterKeydownListener()
		document.body.style.overflow = prevBodyOverflow
		fetchToken++
		rawMarkdown.value = ''
		error.value = ''
		loading.value = false
		closeImagePreview()
		closeDiagramPreview()
		closeHtmlPreview()
	},
	{ immediate: true }
)

watch(
	() => activeIndex.value,
	() => {
		if (!props.visible) {
			return
		}
		void loadCurrentSource()
	}
)

watch(
	() => [props.visible, loading.value, renderedHtml.value] as const,
	([visible, isLoading, html]) => {
		if (!visible || isLoading || !html) {
			return
		}
		void activateMarkdown()
	},
	{ flush: 'post' }
)

onUnmounted(() => {
	unregisterKeydownListener()
	document.body.style.overflow = prevBodyOverflow
	fetchToken++
})
</script>

<style scoped lang="scss">
@use '@/styles/platform' as *;

.md-viewer-wrapper {
	position: fixed;
	inset: 0;
	z-index: 2040;
	outline: none;
}

.md-viewer-mask {
	position: absolute;
	inset: 0;
	background: color-mix(in srgb, var(--n-color-font-dark, #000) 28%, transparent);
	backdrop-filter: blur(var(--n-glass-blur-2)) saturate(var(--n-glass-saturate));
	-webkit-backdrop-filter: blur(var(--n-glass-blur-2)) saturate(var(--n-glass-saturate));
}

.md-viewer-shell {
	position: absolute;
	z-index: 1;
	top: 24px;
	right: 24px;
	bottom: 24px;
	left: 24px;
	display: flex;
}

.md-viewer-panel {
	display: flex;
	flex: 1;
	flex-direction: column;
	min-width: 0;
	overflow: hidden;
	border-radius: 16px;
	@include n-glass-surface(3);
	border: 1px solid var(--n-glass-border-2);
}

.md-viewer-header {
	display: grid;
	flex-shrink: 0;
	grid-template-columns: auto minmax(0, 1fr) auto;
	align-items: center;
	gap: 10px;
	padding: 14px 14px 12px;
	border-bottom: 1px solid var(--n-glass-border-1);

	&--single {
		grid-template-columns: minmax(0, 1fr) auto;
	}
}

.md-viewer-nav {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 2px;
	border-radius: 999px;
	background: var(--n-color-bg-glass-weak);
	border: 1px solid var(--n-glass-border-1);
}

.md-viewer-nav-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	padding: 0;
	border: none;
	border-radius: 50%;
	background: transparent;
	color: var(--n-color-text-primary);
	font-size: 16px;
	cursor: pointer;

	&:hover:not(.is-disabled) {
		background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
		color: var(--el-color-primary);
	}

	&.is-disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
}

.md-viewer-progress {
	min-width: 42px;
	color: var(--n-color-text-muted);
	font-size: 12px;
	line-height: 1;
	text-align: center;
	white-space: nowrap;
}

.md-viewer-title {
	min-width: 0;
	margin: 0;
	font-size: 15px;
	font-weight: 600;
	line-height: 1.4;
	color: var(--n-color-text-primary);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.md-viewer-header__actions {
	display: inline-flex;
	align-items: center;
	gap: 6px;
}

.md-viewer-action-btn {
	display: inline-flex;
	flex-shrink: 0;
	align-items: center;
	gap: 6px;
	padding: 6px 10px;
	border: 1px solid var(--n-glass-border-2);
	border-radius: 999px;
	background: var(--n-color-bg-glass-weak);
	color: var(--n-color-text-primary);
	font-size: 12px;
	line-height: 1.4;
	cursor: pointer;
	white-space: nowrap;

	&:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--el-color-primary) 40%, transparent);
		color: var(--el-color-primary);
	}

	&:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	&--icon {
		width: 32px;
		height: 32px;
		justify-content: center;
		padding: 0;
		font-size: 16px;
	}
}

.md-viewer-content {
	flex: 1;
	min-height: 0;
	overflow: auto;
	padding: 14px 16px 20px;
	-webkit-overflow-scrolling: touch;
}

.md-viewer-state {
	display: flex;
	flex: 1;
	align-items: center;
	justify-content: center;
	gap: 10px;
	padding: 24px;
	color: var(--n-color-text-muted);
	font-size: 14px;
}

.md-viewer-state--error {
	color: var(--el-color-danger);
}

.md-viewer-spinner {
	font-size: 20px;
	animation: md-viewer-spin 1s linear infinite;
}

.md-viewer-fade-enter-active,
.md-viewer-fade-leave-active {
	transition: opacity 0.2s ease;
}

.md-viewer-fade-enter-from,
.md-viewer-fade-leave-to {
	opacity: 0;
}

@keyframes md-viewer-spin {
	to {
		transform: rotate(360deg);
	}
}
</style>
