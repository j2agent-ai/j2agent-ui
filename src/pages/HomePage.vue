<template>
	<div
		class="ai-assistant-page"
		:class="{ 'full-page': isFullscreen, 'mobile-page': isMobile }"
	>
		<top-bar/>
		<!-- 功能导航卡片 -->
		<div class="feature-cards">
			<div class="feature-card" v-if="canAccessChat" @click="goTo('/agents')">
				<div class="card-icon">🤖</div>
				<h3>{{ t('ai.assistant') }}</h3>
				<p>{{ t('ai.assistant.desc') }}</p>
			</div>
			<div class="feature-card" v-if="canAccessAdmin" @click="goTo('/kb')">
				<div class="card-icon">📚</div>
				<h3>{{ t('kb.knowledge.base') }}</h3>
				<p>{{ t('kb.management') }}</p>
			</div>
			<div class="feature-card" v-if="canAccessAdmin" @click="goTo('/mcp')">
				<div class="card-icon">🧩</div>
				<h3>{{ t('mcp.title') }}</h3>
				<p>{{ t('mcp.desc') }}</p>
			</div>
			<div class="feature-card" v-if="canAccessAdmin" @click="goTo('/files')">
				<div class="card-icon">📁</div>
				<h3>{{ t('files.title') }}</h3>
				<p>{{ t('files.desc') }}</p>
			</div>
			<div class="feature-card" v-if="canAccessAdmin" @click="goTo('/settings')">
				<div class="card-icon">⚙️</div>
				<h3>{{ t('settings.title') }}</h3>
				<p>{{ t('settings.desc') }}</p>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { debounce, t } from '@ai-system/lib'
import topBar from '@/pages/components/topBar.vue'
import { getNewContextId } from '@/api/ai.api'
import { goTo } from '@/routes'
import { hasRoleAccess, ROLE_ADMIN, ROLE_USER } from '@/utils/role'

const route = useRoute()
const isFullscreen = ref(true)
const isMobile = ref(false)
const canAccessChat = computed(() => hasRoleAccess(ROLE_USER))
const canAccessAdmin = computed(() => hasRoleAccess(ROLE_ADMIN))

const onWindowResize = debounce(() => {
	resize()
	handleMobileSafariHeight()
}, 10)

const onOrientationChange = () => {
	setTimeout(() => {
		handleMobileSafariHeight()
	}, 100)
}

const resize = () => {
	const width =
		window.innerWidth ||
		document.documentElement.clientWidth ||
		document.body.clientWidth

	if (width < 768 || route.query?.isMobile) {
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
		document.body.style.minWidth = '768px'
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
	getNewContextId()
	resize()
	handleMobileSafariHeight()
	window.addEventListener('resize', onWindowResize)
	window.addEventListener('orientationchange', onOrientationChange)
})

onUnmounted(() => {
	window.removeEventListener('resize', onWindowResize)
	window.removeEventListener('orientationchange', onOrientationChange)
})
</script>
<style lang="scss" scoped>
.ai-assistant-page {
	height: 100%;
	padding-top: 50px;

	.feature-cards {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 20px;
		padding: 30px 20px;

		.feature-card {
			width: 220px;
			border-radius: var(--n-radius-quadruple);
			padding: 24px 20px;
			text-align: center;
			cursor: pointer;

			&:hover {
				transform: translateY(-5px);
			}

			.card-icon {
				font-size: 40px;
				margin-bottom: 16px;
			}

			h3 {
				font-size: 18px;
				font-weight: 600;
				color: var(--n-color-text-primary);
				margin-bottom: 8px;
			}

			p {
				font-size: 14px;
				color: var(--n-color-text-primary);
				line-height: 1.5;
			}
		}
	}

	.chat-view {
		width: 100%;
	}
}
</style>
