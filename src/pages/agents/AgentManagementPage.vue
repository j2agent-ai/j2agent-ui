<template>
	<div class="agent-management-page">
		<top-bar />
		<main class="management-content">
			<header class="management-header">
				<div>
					<h2>{{ t('ai.agent.management.title') }}</h2>
					<p>{{ t('ai.agent.management.desc') }}</p>
				</div>
				<el-button @click="goTo('/agents')">{{
					t('ai.agent.list.title')
				}}</el-button>
			</header>
			<el-tabs v-model="activeTab" class="management-tabs">
				<el-tab-pane
					:label="t('ai.agent.management.permissions')"
					name="permissions"
				>
					<section class="builtin-permissions">
						<div>
							<h3>{{ t('ai.agent.management.builtin') }}</h3>
							<p>{{ t('ai.agent.management.permissionHint') }}</p>
						</div>
						<div class="builtin-actions">
							<el-button
								@click="openPermissions('universal_assistant', t('ai.hub'))"
								>{{ t('ai.hub') }}</el-button
							>
							<el-button
								@click="
									openPermissions(
										'knowledge_qa_assistant',
										t('ai.knowledge.qa')
									)
								"
								>{{ t('ai.knowledge.qa') }}</el-button
							>
						</div>
					</section>
					<div class="list-heading">
						<h3>{{ t('ai.agent.management.business') }}</h3>
						<el-button :loading="loading" @click="fetchAgents">{{
							t('common.refresh')
						}}</el-button>
					</div>
					<el-skeleton v-if="loading" :rows="4" animated />
					<el-alert
						v-else-if="loadError"
						:title="t('ai.agent.list.load.failed')"
						type="error"
						show-icon
						:closable="false"
					/>
					<el-empty
						v-else-if="!businessAgents.length"
						:description="t('ai.agent.list.empty')"
					/>
					<div v-else class="agent-grid">
						<article
							v-for="item in businessAgents"
							:key="item.agentId"
							class="management-agent-card"
						>
							<div class="agent-heading">
								<span class="agent-icon">{{ item.logo || '🤖' }}</span>
								<div>
									<h3>{{ resolveAgentInfoName(item) }}</h3>
									<code>{{ item.agentId }}</code>
								</div>
							</div>
							<p>{{ resolveAgentInfoDescription(item) }}</p>
							<div class="agent-actions">
								<el-button
									type="primary"
									plain
									@click="
										openPermissions(item.agentId, resolveAgentInfoName(item))
									"
									>{{ t('ai.agent.management.permissions') }}</el-button
								>
							</div>
						</article>
					</div>
				</el-tab-pane>
				<el-tab-pane
					:label="t('settings.agentPlugin.section')"
					name="agent-plugin"
					><AgentPluginSettingsPanel v-if="activeTab === 'agent-plugin'"
				/></el-tab-pane>
				<el-tab-pane
					:label="t('settings.agentGlobalConfig.section')"
					name="agent-global-config"
					><AgentGlobalConfigSettingsPanel
						v-if="activeTab === 'agent-global-config'"
				/></el-tab-pane>
			</el-tabs>
		</main>
		<ResourcePermissionDialog
			v-model="permissionVisible"
			type="agents"
			:resource-id="permissionId"
			:resource-name="permissionName"
			@changed="fetchAgents"
		/>
	</div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t } from '@ai-system/lib'
import topBar from '@/pages/components/topBar.vue'
import ResourcePermissionDialog from '@/pages/components/ResourcePermissionDialog.vue'
import AgentPluginSettingsPanel from '@/pages/settings/components/AgentPluginSettingsPanel.vue'
import AgentGlobalConfigSettingsPanel from '@/pages/settings/components/AgentGlobalConfigSettingsPanel.vue'
import { getAgentList } from '@/api/ai.api'
import { goTo } from '@/routes'
import type { AgentInfoDto } from '@/types/ai.types'
import {
	resolveAgentInfoName,
	resolveAgentInfoDescription
} from '@/pages/chat/ts/agent/name-registry'
const route = useRoute(),
	router = useRouter()
const activeTab = computed({
	get: () =>
		route.query.tab === 'agent-plugin' ||
		route.query.tab === 'agent-global-config'
			? route.query.tab
			: 'permissions',
	set: (tab: string) => {
		void router.replace({ query: { ...route.query, tab } })
	}
})
const agents = ref<AgentInfoDto[]>([]),
	loading = ref(false),
	loadError = ref(false)
const businessAgents = computed(() =>
	agents.value.filter(
		(item) =>
			!['universal_assistant', 'knowledge_qa_assistant'].includes(item.agentId)
	)
)
const permissionVisible = ref(false),
	permissionId = ref(''),
	permissionName = ref('')
function openPermissions(id: string, name: string) {
	permissionId.value = id
	permissionName.value = name
	permissionVisible.value = true
}
async function fetchAgents() {
	if (loading.value) return
	loading.value = true
	loadError.value = false
	try {
		const response = await getAgentList()
		agents.value = response.data.agents ?? []
	} catch {
		loadError.value = true
	} finally {
		loading.value = false
	}
}
watch(
	activeTab,
	(tab) => {
		if (tab === 'permissions') void fetchAgents()
	},
	{ immediate: true }
)
</script>
<style scoped lang="scss">
.agent-management-page {
	min-height: 100%;
	padding: 74px 24px 32px;
	box-sizing: border-box;
	color: var(--n-color-text-primary);
}
.management-content {
	max-width: 1200px;
	margin: 0 auto;
}
.management-header,
.builtin-permissions,
.list-heading {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 16px;
	margin-bottom: 24px;
}
h2 {
	margin: 0;
	font-size: 22px;
	font-weight: 600;
}
h3 {
	margin: 0;
	font-size: 14px;
	font-weight: 600;
}
p {
	margin: 8px 0 0;
	color: var(--n-color-text-muted);
	font-size: 13px;
	line-height: 1.7;
}
.management-tabs {
	padding: 20px;
	border: 1px solid var(--n-color-border-soft);
	border-radius: 16px;
	background: var(--n-color-bg-glass-weak);
}
.management-tabs :deep(.el-tabs__content) {
	padding-top: 16px;
}
.builtin-permissions {
	padding: 18px;
	border: 1px solid var(--n-color-border-soft);
	border-radius: 12px;
}
.builtin-actions,
.agent-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}
.builtin-actions .el-button {
	margin: 0;
}
.agent-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
	gap: 16px;
}
.management-agent-card {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 20px;
	border: 1px solid var(--n-color-border-soft);
	border-radius: 12px;
	background: var(--n-color-bg-glass-weak);
}
.agent-heading {
	display: flex;
	align-items: center;
	gap: 12px;
	min-width: 0;
}
.agent-heading > div {
	min-width: 0;
}
.agent-icon {
	font-size: 28px;
}
code {
	display: block;
	margin-top: 6px;
	font-size: 12px;
	color: var(--n-color-text-muted);
	overflow-wrap: anywhere;
}
.agent-actions {
	margin-top: auto;
	padding-top: 12px;
	border-top: 1px solid var(--n-color-border-soft);
}
@media (max-width: 640px) {
	.agent-management-page {
		padding: 66px 12px 20px;
	}
	.management-tabs {
		padding: 12px;
	}
	.agent-grid {
		grid-template-columns: 1fr;
	}
}
</style>
