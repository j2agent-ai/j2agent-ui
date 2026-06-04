import { ROLE_ADMIN } from '@/utils/role'

export default [
	{
		path: '/kb',
		name: 'knowledgeBase',
		component: () => import('@/pages/kb/index.vue'),
		meta: { requiredRole: ROLE_ADMIN }
	}
]
