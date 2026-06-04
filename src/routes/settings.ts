import { ROLE_ADMIN } from '@/utils/role'

export default [
	{
		path: '/settings',
		name: 'Settings',
		component: () => import('@/pages/settings/index.vue'),
		meta: { requiredRole: ROLE_ADMIN }
	}
]
