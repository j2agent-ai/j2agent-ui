<template>
	<div v-loading="isLoading" class="slider-container">
		<div
			class="slider-canvas"
			:style="{
				width: `${slideInfo.width}px`,
				height: `${slideInfo.height}px`
			}"
			@click="updateSlideCaptcha"
		>
			<!-- 大图 -->
			<div
				ref="puzzle"
				class="puzzle-image"
				:style="{
					backgroundImage: `url(${slideInfo.puzzleUrl})`,
					width: '100%',
					height: '100%',
					position: 'absolute',
					top: 0,
					left: 0,
					backgroundSize: 'cover'
				}"
			/>
			<!-- 滑块 -->
			<div
				ref="block"
				class="slider-block"
				:style="{
					backgroundImage: `url(${slideInfo.sliderUrl})`,
					width: slideInfo.sliderSize + 'px',
					height: slideInfo.sliderSize + 'px',
					top: slideInfo.blockY + 'px',
					left: '0px',
					position: 'absolute',
					backgroundSize: 'cover'
				}"
			/>
			<!-- 结果遮罩层 -->
			<div
				:class="`result-mask ${resultMask.class}`"
				:style="{ height: `${resultMask.height}px` }"
			/>
		</div>
		<!-- 拖动的滑块内容 -->
		<div class="slider-square">
			<div class="box">
				<div
					class="slider-square-icon"
					:style="{ transform: `translateX(${slideInfo.sliderLeft}px)` }"
					@mousedown="sliderDown"
					@touchstart="sliderDown"
				></div>
				<span>{{ slideInfo.sliderText }}</span>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { onDeactivated, onMounted, reactive, ref, watch } from 'vue'
import axios from 'axios'
import { globalUrlPrefix, programTag } from '@/oem'
import { ElMessage } from 'element-plus'
import { t } from '@ai-system/lib'

const isLoading = ref(false)
const props = withDefaults(
	defineProps<{
		loading: boolean
	}>(),
	{
		loading: false
	}
)

watch(
	() => props.loading,
	(newVal) => {
		isLoading.value = newVal
	}
)

// 定义 emits
const emit = defineEmits<{
	(
		e: 'validPass',
		value: {
			hash: string
			code: string
		}
	): void
}>()

defineExpose({
	updateSlideCaptcha
})

const puzzle = ref<HTMLDivElement | null>(null)
const block = ref<HTMLDivElement | null>(null)

// 通过此值可以限制展示的宽度
const showWidth = 300

const slideInfo = ref({
	hash: '',
	puzzleUrl: '',
	width: showWidth,
	height: (showWidth * 3) / 4,
	sliderUrl: '',
	sliderSize: 0,
	sliderY: 0,
	sliderLeft: 0,
	blockX: 0,
	blockY: 0,
	scaleRatio: 1,
	sliderText: ''
})

const origin = reactive({
	originX: 0
})

const resultMask = reactive({
	class: '',
	height: 0
})

onMounted(() => {
	bindEvents()
	updateSlideCaptcha()
})

function verifySlideCaptcha(
	sliderX: number,
	hash: string,
	track: Array<{
		pointerX: number
		pointerY: number
		t: number
	}>
) {
	return axios.post<{
		result: boolean
		code: string
	}>(`/v1${globalUrlPrefix}auth/${programTag}/captcha/slide/validate`, {
		sliderX,
		hash,
		track
	})
}

const slider = ref(false)

const track = ref<Array<{ pointerX: number; pointerY: number; t: number }>>([])

const sliderDown = (e: MouseEvent | TouchEvent) => {
	slider.value = true
	slideInfo.value.sliderText = ''
	const pageX = 'touches' in e ? e.touches[0].pageX : (e as MouseEvent).pageX
	origin.originX = pageX
	block.value && (block.value.style.willChange = 'transform')
	track.value = []
	const pageY = 'touches' in e ? e.touches[0].pageY : (e as MouseEvent).pageY
	track.value.push({ pointerX: pageX, pointerY: pageY, t: Date.now() })
	e.preventDefault()
}

const sliderMove = (e: MouseEvent | TouchEvent) => {
	if (!slider.value) return
	const pageX = 'touches' in e ? e.touches[0].pageX : (e as MouseEvent).pageX
	const pageY = 'touches' in e ? e.touches[0].pageY : (e as MouseEvent).pageY
	const moveX = pageX - origin.originX
	const maxMoveX = slideInfo.value.width - slideInfo.value.sliderSize
	const clampedX = Math.max(0, Math.min(moveX, maxMoveX))
	block.value &&
	(block.value.style.transform = `translate3d(${clampedX}px,0,0)`)
	slideInfo.value.sliderLeft = clampedX
	// 记录真实光标位置
	track.value.push({ pointerX: pageX, pointerY: pageY, t: Date.now() })
	e.preventDefault()
}

