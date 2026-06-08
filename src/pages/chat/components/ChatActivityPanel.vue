<template>
	<Teleport to="body">
		<div
			v-if="isDragging"
			class="activity-drag-shield"
			aria-hidden="true"
		/>
	</Teleport>
	<div
		v-show="isVisible"
		ref="rootRef"
		class="chat-activity-panel"
		:class="{ 'is-shell-animating': shellAnimating }"
		:style="rootStyle"
	>
		<div
			ref="shellRef"
			class="activity-shell"
			:class="[
				`quadrant-${popupQuadrant}`,
				{ 'is-open': panelOpen, 'is-active': activeCount > 0 }
			]"
			:style="shellStyle"
			@transitionend="onShellTransitionEnd"
		>
			<button
				ref="fabRef"
				type="button"
				class="activity-fab-trigger"
				:aria-label="fabLabel"
				:aria-expanded="panelOpen"
				:title="fabLabel"
				@pointerdown="onFabPointerDown"
			>
				<span class="activity-fab-inner" aria-hidden="true">
					<span class="activity-fab-breathe" />
					<span class="activity-fab-core" />
				</span>
				<span
					v-if="activeCount > 0 && !panelOpen"
					class="activity-fab-badge"
					aria-hidden="true"
				>{{ activeCount }}</span>
			</button>

			<div
				class="activity-panel-body"
				role="dialog"
				:aria-label="t('ai.activity.panel.title')"
				:aria-hidden="!panelOpen"
			>
				<div class="activity-panel-header" @pointerdown="onHeaderPointerDown">
					<span class="activity-panel-title">
						{{ t('ai.activity.panel.title') }}
						<span v-if="activeCount > 0" class="activity-panel-count">{{ activeCount }}</span>
					</span>
				</div>
				<div v-if="sortedEntries.length === 0" class="activity-panel-empty">
					<p class="activity-panel-empty-text">{{ t('ai.activity.panel.empty') }}</p>
					<p class="activity-panel-empty-hint">{{ t('ai.activity.panel.empty.hint') }}</p>
					<button
						type="button"
						class="activity-panel-empty-cta n-glass-button"
						@click.stop="goToAgents"
					>
						{{ t('ai.activity.panel.empty.cta') }}
					</button>
				</div>
				<ul v-else class="activity-panel-list">
					<li
						v-for="entry in sortedEntries"
						:key="entry.sessionKey"
						class="activity-panel-item"
						@click.stop="handleEntryClick(entry)"
					>
						<span class="streaming-orb" aria-hidden="true" />
						<div class="activity-panel-item-body">
							<p class="activity-panel-item-title">{{ displayFor(entry).title }}</p>
							<p class="activity-panel-item-meta">
								<span class="activity-panel-item-agent">{{ displayFor(entry).agentName }}</span>
								<span v-if="displayFor(entry).stateText" class="activity-panel-item-state">
									{{ displayFor(entry).stateText }}
								</span>
							</p>
						</div>
					</li>
				</ul>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { t } from '@ai-system/lib'
import { getAgentList } from '@/api/ai.api'
import type { AgentInfoDto } from '@/types/ai.types'
import { chatActivityStore } from '../chatActivityStore'
import type { ChatActivityEntry } from '../chatActivityStore'
import { goTo } from '@/routes'
import { hasRoleAccess, ROLE_USER } from '@/utils/role'
import { openChatSession } from '../openChatSession'
import { resolveActiveEntryDisplay } from '../resolveActiveEntryDisplay'

const STORAGE_KEY = 'chat-activity-fab-pos'
const FAB_SIZE = 52
const EDGE_MARGIN = 24
const TOPBAR_GAP = 8
const BELOW_TOPBAR_GAP = 16
const PANEL_MAX_WIDTH = 320
const PANEL_MAX_HEIGHT = 360
const PANEL_VIEWPORT_PAD = 48
const DRAG_THRESHOLD = 5

