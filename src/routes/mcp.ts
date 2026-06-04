import { ROLE_ADMIN } from '@/utils/role'

export default [
	{
		path: '/mcp',
		name: 'mcpManagement',
		component: () => import('@/pages/mcp/index.vue'),
		meta: { requiredRole: ROLE_ADMIN }
	}
]
