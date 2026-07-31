<template>
	<div ref="rootRef" class="n-glass-time-range">
		<div
			class="n-glass-time-range__trigger"
			:class="{ 'is-active': panelVisible, 'is-filled': !!displayLabel }"
			@click="togglePanel"
		>
			<span class="n-glass-time-range__trigger-text">
				{{ displayLabel || t('common.timeRange.placeholder') }}
			</span>
			<button
				v-if="displayLabel"
				type="button"
				class="n-glass-time-range__clear"
				@click.stop="clearRange"
			>
				<el-icon :size="14"><CircleClose /></el-icon>
			</button>
			<el-icon v-else class="n-glass-time-range__clock" :size="14"><Clock /></el-icon>
		</div>

		<Teleport to="body">
			<div
				v-show="panelVisible"
				ref="panelRef"
				class="n-glass-time-range__panel"
				:style="panelStyle"
				@mousedown.stop
			>
				<div class="n-glass-time-range__tabs">
					<button
						type="button"
						class="n-glass-time-range__tab"
						:class="{ 'is-active': activeTab === 'quick' }"
						@click="activeTab = 'quick'"
					>
						{{ t('common.timeRange.tab.quick') }}
					</button>
					<button
						type="button"
						class="n-glass-time-range__tab"
						:class="{ 'is-active': activeTab === 'calendar' }"
						@click="openCalendarTab"
					>
						{{ t('common.timeRange.tab.calendar') }}
					</button>
				</div>

				<div class="n-glass-time-range__preview">
					{{ previewLabel || t('common.timeRange.placeholder') }}
				</div>

				<div v-if="activeTab === 'quick'" class="n-glass-time-range__quick-grid">
					<button
						v-for="opt in presetOptions"
						:key="opt.value"
						type="button"
						class="n-glass-time-range__quick-item"
						:class="{ 'is-active': activePreset === opt.value }"
						@click="onPresetClick(opt.value)"
					>
						{{ opt.label }}
					</button>
				</div>

				<div v-else class="n-glass-time-range__calendar">
					<div class="n-glass-time-range__calendar-row">
						<span class="n-glass-time-range__calendar-label">
							{{ t('common.timeRange.from') }}
						</span>
						<el-date-picker
							v-model="draftFrom"
							type="datetime"
							format="YYYY-MM-DD HH:mm:ss"
							value-format="YYYY-MM-DD HH:mm:ss"
							:editable="false"
							placement="bottom-start"
							popper-class="n-glass-time-range-datepicker"
							:placeholder="t('common.timeRange.from')"
							@change="onDraftChange"
							@visible-change="onPickerVisibleChange"
						/>
					</div>
					<div class="n-glass-time-range__calendar-row">
						<span class="n-glass-time-range__calendar-label">
							{{ t('common.timeRange.to') }}
						</span>
						<el-date-picker
							v-model="draftTo"
							type="datetime"
							format="YYYY-MM-DD HH:mm:ss"
							value-format="YYYY-MM-DD HH:mm:ss"
							:editable="false"
							placement="bottom-start"
							popper-class="n-glass-time-range-datepicker"
							:placeholder="t('common.timeRange.to')"
							@change="onDraftChange"
							@visible-change="onPickerVisibleChange"
						/>
					</div>
					<div class="n-glass-time-range__calendar-actions">
						<el-button size="small" @click="panelVisible = false">
							{{ t('common.cancel') }}
						</el-button>
						<el-button
							type="primary"
							size="small"
							:disabled="!canConfirmCalendar"
							@click="confirmCalendar"
						>
							{{ t('common.ok') }}
						</el-button>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElButton, ElDatePicker, ElIcon } from 'element-plus'
import { CircleClose, Clock } from '@element-plus/icons-vue'
import { t } from '@ai-system/lib'
import {
	buildGlassTimeRangePresetOptions,
	formatGlassDateTime,
	formatGlassTimeRangeLabel,
	resolveGlassTimeRangePreset,
	type GlassTimeRangePreset
} from './timeRangePresets'

/** v-model：[fromMs, toMs] 毫秒字符串 */
const dateRange = defineModel<[string, string] | null>({ default: null })

const emit = defineEmits<{
	change: []
}>()

const rootRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const panelVisible = ref(false)
const activeTab = ref<'quick' | 'calendar'>('quick')
const activePreset = ref<GlassTimeRangePreset | undefined>()
const presetOptions = buildGlassTimeRangePresetOptions()
const pickerOpenCount = ref(0)
const draftFrom = ref<string | null>(null)
const draftTo = ref<string | null>(null)
const panelStyle = ref<Record<string, string>>({})

const displayLabel = computed(() => formatGlassTimeRangeLabel(dateRange.value))

const previewLabel = computed(() => {
	if (activeTab.value === 'calendar' && draftFrom.value && draftTo.value) {
		return `${draftFrom.value} ~ ${draftTo.value}`
	}
	return displayLabel.value
})

const canConfirmCalendar = computed(() => {
	if (!draftFrom.value || !draftTo.value) {
		return false
	}
	return (
		new Date(draftFrom.value.replace(' ', 'T')).getTime() <=
		new Date(draftTo.value.replace(' ', 'T')).getTime()
	)
})

/** 按触发器位置定位 Teleport 面板（右对齐向下展开） */
function updatePanelPosition() {
	const el = rootRef.value
	if (!el) {
		return
	}
	const rect = el.getBoundingClientRect()
	const width = 400
	let left = rect.right - width
	left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
	panelStyle.value = {
		position: 'fixed',
		top: `${Math.round(rect.bottom + 6)}px`,
		left: `${Math.round(left)}px`,
		width: `${width}px`,
		zIndex: '3000'
	}
}

async function togglePanel() {
	panelVisible.value = !panelVisible.value
	if (panelVisible.value) {
		await nextTick()
		updatePanelPosition()
	}
}

function openCalendarTab() {
	activeTab.value = 'calendar'
	ensureDrafts()
}

function ensureDrafts() {
	if ((draftFrom.value || draftTo.value) && activePreset.value === 'custom') {
		return
	}
	if (!draftFrom.value && !draftTo.value && dateRange.value) {
		syncDraftFromModel()
	}
}

function onPresetClick(value: Exclude<GlassTimeRangePreset, 'custom'>) {
	activePreset.value = value
	const range = resolveGlassTimeRangePreset(value)
	dateRange.value = range
	draftFrom.value = formatGlassDateTime(range[0])
	draftTo.value = formatGlassDateTime(range[1])
	panelVisible.value = false
	emit('change')
}

function onDraftChange() {
	activePreset.value = 'custom'
}

function onPickerVisibleChange(visible: boolean) {
	pickerOpenCount.value += visible ? 1 : -1
	if (pickerOpenCount.value < 0) {
		pickerOpenCount.value = 0
	}
}

function datetimeStrToMs(value: string) {
	return String(new Date(value.replace(' ', 'T')).getTime())
}

function confirmCalendar() {
	if (!canConfirmCalendar.value || !draftFrom.value || !draftTo.value) {
		return
	}
	activePreset.value = 'custom'
	dateRange.value = [datetimeStrToMs(draftFrom.value), datetimeStrToMs(draftTo.value)]
	panelVisible.value = false
	emit('change')
}

function clearRange() {
	dateRange.value = null
	activePreset.value = undefined
	draftFrom.value = null
	draftTo.value = null
	emit('change')
}

function syncDraftFromModel() {
	draftFrom.value = dateRange.value?.[0] ? formatGlassDateTime(dateRange.value[0]) : null
	draftTo.value = dateRange.value?.[1] ? formatGlassDateTime(dateRange.value[1]) : null
}

function isInDatePickerPopper(target: HTMLElement) {
	return Boolean(
		target.closest('.n-glass-time-range-datepicker') ||
			target.closest('.el-picker__popper') ||
			target.closest('.el-picker-panel')
	)
}

function onDocPointerDown(event: PointerEvent) {
	if (!panelVisible.value) {
		return
	}
	if (pickerOpenCount.value > 0) {
		return
	}
	const target = event.target as HTMLElement | null
	if (!target) {
		return
	}
	if (
		rootRef.value?.contains(target) ||
		panelRef.value?.contains(target) ||
		isInDatePickerPopper(target)
	) {
		return
	}
	panelVisible.value = false
}

watch(panelVisible, (open) => {
	if (!open) {
		pickerOpenCount.value = 0
		return
	}
	nextTick(() => updatePanelPosition())
})

