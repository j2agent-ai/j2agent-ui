import http from '@ai-system/http/loginInterceptor'
import {
	KnowledgeAddDto,
	KnowledgeCollectionListDto,
	KnowledgeGetListDto,
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