type PopupQuadrant = 'bl' | 'br' | 'tl' | 'tr'
const AUTH_ROUTE_PATHS = new Set([
	'/login',
	'/logout',
	'/register',
	'/forgot-password'
])

const route = useRoute()
const rootRef = ref<HTMLElement | null>(null)
const shellRef = ref<HTMLElement | null>(null)
const fabRef = ref<HTMLButtonElement | null>(null)
const panelOpen = ref(false)
const shellAnimating = ref(false)
const isDragging = ref(false)

const getTopbarBottom = () => {
	const el = document.querySelector('.top-bar')
	if (el instanceof HTMLElement) {
		const rect = el.getBoundingClientRect()
		if (rect.height > 0) {
			return rect.bottom
		}
	}
	const cssHeight = getComputedStyle(document.documentElement)
		.getPropertyValue('--n-topbar-height')
		.trim()
	const parsed = Number.parseFloat(cssHeight)
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 50
}

const getMinBallTop = () => getTopbarBottom() + TOPBAR_GAP

const createDefaultPos = () => ({
	left: Math.max(0, window.innerWidth - EDGE_MARGIN - FAB_SIZE),
	top: getMinBallTop() + BELOW_TOPBAR_GAP
})

const defaultPos = createDefaultPos()
const posLeft = ref(defaultPos.left)
const posTop = ref(defaultPos.top)
const agentNameMap = ref(new Map<string, string>())
const clickOutsideEnabled = ref(false)

const activeCount = computed(() => chatActivityStore.activeEntries.value.length)

const sortedEntries = computed(() =>
	[...chatActivityStore.activeEntries.value].sort((a, b) => b.updatedAt - a.updatedAt)
)

const isAuthRoute = computed(() => AUTH_ROUTE_PATHS.has(route.path))

const isVisible = computed(
	() => !isAuthRoute.value && hasRoleAccess(ROLE_USER)
)

const fabLabel = computed(() =>
	activeCount.value > 0
		? t('ai.activity.fab.label')
		: t('ai.activity.fab.label.idle')
)

const routeAgentId = computed(() => {
	const q = route.query['agent-id']
	if (typeof q === 'string' && q.trim()) {
		return q.trim()
	}
	return 'chat_assistant'
})

const getPanelDimensions = () => ({
	width: Math.min(PANEL_MAX_WIDTH, window.innerWidth - PANEL_VIEWPORT_PAD),
	height: Math.min(PANEL_MAX_HEIGHT, window.innerHeight * 0.5)
})

const resolvePopupQuadrant = (ballLeft = posLeft.value, ballTop = posTop.value): PopupQuadrant => {
	const ballCenterX = ballLeft + FAB_SIZE / 2
	const ballCenterY = ballTop + FAB_SIZE / 2
	const isRight = ballCenterX >= window.innerWidth / 2
	const isTop = ballCenterY < window.innerHeight / 2
	if (isTop) {
		return isRight ? 'tr' : 'tl'
	}
	return isRight ? 'br' : 'bl'
}

/** 展开及收起动画期间锁定，避免拖过屏幕中线时壳层偏移突变导致晃动 */
const layoutQuadrant = ref<PopupQuadrant>(resolvePopupQuadrant())

const isQuadrantLocked = computed(() => panelOpen.value || shellAnimating.value)

const popupQuadrant = computed(() =>
	isQuadrantLocked.value ? layoutQuadrant.value : resolvePopupQuadrant()
)

const getClampedBallPos = () => {
	const minTop = getMinBallTop()
	const vw = window.innerWidth
	const vh = window.innerHeight
	return {
		left: Math.min(Math.max(0, posLeft.value), vw - FAB_SIZE),
		top: Math.min(Math.max(minTop, posTop.value), vh - FAB_SIZE)
	}
}

/** 根节点始终锚定球的左上角，坐标单一来源，避免 right/bottom 与存储值错位 */
const rootStyle = computed(() => {
	const ball = getClampedBallPos()
	return {
		left: `${ball.left}px`,
		top: `${ball.top}px`
	}
})

