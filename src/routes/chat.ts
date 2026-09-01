import { ROLE_ADMIN, ROLE_USER } from '@/utils/role'

export default [
	{
		path: '/agent-management',
		name: 'AgentManagement',
		component: () => import('@/pages/agents/AgentManagementPage.vue'),
		meta: { requiredRole: ROLE_ADMIN }
	},
	{
		path: '/agents',
		name: 'AgentList',
		component: () => import('@/pages/agents/AgentListPage.vue'),
		meta: { requiredRole: ROLE_ADMIN }
	},
	{
		path: '/chat/assistant',
		name: 'AIAssistant',
		component: () => import('@/pages/chat/AIAssistantPage.vue'),
		meta: { requiredRole: ROLE_USER }
	},
	{
		path: '/chat/speech',
		name: 'SpeechDemo',
		component: () => import('@/pages/chat/components/SpeechDemo.vue'),
		meta: { requiredRole: ROLE_USER }
	}
]