const sliderUp = () => {
	if (!slider.value) return
	slider.value = false
	block.value && (block.value.style.willChange = 'auto')
	const resultX = slideInfo.value.sliderLeft / slideInfo.value.scaleRatio
	verifySlideCaptcha(resultX, slideInfo.value.hash, track.value).then((res) => {
		if (res.data.result) {
			emit('validPass', { hash: slideInfo.value.hash, code: res.data.code })
			updateSlideCaptcha()
		} else {
			ElMessage.error(t('captcha.validate.fail'))
			updateSlideCaptcha()
		}
	})
}

// updateSlideCaptcha 中使用可选链防止 null 访问
function updateSlideCaptcha() {
	isLoading.value = true
	if (block.value) block.value.style.transform = 'translate3d(0,0,0)'
	slideInfo.value.sliderLeft = 0
	updateSlideInfo()
		.then(() => {
			slideInfo.value.sliderText = '拖动滑块完成验证'
			resultMask.height = 0
			resultMask.class = ''
			slideInfo.value.sliderLeft = 0
			if (block.value) block.value.style.left = '0'
			if (puzzle.value) {
				slideInfo.value.scaleRatio = showWidth / slideInfo.value.width
				slideInfo.value.width *= slideInfo.value.scaleRatio
				slideInfo.value.height *= slideInfo.value.scaleRatio
				slideInfo.value.blockY *= slideInfo.value.scaleRatio
				slideInfo.value.sliderSize *= slideInfo.value.scaleRatio
			}
		})
		.finally(() => {
			isLoading.value = false
		})
}

function updateSlideInfo() {
	return axios
		.get<{
			hash: string
			puzzleUrl: string
			width: number
			height: number
			sliderUrl: string
			sliderSize: number
			sliderY: number
		}>(
			`/v1${globalUrlPrefix}auth/${programTag}/captcha/slide?` +
			new Date().getTime()
		)
		.then((res) => {
			slideInfo.value.hash = res.data.hash
			slideInfo.value.puzzleUrl = res.data.puzzleUrl
			slideInfo.value.width = res.data.width
			slideInfo.value.height = res.data.height
			slideInfo.value.sliderUrl = res.data.sliderUrl
			slideInfo.value.sliderSize = res.data.sliderSize
			slideInfo.value.blockY = res.data.sliderY
		})
}

const bindEvents = () => {
	document.addEventListener('mousemove', sliderMove)
	document.addEventListener('mouseup', sliderUp)
	document.addEventListener('touchmove', sliderMove, { passive: false })
	document.addEventListener('touchend', sliderUp)
}

onDeactivated(() => {
	document.removeEventListener('mousemove', sliderMove)
	document.removeEventListener('mouseup', sliderUp)
	document.removeEventListener('touchmove', sliderMove)
	document.removeEventListener('touchend', sliderUp)
})
</script>

<style lang="scss">
.slider-container {
	position: relative;
	display: inline-block;
	flex-direction: column;
	justify-content: center;
	height: auto;
	margin: 0 auto;
	padding: 16px;
	border-radius: var(--n-radius-triple);
	background: var(--n-color-bg-glass-weak);
	box-shadow: var(--n-box-shadow-large);

	.slider-canvas {
		position: relative;
		background-color: transparent;
		margin-bottom: 16px;
		.puzzle-image {
			border-radius: 4px;
		}

		.slider-block {
			z-index: 2;
			border-radius: 4px;
			will-change: transform;
			backface-visibility: hidden;
			transform: translateZ(0);
		}
	}

	@keyframes result-show {
		0% {
			opacity: 0;
		}
		100% {
			opacity: 0.7;
		}
	}

	.result-mask {
		position: absolute;
		left: 0;
		bottom: 0;
		width: 100%;
		opacity: 0.7;

		&.success {
			background-color: #52ccba;
			animation: result-show 1s;
		}

		&.fail {
			background-color: #f57a7a;
			animation: result-show 1s;
		}
	}
}

.slider-square {
	background: var(--n-color-bg-glass-weak);
	height: 36px;
	text-align: center;
	line-height: 36px;
	border: 2px solid var(--n-color-border-soft);
	position: relative;
	border-radius: 4px;
	z-index: 10;

	.box {
		padding: 0 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		height: 100%;

		span {
			flex: 1;
			text-align: center;
			color: var(--n-color-text-muted);
			font-size: 14px;
		}
	}

	.slider-square-icon {
		position: absolute;
		top: 0;
		left: 0;
		height: 35px;
		width: 35px;
		background-color: color-mix(
				in srgb,
				var(--el-color-primary),
				transparent 10%
		);
		cursor: pointer;
		z-index: 11;
		user-select: none;
		will-change: transform;
		border: none;
		border-radius: var(--n-radius-double);
		&:hover,
		&:active {
			background-color: var(--el-color-primary);
			box-shadow: 0 0 10px var(--el-color-primary);
		}
	}
}
</style>