/** 壳层尺寸与象限偏移；宽高用明确像素值以保证收起动画可过渡 */
const shellStyle = computed(() => {
	const { width: panelW, height: panelH } = getPanelDimensions()
	const size = panelOpen.value
		? { width: `${panelW}px`, height: `${panelH}px` }
		: { width: `${FAB_SIZE}px`, height: `${FAB_SIZE}px` }

	if (!panelOpen.value) {
		return { left: '0px', top: '0px', ...size }
	}

	const quadrant = popupQuadrant.value
	const minTop = getMinBallTop()
	const vw = window.innerWidth
	const vh = window.innerHeight
	const ball = getClampedBallPos()

	let offsetLeft = 0
	let offsetTop = 0

	switch (quadrant) {
		case 'tr':
			offsetLeft = -(panelW - FAB_SIZE)
			break
		case 'bl':
			offsetTop = -(panelH - FAB_SIZE)
			break
		case 'br':
			offsetLeft = -(panelW - FAB_SIZE)
			offsetTop = -(panelH - FAB_SIZE)
			break
	}

	const shellLeft = ball.left + offsetLeft
	const shellTop = ball.top + offsetTop
	const shellRight = shellLeft + panelW
	const shellBottom = shellTop + panelH

	if (shellLeft < 0) {
		offsetLeft -= shellLeft
	}
	if (shellTop < minTop) {
		offsetTop += minTop - shellTop
	}
	if (shellRight > vw) {
		offsetLeft -= shellRight - vw
	}
	if (shellBottom > vh) {
		offsetTop -= shellBottom - vh
	}

	return {
		left: `${offsetLeft}px`,
		top: `${offsetTop}px`,
		...size
	}
})

const displayFor = (entry: ChatActivityEntry) =>
	resolveActiveEntryDisplay(entry, agentNameMap.value)

function loadPosFromSession() {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY)
		if (!raw) {
			return
		}
		const parsed = JSON.parse(raw) as {
			left?: number
			top?: number
			bottom?: number
		}
		if (typeof parsed.left !== 'number') {
			return
		}
		posLeft.value = parsed.left
		if (typeof parsed.top === 'number') {
			posTop.value = parsed.top
		} else if (typeof parsed.bottom === 'number') {
			posTop.value = window.innerHeight - parsed.bottom - FAB_SIZE
		}
		clampPosition()
	} catch {
		/* ignore malformed storage */
	}
}

function savePosToSession() {
	try {
		sessionStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ left: posLeft.value, top: posTop.value })
		)
	} catch {
		/* quota / private mode */
	}
}

function clampPosition() {
	const minTop = getMinBallTop()
	const vw = window.innerWidth
	const vh = window.innerHeight

	posLeft.value = Math.min(Math.max(0, posLeft.value), vw - FAB_SIZE)
	posTop.value = Math.min(Math.max(minTop, posTop.value), vh - FAB_SIZE)
}

function extractAgentsPayload(res: {
	data?: { agents?: AgentInfoDto[]; data?: { agents?: AgentInfoDto[] } }
}) {
	const body = res?.data as
		| { agents?: AgentInfoDto[]; data?: { agents?: AgentInfoDto[] } }
		| undefined
	return body?.agents ?? body?.data?.agents ?? []
}

async function loadAgentNames() {
	try {
		const res = await getAgentList()
		const agents = extractAgentsPayload(res)
		const map = new Map<string, string>()
		for (const agent of agents) {
			map.set(agent.agentId, agent.name?.trim() || agent.agentId)
		}
		agentNameMap.value = map
	} catch {
		agentNameMap.value = new Map()
	}
}

const onShellTransitionEnd = (event: TransitionEvent) => {
	if (event.target !== shellRef.value) {
		return
	}
	const animatedProps = new Set(['width', 'height', 'left', 'top'])
	if (!animatedProps.has(event.propertyName)) {
		return
	}
	shellAnimating.value = false
}

