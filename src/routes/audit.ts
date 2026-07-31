import { ROLE_ADMIN } from '@/utils/role'

export default [
	{
		path: '/audit',
		name: 'audit',
		component: () => import('@/pages/audit/index.vue'),
		meta: { requiredRole: ROLE_ADMIN }
	}
]
