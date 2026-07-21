import http from '@ai-system/http/loginInterceptor'
import {
	KnowledgeAddDto,
	KnowledgeCollectionListDto,
	KnowledgeGetListDto,
	KnowledgeRepositoryDto,
	KnowledgeRepositoryListDto,
	KnowledgeRepositorySyncResult,
	KnowledgeRepositoryUpsertDto,
	KnowledgeRetrieveResponseDto,
	KnowledgeSyncResult,
	KnowledgeSyncStatusDto
} from '@/types/kb.model'
import { globalUrlPrefix, programTag } from '../../oem.js'
import { appendAuthTokenToUrl } from '@/utils/authenticatedUrl'

export const getKnowledge = (
	offset: number,
	limit: number,
	collection: string,
	search?: string
) => {
	return http.get<KnowledgeGetListDto>(
		`/v1${globalUrlPrefix}rest/${programTag}/knowledge`,
		{
			params: {
				offset,
				limit,
				collection,
				search
			}
		}
	)
}

export const getKnowledgeCollections = () => {
	return http.get<KnowledgeCollectionListDto>(
		`/v1${globalUrlPrefix}rest/${programTag}/knowledge/collections`
	)
}

export const getKnowledgeRepositories = () => {
	return http.get<KnowledgeRepositoryListDto>(
		`/v1${globalUrlPrefix}rest/${programTag}/knowledge/repositories`
	)
}

export const getKnowledgeRepository = (id: string) => {
	return http.get<KnowledgeRepositoryDto>(
		`/v1${globalUrlPrefix}rest/${programTag}/knowledge/repositories/${id}`
	)
}

export const createKnowledgeRepository = (payload: KnowledgeRepositoryUpsertDto) => {
	return http.post<KnowledgeRepositoryDto>(
		`/v1${globalUrlPrefix}rest/${programTag}/knowledge/repositories`,
		payload
	)
}

export const updateKnowledgeRepository = (id: string, payload: KnowledgeRepositoryUpsertDto) => {
	return http.put<KnowledgeRepositoryDto>(
		`/v1${globalUrlPrefix}rest/${programTag}/knowledge/repositories/${id}`,
		payload
	)
}

export const deleteKnowledgeRepository = (id: string) => {
	return http.delete<void>(
		`/v1${globalUrlPrefix}rest/${programTag}/knowledge/repositories/${id}`
	)
}

export const syncKnowledgeRepository = (id: string) => {
	return http.post<KnowledgeRepositorySyncResult>(
		`/v1${globalUrlPrefix}rest/${programTag}/knowledge/repositories/${id}/sync`
	)
}

/**
 * 手动触发知识库目录增量同步（异步提交）
 */
export const syncKnowledge = (fullRebuild = false) => {
	return http.post<KnowledgeSyncResult>(
		`/v1${globalUrlPrefix}rest/${programTag}/knowledge/sync`,
		null,
		{
			params: { fullRebuild }
		}
	)
}

export const getKnowledgeSyncStatus = () => {
	return http.get<KnowledgeSyncStatusDto>(
		`/v1${globalUrlPrefix}rest/${programTag}/knowledge/sync/status`
	)
}

export const retrieveKnowledge = (queryText: string, topK: number, collection: string) => {
	return http.get<KnowledgeRetrieveResponseDto>(
		`/v1${globalUrlPrefix}rest/${programTag}/knowledge/retrieve`,
		{
			params: {
				'query-text': queryText,
				'top-k': topK,
				collection
			}
		}
	)
}

export const deleteKnowledge = (textChunkIds: string[]) => {
	return http.post(
		`/v1${globalUrlPrefix}rest/${programTag}/knowledge/delete`,
		textChunkIds
	)
}

export const putKnowledge = (knowledgeList: KnowledgeAddDto[]) => {
	return http.put<void>(`/v1${globalUrlPrefix}rest/${programTag}/knowledge`, knowledgeList)
}

/**
 * 下载JSON模板
 */
export const downloadJsonTemplate = () => {
	window.open(
		appendAuthTokenToUrl(
			`/v1${globalUrlPrefix}rest/${programTag}/knowledge/json-template`
		)
	)
}

/**
 * 导入JSON数据
 */
export const importJsonKnowledge = (file: File): Promise<any> => {
	const formData = new FormData()
	formData.append('jsonTemplate', file)
	return http.post(
		`/v1${globalUrlPrefix}rest/${programTag}/knowledge/json-template`,
		formData
	)
}