function teardownPanelListeners() {
	clickOutsideEnabled.value = false
	document.removeEventListener('click', handleClickOutside)
	document.removeEventListener('keydown', handleEscape)
}

function closePanel() {
	panelOpen.value = false
	shellAnimating.value = true
	teardownPanelListeners()
}

function openPanel() {
	layoutQuadrant.value = resolvePopupQuadrant()
	shellAnimating.value = true
	panelOpen.value = true
	clampPosition()
	setTimeout(() => {
		clickOutsideEnabled.value = true
		document.addEventListener('click', handleClickOutside)
		document.addEventListener('keydown', handleEscape)
	}, 0)
}

function togglePanel() {
	if (panelOpen.value) {
		closePanel()
	} else {
		openPanel()
	}
}

function handleEntryClick(entry: ChatActivityEntry) {
	openChatSession(entry.agentId, entry.contextId, {
		currentRoutePath: route.path,
		currentRouteAgentId: routeAgentId.value
	})
}

function goToAgents() {
	closePanel()
	goTo('/agents')
}

const handleClickOutside = (event: MouseEvent) => {
	if (!clickOutsideEnabled.value || !rootRef.value) {
		return
	}
	if (!rootRef.value.contains(event.target as Node)) {
		closePanel()
	}
}

const handleEscape = (event: KeyboardEvent) => {
	if (event.key === 'Escape') {
		closePanel()
	}
}

type DragSource = 'fab' | 'header'

type DragState = {
	pointerId: number
	startClientX: number
	startClientY: number
	startLeft: number
	startTop: number
	moved: boolean
	source: DragSource
	captureEl: HTMLElement | null
}

let dragState: DragState | null = null

const DRAG_LISTENER_OPTIONS: AddEventListenerOptions = { passive: false }

const lockPageInteraction = () => {
	document.body.style.overflow = 'hidden'
	document.body.style.touchAction = 'none'
}

const unlockPageInteraction = () => {
	document.body.style.overflow = ''
	document.body.style.touchAction = ''
}

const detachDragListeners = () => {
	document.removeEventListener('pointermove', onPointerMove, DRAG_LISTENER_OPTIONS)
	document.removeEventListener('pointerup', onPointerUp)
	document.removeEventListener('pointercancel', onPointerCancel)
}

function onDragMove(clientX: number, clientY: number) {
	if (!dragState) {
		return
	}
	const dx = clientX - dragState.startClientX
	const dy = clientY - dragState.startClientY
	if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
		dragState.moved = true
	}
	posLeft.value = dragState.startLeft + dx
	posTop.value = dragState.startTop + dy
	clampPosition()
}

function endDrag(pointerId: number) {
	if (!dragState || dragState.pointerId !== pointerId) {
		return
	}
	const wasClick = !dragState.moved
	const { source, captureEl } = dragState
	dragState = null
	isDragging.value = false
	unlockPageInteraction()
	detachDragListeners()
	captureEl?.releasePointerCapture?.(pointerId)
	savePosToSession()
	if (wasClick) {
		if (source === 'fab') {
			togglePanel()
		} else {
			closePanel()
		}
	}
}

function onPointerMove(event: PointerEvent) {
	if (!dragState || event.pointerId !== dragState.pointerId) {
		return
	}
	event.preventDefault()
	onDragMove(event.clientX, event.clientY)
}

function onPointerUp(event: PointerEvent) {
	endDrag(event.pointerId)
}

function onPointerCancel(event: PointerEvent) {
	endDrag(event.pointerId)
}

