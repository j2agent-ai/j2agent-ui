import http from '@ai-system/http/loginInterceptor'
import { globalUrlPrefix, programTag } from '@/oem.js'
import type {
	AuditContextDetail,
	AuditContextList,
	AuditTokenRecordList,
	AuditTokenSummary
} from '@/types/audit.types'

const baseUrl = `/v1${globalUrlPrefix}rest/${programTag}/audit`

/** Token 用量按用户聚合总览 */
export const getAuditTokenSummary = (params: {
	'user-id'?: string
	username?: string
	from?: number
	to?: number
	offset: number
	limit: number
}) => http.get<AuditTokenSummary>(`${baseUrl}/token/summary`, { params })

/** Token 调用明细 */
export const getAuditTokenRecords = (params: {
	'user-id'?: string
	'agent-id'?: string
	'model-name'?: string
	'call-kind'?: string
	'usage-status'?: string
	from?: number
	to?: number
	offset: number
	limit: number
}) => http.get<AuditTokenRecordList>(`${baseUrl}/token/records`, { params })

/** 按条件查询聊天会话列表（user-id 可选） */
export const getAuditContexts = (params: {
	'user-id'?: string
	title?: string
	'agent-id'?: string
	from?: number
	to?: number
	offset: number
	limit: number
}) => http.get<AuditContextList>(`${baseUrl}/contexts`, { params })

/** 审计专用会话消息详情（按 context-id + agent-id，不传 user-id） */
export const getAuditContext = (params: {
	'context-id': string
	'agent-id': string
}) => http.get<AuditContextDetail>(`${baseUrl}/context`, { params })
