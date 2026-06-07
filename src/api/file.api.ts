import http from '@ai-system/http/loginInterceptor'
import { globalUrlPrefix, programTag } from '../oem.js'
import type {
	ObjectFileItem,
	ObjectFileList,
	ObjectStorageSyncDiffList,
	ObjectStorageSyncTask
} from '@/types/file.types'

const baseUrl = `/v1${globalUrlPrefix}rest/${programTag}/files`

export const getObjectFiles = (params: {
	prefix?: string
	keyword?: string
	status?: string
	offset: number
	limit: number
}) => http.get<ObjectFileList>(baseUrl, { params })

export const uploadObjectFile = (file: File, prefix: string) => {
	const formData = new FormData()
	formData.append('file', file)
	return http.post<ObjectFileItem>(baseUrl, formData, {
		params: { prefix },
		headers: { 'Content-Type': 'multipart/form-data' }
	})
}

export const deleteObjectFile = (objectKey: string) =>
	http.delete(baseUrl, { params: { 'object-key': objectKey } })

export const deleteObjectFiles = (objectKeys: string[]) =>
	http.post<{ success: boolean; failedIds: string[] }>(`${baseUrl}/delete-batch`, {
		objectKeys
	})

export const getObjectFilePreviewUrl = (objectKey: string) =>
	http.get<{ url: string }>(`${baseUrl}/preview`, {
		params: { 'object-key': objectKey }
	})

export const createObjectStorageScanTask = () =>
	http.post<ObjectStorageSyncTask>(`${baseUrl}/sync/tasks`)

export const getObjectStorageScanTask = (taskId: string) =>
	http.get<ObjectStorageSyncTask>(`${baseUrl}/sync/tasks/${taskId}`)

export const getObjectStorageScanDiffs = (
	taskId: string,
	params: {
		diffType?: string
		resolutionStatus?: string
		offset: number
		limit: number
	}
) =>
	http.get<ObjectStorageSyncDiffList>(`${baseUrl}/sync/tasks/${taskId}/diffs`, {
		params: {
			'diff-type': params.diffType,
			'resolution-status': params.resolutionStatus,
			offset: params.offset,
			limit: params.limit
		}
	})

export const resolveObjectStorageDiffs = (diffIds: string[], action: string) =>
	http.post<{ success: boolean; failedIds: string[] }>(`${baseUrl}/sync/resolve`, {
		diffIds,
		action
	})