function startDrag(
	event: PointerEvent,
	source: DragSource,
	captureEl: HTMLElement | null
) {
	event.preventDefault()
	event.stopPropagation()
	isDragging.value = true
	lockPageInteraction()
	captureEl?.setPointerCapture?.(event.pointerId)
	dragState = {
		pointerId: event.pointerId,
		startClientX: event.clientX,
		startClientY: event.clientY,
		startLeft: posLeft.value,
		startTop: posTop.value,
		moved: false,
		source,
		captureEl
	}
	document.addEventListener('pointermove', onPointerMove, DRAG_LISTENER_OPTIONS)
	document.addEventListener('pointerup', onPointerUp)
	document.addEventListener('pointercancel', onPointerCancel)
}

function onFabPointerDown(event: PointerEvent) {
	if (event.button !== 0 || panelOpen.value) {
		return
	}
	startDrag(event, 'fab', fabRef.value)
}

function onHeaderPointerDown(event: PointerEvent) {
	if (event.button !== 0 || !panelOpen.value) {
		return
	}
	startDrag(event, 'header', event.currentTarget as HTMLElement | null)
}

function onWindowResize() {
	clampPosition()
	savePosToSession()
}

watch(isQuadrantLocked, (locked) => {
	if (!locked) {
		layoutQuadrant.value = resolvePopupQuadrant()
	}
})

watch(isVisible, (visible) => {
	if (!visible) {
		panelOpen.value = false
		shellAnimating.value = false
		clickOutsideEnabled.value = false
		document.removeEventListener('click', handleClickOutside)
		document.removeEventListener('keydown', handleEscape)
	}
})

onMounted(() => {
	loadPosFromSession()
	clampPosition()
	loadAgentNames()
	window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
	isDragging.value = false
	unlockPageInteraction()
	detachDragListeners()
	closePanel()
	window.removeEventListener('resize', onWindowResize)
})
</script>

<style scoped lang="scss">
@use '@/styles/platform' as *;
@use '../chatThinkGlow.scss' as thinkGlow;

$shell-ease: cubic-bezier(0.34, 1.15, 0.64, 1);
$shell-duration: 0.36s;

.activity-drag-shield {
	position: fixed;
	inset: 0;
	z-index: 1000;
	pointer-events: auto;
	touch-action: none;
	background: transparent;
}

.chat-activity-panel {
	position: fixed;
	z-index: 1001;
	width: 0;
	height: 0;
	pointer-events: none;

	> * {
		pointer-events: auto;
	}
}

.activity-shell {
	--think-glow-blur: 14px;
	--think-glow-spread: 5px;
	--think-glow-duration: 1.6s;

	position: absolute;
	left: 0;
	top: 0;
	width: 52px;
	height: 52px;
	border-radius: 50%;
	overflow: hidden;
	pointer-events: auto;
	transform-origin: top left;

	&.quadrant-bl {
		transform-origin: bottom left;
	}

	&.quadrant-br {
		transform-origin: bottom right;
	}

	&.quadrant-tr {
		transform-origin: top right;
	}

	&:not(.is-open) {
		overflow: visible;
	}

	@include n-glass-surface(2);

	&.is-active {
		@include thinkGlow.think-glow-ring;
	}
	box-shadow: var(--n-shadow-elevation-2);
	transition:
		left $shell-duration $shell-ease,
		top $shell-duration $shell-ease,
		width $shell-duration $shell-ease,
		height $shell-duration $shell-ease,
		border-radius $shell-duration $shell-ease,
		box-shadow $shell-duration ease;

	&.is-open {
		border-radius: 16px;
		box-shadow: var(--n-shadow-elevation-2);
	}
}

.is-shell-animating {
	.activity-shell::before,
	.activity-shell::after,
	.activity-fab-breathe,
	.activity-fab-core {
		animation-play-state: paused !important;
	}
}

