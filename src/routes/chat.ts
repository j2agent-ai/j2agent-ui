import { ROLE_USER } from '@/utils/role'

export default [
	{
		path: '/agents',
		name: 'AgentList',
		component: () => import('@/pages/agents/AgentListPage.vue'),
		meta: { requiredRole: ROLE_USER }
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