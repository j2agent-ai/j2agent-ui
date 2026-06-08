<template>
	<div class="web-app" :class="classObj">
		<el-config-provider :locale="elLocale">
			<router-view v-slot="{ Component }">
				<keep-alive :include="['pageChatAssistant']">
					<component :is="Component" />
				</keep-alive>
			</router-view>
			<ChatActivityPanel />
		</el-config-provider>
	</div>
</template>

<script lang="ts" setup>
import { ElConfigProvider } from 'element-plus'
import { useElementLocale } from '@ai-system/hooks'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { t } from '@ai-system/lib'
import ChatActivityPanel from '@/pages/chat/components/ChatActivityPanel.vue'
import { ensureAgentNamesLoaded } from '@/pages/chat/agentNameRegistry'
import { useWarnBeforeUnloadOnActiveTasks } from '@/pages/chat/useWarnBeforeUnloadOnActiveTasks'

useWarnBeforeUnloadOnActiveTasks()
onMounted(() => {
	void ensureAgentNamesLoaded()
})
document.getElementsByTagName('title')[0].innerHTML = t('ai.title')
const { elLocale } = useElementLocale()

const route = useRoute()

const isScreen = ref(false)
watch(
	() => route.hash,
	(newHash, oldHash) => {
		if (newHash && newHash.indexOf('big-screen') > -1) {
			isScreen.value = true
		} else {
			isScreen.value = false
		}
	}
)
const classObj = computed(() => {
	return {
		isScreen: isScreen.value // 是否大屏页面
	}
})
</script>

<style lang="scss">
.web-app {
	background: var(--n-color-bg-page);
	position: relative;
	height: 100%;
	z-index: 0;
	&.isFullscreen {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
		padding: 0;
		margin: 0;
	}
	&.isScreen {
		.content {
			margin: 0 !important;
		}
	}
}

</style>