.activity-fab-trigger {
	position: absolute;
	inset: 0;
	z-index: 2;
	width: 100%;
	height: 100%;
	border: none;
	border-radius: inherit;
	background: transparent;
	cursor: grab;
	touch-action: none;
	user-select: none;
	-webkit-user-select: none;
	-webkit-touch-callout: none;
	display: flex;
	align-items: center;
	justify-content: center;
	transition:
		opacity 0.2s ease $shell-duration,
		transform $shell-duration $shell-ease;

	.activity-shell.is-open & {
		opacity: 0;
		transform: scale(0.55);
		pointer-events: none;
		transition:
			opacity 0.16s ease,
			transform $shell-duration $shell-ease;
	}

	&:active {
		cursor: grabbing;
	}
}

@supports (-webkit-touch-callout: none) {
	.activity-shell {
		transition-duration: 0.3s;
	}
}

.activity-fab-inner {
	position: relative;
	width: 38px;
	height: 38px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.activity-fab-breathe {
	position: absolute;
	inset: 0;
	border-radius: 50%;
	opacity: 0;
	pointer-events: none;

	.activity-shell.is-active & {
		opacity: 1;
		background: radial-gradient(
			circle at 50% 50%,
			rgba(255, 180, 120, 0.62) 0%,
			rgba(140, 190, 255, 0.48) 42%,
			rgba(255, 160, 100, 0.14) 62%,
			transparent 78%
		);
		filter: blur(4px);
		animation: fab-breathe-mist 2.2s ease-in-out infinite;
	}
}

$fab-core-gradient: conic-gradient(
	from 0deg,
	rgba(255, 147, 68, 1),
	rgba(200, 220, 255, 1),
	rgba(90, 160, 255, 0.98),
	rgba(255, 175, 110, 0.98),
	rgba(255, 147, 68, 1)
);

.activity-fab-core {
	position: relative;
	width: 30px;
	height: 30px;
	border-radius: 50%;
	background: transparent;
	box-shadow: none;

	&::before,
	&::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		border-radius: 50%;
		background: $fab-core-gradient;
	}

	/* 外缘：同色系轻微虚化，无独立渐变色 */
	&::before {
		width: 28px;
		height: 28px;
		margin: -14px 0 0 -14px;
		filter: blur(3.5px);
		opacity: 0.88;
	}

	/* 内核：浓实色心 */
	&::after {
		width: 22px;
		height: 22px;
		margin: -11px 0 0 -11px;
		filter: blur(0.6px);
		opacity: 1;
	}

	.activity-shell.is-active & {
		&::before,
		&::after {
			animation:
				fab-core-spin 2s linear infinite,
				fab-breathe-core 2.2s ease-in-out infinite;
		}
	}
}

.activity-fab-trigger .activity-fab-badge {
	position: absolute;
	top: 2px;
	right: 2px;
	z-index: 3;
	pointer-events: none;
	transform: translate(40%, -40%);
	min-width: 18px;
	height: 18px;
	padding: 0 5px;
	border-radius: 9px;
	background: var(--el-color-primary);
	color: #fff;
	font-size: 11px;
	font-weight: 600;
	line-height: 18px;
	text-align: center;
	box-sizing: border-box;
	box-shadow: 0 2px 8px rgba(64, 158, 255, 0.35);
}

.activity-panel-body {
	position: absolute;
	inset: 0;
	z-index: 1;
	display: flex;
	flex-direction: column;
	min-height: 0;
	opacity: 0;
	visibility: hidden;
	transform: scale(0.72);
	pointer-events: none;
	transition: none;

	.activity-shell.is-open & {
		opacity: 1;
		visibility: visible;
		transform: scale(1);
		pointer-events: auto;
		transition:
			opacity 0.28s ease 0.08s,
			visibility 0s ease 0.08s,
			transform $shell-duration $shell-ease 0.06s;
	}
}

.activity-panel-header {
	padding: 12px 16px 8px;
	flex-shrink: 0;
	cursor: grab;
	touch-action: none;
	user-select: none;
	-webkit-user-select: none;
	-webkit-touch-callout: none;

	&:active {
		cursor: grabbing;
	}
}

.activity-panel-title {
	font-size: 14px;
	font-weight: 600;
	color: var(--n-color-text-primary);
	line-height: 1.3;
}

