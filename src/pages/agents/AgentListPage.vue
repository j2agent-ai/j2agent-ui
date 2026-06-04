<template>
	<div class="agent-list-page" :class="{ 'full-page': isFullscreen, 'mobile-page': isMobile }">
		<top-bar/>
		<div class="agent-list-inner">
			<h2 class="page-title">{{ t('ai.agent.list.title') }}</h2>
			<div v-if="loading" class="loading-hint">{{ t('ai.agent.list.loading') }}…</div>
			<div v-else-if="loadError" class="error-hint">{{ t('ai.agent.list.load.failed') }}</div>
			<div v-else-if="agents.length === 0" class="empty-hint">
				{{ t('ai.agent.list.empty') }}
			</div>
			<div v-else class="agent-cards">
				<div
					v-for="item in agents"
					:key="item.agentId"
					class="agent-card"
					@click="openChat(item.agentId)"
				>
					<div class="card-icon">🤖</div>
					<h3>{{ item.name }}</h3>
					<p class="meta">
						<span class="label">ID : </span>
						<code>{{ item.agentId }}</code>
					</p>
					<p v-if="item.description" class="desc">{{ item.description }}</p>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { debounce, t } from '@ai-system/lib'
import { ElMessage } from 'element-plus'
import topBar from '@/pages/components/topBar.vue'
import { getAgentList } from '@/api/ai.api'
import { goTo } from '@/routes'
import type { AgentInfoDto } from '@/types/ai.types'

const route = useRoute()
const isFullscreen = ref(true)
const isMobile = ref(false)
const loading = ref(true)
const loadError = ref(false)
const agents = ref<AgentInfoDto[]>([])

/**
 * 拉取后端已注册的智能体列表并填充卡片数据。
 */
const fetchAgents = () => {
	loading.value = true
	loadError.value = false
	getAgentList()
		.then((res) => {
			agents.value = res.data.agents ?? []
		})
		.catch(() => {
			loadError.value = true
			ElMessage.error(t('ai.agent.list.load.failed'))
		})
		.finally(() => {
			loading.value = false
		})
}

/**
 * 进入指定智能体的聊天页，通过 query 传入 agent-id。
 */
const openChat = (agentId: string) => {
	goTo('/chat/assistant?agent-id=' + encodeURIComponent(agentId))
}

const resize = () => {
	const width =
		window.innerWidth ||
		document.documentElement.clientWidth ||
		document.body.clientWidth

	if (width < 768 || route.query?.isMobile) {
		isMobile.value = true
		isFullscreen.value = false
		document.body.style.minWidth = '0px'
	} else {
		isMobile.value = false
		isFullscreen.value = true
		document.body.style.minWidth = '768px'
	}
}

onMounted(() => {
	fetchAgents()
	resize()
	window.addEventListener(
		'resize',
		debounce(() => resize(), 10)
	)
})

onUnmounted(() => {
	window.removeEventListener('resize', resize)
})
</script>

<style lang="scss" scoped>
.agent-list-page {
	height: 100%;
	padding-top: 50px;

	.agent-list-inner {
		padding: 24px 20px 40px;
		max-width: 1200px;
		margin: 0 auto;
	}

	.page-title {
		font-size: 22px;
		font-weight: 600;
		color: var(--n-color-text-primary);
		margin-bottom: 20px;
		text-align: center;
	}

	.loading-hint,
	.error-hint,
	.empty-hint {
		text-align: center;
		color: var(--n-color-text-primary);
		padding: 24px;
	}

	.agent-cards {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 20px;
	}

	.agent-card {
		width: 260px;
		border-radius: var(--n-radius-quadruple);
		padding: 20px 18px;
		text-align: left;
		cursor: pointer;

		&:hover {
			transform: translateY(-5px);
		}

		.card-icon {
			font-size: 36px;
			margin-bottom: 12px;
			text-align: center;
		}

		h3 {
			font-size: 17px;
			font-weight: 600;
			color: var(--n-color-text-primary);
			margin-bottom: 10px;
			text-align: center;
		}

		.meta {
			font-size: 13px;
			color: var(--n-color-text-primary);
			margin-bottom: 8px;
			word-break: break-all;

			.label {
				margin-right: 6px;
			}

			code {
				font-size: 12px;
				background: var(--n-color-bg-glass-weak);
				padding: 2px 6px;
				border-radius: 4px;
			}
		}

		.desc {
			font-size: 14px;
			color: var(--n-color-text-primary);
			line-height: 1.5;
			margin-top: 4px;
		}
	}
}
</style>
