import { ROLE_USER } from '@/utils/role'

export default [
	{
		path: '/account',
		name: 'Account',
		component: () => import('@/pages/account/AccountSettings.vue'),
		meta: { requiredRole: ROLE_USER }
	}
]
