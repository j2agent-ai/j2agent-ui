<template>
	<div
		class="ai-assistant-page"
		:class="{ 'full-page': isFullscreen, 'mobile-page': isMobile }"
	>
		<top-bar :title-suffix="agentTitleSuffix">
			<template #external-menu>
				<span
					v-show="isMobile"
					v-draggable="{ device: 'mobile' }"
					class="menu-button"
					:class="{ active: chatManageActive }"
					@click="handleChatManage"
				>
				⌥
			</span>
			</template>
		</top-bar>
		<!-- 添加聊天界面组件 -->
		<ChatView
			ref="chatViewRef"
			class="chat-view"
			:is-fullscreen="isFullscreen"
			:is-mobile="isMobile"
			:agent-id="agentIdFromRoute"
			:show-hot-questions="showHotQuestions"
		/>
	</div>
</template>
<script setup lang="ts">
import ChatView from './components/ChatView.vue'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { debounce } from '@ai-system/lib'
import topBar from '@/pages/components/topBar.vue'
import {
	agentNameMap,
	ensureAgentNamesLoaded,
	getAgentDisplayName,
	registeredAgents
} from './agentNameRegistry'
import { CHAT_NARROW_LAYOUT_MAX_WIDTH_PX, isChatNarrowLayout } from './layout'

const route = useRoute()

/** 从路由 query 读取 agent-id，缺省为后端默认智能体 chat_assistant */
const agentIdFromRoute = computed(() => {
	const q = route.query['agent-id']
	if (typeof q === 'string' && q.trim()) {
		return q.trim()
	}
	return 'chat_assistant'
})

/** 由 Agent 元数据 showHotQuestions 决定是否展示热门问题 */
const showHotQuestions = computed(() => {
	const hit = registeredAgents.value.find((a) => a.agentId === agentIdFromRoute.value)
	return hit?.showHotQuestions === true
})

/** 顶栏后缀：匹配到则用 name，否则用 agentId */
const agentTitleSuffix = computed(() => {
	agentNameMap.value
	return getAgentDisplayName(agentIdFromRoute.value)
})

const chatViewRef = ref<InstanceType<typeof ChatView> | null>(null)
const isFullscreen = ref(true)
const isMobile = ref(false)

const chatManageActive = computed(() => Boolean(chatViewRef.value?.showChatManage))

const handleChatManage = () => {
	const view = chatViewRef.value
	if (!view) {
		return
	}
	const next = !view.showChatManage
	view.showChatManage = next
	if (next) {
		nextTick(() => {
			view.chatManageRef?.getHistoryListData()
		})
	}
}

const resize = () => {
	const width =
		window.innerWidth ||
		document.documentElement.clientWidth ||
		document.body.clientWidth

	if (isChatNarrowLayout(width) || route.query?.isMobile) {
		console.log('移动端视图')
		isMobile.value = true
		isFullscreen.value = false
		document.body.style.minWidth = '0px'
	} /* else if (width < 992) {
			console.log('平板视图');
	} */ else {
		console.log('桌面视图')
		isMobile.value = false
		isFullscreen.value = true
		document.body.style.minWidth = `${CHAT_NARROW_LAYOUT_MAX_WIDTH_PX}px`
	}
}

// 处理 Safari 移动端高度问题
const handleMobileSafariHeight = () => {
	if (isMobile.value) {
		// 使用 window.innerHeight 代替 100vh 解决 Safari 地址栏高度问题
		const app = document.querySelector('.web-app')
		if (app) {
			app.style.height = window.innerHeight + 'px'
		}
	} else {
		// 恢复默认高度设置
		const app = document.querySelector('.web-app')
		if (app) {
			app.style.height = ''
		}
	}
}

onMounted(() => {
	void ensureAgentNamesLoaded()
	resize()
	handleMobileSafariHeight()
	if (!isMobile.value) {
		nextTick(() => {
			chatViewRef.value.getHistoryListData()
		})
	} else {
		// 移动端初始化时设置高度
		handleMobileSafariHeight()
	}

	window.addEventListener(
		'resize',
		debounce(() => {
			resize()
			// 移动端每次 resize 时重新设置高度
			handleMobileSafariHeight()
		}, 10)
	)

	// 监听屏幕方向变化
	window.addEventListener('orientationchange', () => {
		setTimeout(() => {
			handleMobileSafariHeight()
		}, 100)
	})
})

onUnmounted(() => {
	window.removeEventListener('resize', resize)
	window.removeEventListener('orientationchange', handleMobileSafariHeight)
})
</script>
<style lang="scss" scoped>
@use '@/styles/platform' as *;

.ai-assistant-page {
	height: 100%;

	.chat-view {
		width: 100%;
	}

	&.mobile-page {
		display: flex;
		flex-direction: column;
		min-height: 0;

		.chat-view {
			flex: 1;
			min-height: 0;
			height: auto;
		}
	}

	.menu-button {
		font-size: 24px;
		margin-right: 5px;
		cursor: pointer;
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--n-topbar-text-muted);
		border-radius: 8px;
		transition: all 0.3s;

		&:hover {
			color: var(--n-topbar-text);
			background: var(--n-topbar-hover-bg);
		}

		&.active {
			color: var(--el-color-primary);
			background: color-mix(
				in srgb,
				var(--el-color-primary) 22%,
				var(--n-topbar-hover-bg)
			);
		}
	}

	/* 与 layout.ts CHAT_NARROW_LAYOUT_MEDIA_MAX_PX（1019）同步 */
	@media (max-width: 1019px) {
		.menu-button {
			width: 30px;
			height: 30px;
			font-size: 20px;
			margin-right: 0;
		}
	}
}
</style>