onMounted(() => {
	document.addEventListener('pointerdown', onDocPointerDown, true)
	window.addEventListener('resize', updatePanelPosition)
	window.addEventListener('scroll', updatePanelPosition, true)
})

onBeforeUnmount(() => {
	document.removeEventListener('pointerdown', onDocPointerDown, true)
	window.removeEventListener('resize', updatePanelPosition)
	window.removeEventListener('scroll', updatePanelPosition, true)
})
</script>

<style scoped lang="scss">
@use '@/styles/platform' as *;

.n-glass-time-range {
	position: relative;
	display: inline-block;
	vertical-align: middle;
}

.n-glass-time-range__trigger {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	min-width: 280px;
	max-width: 420px;
	height: 32px;
	padding: 0 10px 0 12px;
	box-sizing: border-box;
	cursor: pointer;
	@include n-glass-filter-control;
}

.n-glass-time-range__trigger-text {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 13px;
	color: var(--n-color-text-muted);

	.is-filled & {
		color: var(--n-color-text-primary);
	}
}

.n-glass-time-range__clock {
	color: var(--n-color-text-muted);
	flex-shrink: 0;
}

.n-glass-time-range__clear {
	border: none;
	background: transparent;
	color: var(--n-color-text-muted);
	cursor: pointer;
	padding: 0;
	display: inline-flex;
	align-items: center;

	&:hover {
		color: var(--n-color-text-primary);
	}
}
</style>

<style lang="scss">
@use '@/styles/platform' as *;

/* 下拉面板：统一毛玻璃浮层 */
.n-glass-time-range__panel {
	padding: 14px 16px 16px;
	box-sizing: border-box;
	border-radius: 12px;
	@include n-glass-surface(3);
	border: 1px solid var(--n-color-border-soft);
}

.n-glass-time-range__tabs {
	display: flex;
	gap: 20px;
	border-bottom: 1px solid var(--n-color-border-soft);
}

.n-glass-time-range__tab {
	position: relative;
	border: none;
	background: transparent;
	padding: 0 0 10px;
	font-size: 14px;
	color: var(--n-color-text-primary);
	cursor: pointer;

	&.is-active {
		color: var(--el-color-primary);
		font-weight: 600;

		&::after {
			content: '';
			position: absolute;
			left: 0;
			right: 0;
			bottom: -1px;
			height: 2px;
			background: var(--el-color-primary);
			border-radius: 1px;
		}
	}
}

.n-glass-time-range__preview {
	margin-top: 12px;
	padding: 8px 12px;
	border-radius: 8px;
	@include n-glass-surface(1);
	border: 1px solid var(--n-color-border-soft);
	color: var(--n-color-text-muted);
	font-size: 13px;
	line-height: 1.4;
	word-break: break-all;
}

.n-glass-time-range__quick-grid {
	margin-top: 12px;
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 10px 8px;
}

.n-glass-time-range__quick-item {
	border: none;
	background: transparent;
	padding: 6px 0;
	font-size: 13px;
	color: var(--n-color-text-primary);
	cursor: pointer;
	border-radius: 6px;

	&:hover {
		color: var(--el-color-primary);
		background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
	}

	&.is-active {
		color: var(--el-color-primary);
		font-weight: 600;
	}
}

.n-glass-time-range__calendar {
	margin-top: 12px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.n-glass-time-range__calendar-row {
	display: flex;
	align-items: center;
	gap: 8px;
}

.n-glass-time-range__calendar-label {
	flex: 0 0 64px;
	font-size: 13px;
	color: var(--n-color-text-muted);
}

.n-glass-time-range__calendar-row .el-date-editor {
	flex: 1;
	width: auto !important;
}

.n-glass-time-range__calendar-actions {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
	padding-top: 4px;
}

/* 日历弹层同步毛玻璃；须高于主面板（3000），否则会压在后面 */
.n-glass-time-range-datepicker.el-picker__popper {
	z-index: 4000 !important;
	@include n-glass-surface(3);
	border: 1px solid var(--n-color-border-soft) !important;
	border-radius: 12px !important;
	overflow: hidden;

	.el-picker-panel,
	.el-date-picker,
	.el-date-picker__header,
	.el-picker-panel__body,
	.el-picker-panel__footer {
		background: transparent !important;
	}

	.el-picker-panel__footer {
		border-top: 1px solid var(--n-color-border-soft);
	}
}
</style>
