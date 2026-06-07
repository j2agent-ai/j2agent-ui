import { ROLE_ADMIN } from '@/utils/role'

export default [
	{
		path: '/files',
		name: 'fileManagement',
		component: () => import('@/pages/files/index.vue'),
		meta: { requiredRole: ROLE_ADMIN }
	}
]