.activity-panel-count {
	margin-left: 4px;
	font-size: 13px;
	font-weight: 500;
	color: var(--n-color-text-placeholder);
}

.activity-panel-empty {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8px;
	padding: 16px;
	text-align: center;
	box-sizing: border-box;
}

.activity-panel-empty-text {
	margin: 0;
	font-size: 13px;
	color: var(--n-color-text-primary);
	line-height: 1.5;
}

.activity-panel-empty-hint {
	margin: 0;
	font-size: 12px;
	color: var(--n-color-text-placeholder);
	line-height: 1.5;
}

.activity-panel-empty-cta {
	padding: 8px 16px;
	border-radius: 999px;
	font-size: 13px;
	font-weight: 500;
	line-height: 1.4;
}

.activity-panel-list {
	list-style: none;
	margin: 0;
	padding: 0 12px 12px;
	overflow-y: auto;
	flex: 1;
	min-height: 0;
}

.activity-panel-item {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 10px 12px;
	margin-bottom: 8px;
	border-radius: 12px;
	cursor: pointer;
	@include n-glass-surface(1);
	box-shadow: 0 0 12px rgba(0, 0, 0, 0.08);
	transition: color 0.2s ease;

	&:last-child {
		margin-bottom: 0;
	}

	&:hover {
		color: var(--el-color-primary);
	}
}

.activity-panel-item-body {
	flex: 1;
	min-width: 0;
}

.activity-panel-item-title {
	margin: 0;
	font-size: 13px;
	line-height: 1.4;
	color: var(--n-color-text-primary);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.activity-panel-item-meta {
	margin: 4px 0 0;
	font-size: 11px;
	line-height: 1.3;
	color: var(--n-color-text-placeholder);
	display: flex;
	gap: 8px;
	min-width: 0;
}

.activity-panel-item-agent {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	flex-shrink: 1;
	min-width: 0;
}

.activity-panel-item-state {
	flex-shrink: 0;
}

.streaming-orb {
	position: relative;
	flex-shrink: 0;
	width: 14px;
	height: 14px;
	display: inline-block;

	&::before {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: 20px;
		height: 20px;
		margin: -10px 0 0 -10px;
		border-radius: 50%;
		background: radial-gradient(
			circle at 50% 50%,
			rgba(255, 180, 120, 0.5) 0%,
			rgba(140, 190, 255, 0.38) 38%,
			rgba(255, 160, 100, 0.12) 58%,
			transparent 72%
		);
		filter: blur(5px);
		animation: streaming-orb-mist 2.4s ease-in-out infinite;
	}

	&::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: 8px;
		height: 8px;
		margin: -4px 0 0 -4px;
		border-radius: 50%;
		background: conic-gradient(
			from 0deg,
			rgba(255, 147, 68, 0.82),
			rgba(200, 220, 255, 0.92),
			rgba(90, 160, 255, 0.88),
			rgba(255, 175, 110, 0.8),
			rgba(255, 147, 68, 0.82)
		);
		filter: blur(0.8px);
		box-shadow:
			0 0 5px rgba(255, 147, 68, 0.42),
			0 0 9px rgba(64, 158, 255, 0.28);
		animation: streaming-orb-spin 2s linear infinite;
	}
}

@keyframes fab-breathe-mist {
	0%,
	100% {
		opacity: 0.72;
		transform: scale(0.9);
	}
	50% {
		opacity: 1;
		transform: scale(1.14);
	}
}

@keyframes fab-core-spin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

@keyframes fab-breathe-core {
	0%,
	100% {
		opacity: 0.92;
	}
	50% {
		opacity: 1;
	}
}

@keyframes streaming-orb-spin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

@keyframes streaming-orb-mist {
	0%,
	100% {
		opacity: 0.55;
		transform: scale(0.92);
	}
	50% {
		opacity: 1;
		transform: scale(1.08);
	}
}
</style>
