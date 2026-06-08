import http from '@ai-system/http/loginInterceptor'
import { globalUrlPrefix, programTag } from '../oem.js'
import type {
	ObjectFileItem,
	ObjectFileList,
	ObjectFileUploadInit,
	ObjectStorageSyncDiffList,
	ObjectStorageSyncTask
} from '@/types/file.types'
import { resolveObjectFileUploadInit } from '@/utils/ossDisplayUrl'

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

export const initObjectFileDirectUpload = (
	prefix: string,
	file: File
) =>
	http.post<ObjectFileUploadInit>(`${baseUrl}/upload/init`, {
		prefix,
		filename: file.name,
		contentType: file.type || 'application/octet-stream',
		sizeBytes: file.size
	})

export const completeObjectFileDirectUpload = (objectKey: string) =>
	http.post<ObjectFileItem>(`${baseUrl}/upload/complete`, { objectKey })

export const abortObjectFileDirectUpload = (objectKey: string) =>
	http.post<void>(`${baseUrl}/upload/abort`, { objectKey })

export const touchObjectFileUploadHeartbeat = (objectKey: string) =>
	http.post<void>(`${baseUrl}/upload/heartbeat`, { objectKey })

const COMPLETE_RETRY_ATTEMPTS = 3
const COMPLETE_RETRY_BASE_DELAY_MS = 1000
const UPLOAD_HEARTBEAT_INTERVAL_MS = 10_000

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

async function completeObjectFileDirectUploadWithRetry(
	objectKey: string
): Promise<ObjectFileItem> {
	let lastError: unknown
	for (let attempt = 0; attempt < COMPLETE_RETRY_ATTEMPTS; attempt++) {
		try {
			const response = await completeObjectFileDirectUpload(objectKey)
			return response.data
		} catch (error) {
			lastError = error
			if (attempt < COMPLETE_RETRY_ATTEMPTS - 1) {
				await sleep(COMPLETE_RETRY_BASE_DELAY_MS * (attempt + 1))
			}
		}
	}
	throw lastError
}

function uploadWithXhr(
	url: string,
	method: string,
	body: BodyInit,
	headers: Record<string, string>,
	onProgress?: (percent: number) => void
): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest()
		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable && onProgress) {
				onProgress(Math.round((event.loaded / event.total) * 100))
			}
		}
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve()
				return
			}
			reject(new Error(`Upload failed with status ${xhr.status}`))
		}
		xhr.onerror = () => reject(new Error('Network error during upload'))
		xhr.open(method, url)
		for (const [key, value] of Object.entries(headers)) {
			xhr.setRequestHeader(key, value)
		}
		xhr.send(body)
	})
}

async function uploadDirectToStorage(
	file: File,
	init: ObjectFileUploadInit,
	onProgress?: (percent: number) => void
): Promise<void> {
	const uploadToken = init.providerExtras?.uploadToken
	if (uploadToken) {
		const formData = new FormData()
		formData.append('file', file)
		formData.append('token', uploadToken)
		formData.append('key', init.providerExtras?.objectKey || init.objectKey)
		await uploadWithXhr(init.uploadUrl, 'POST', formData, {}, onProgress)
		return
	}

	const headers = { ...(init.headers || {}) }
	if (!headers['Content-Type']) {
		headers['Content-Type'] = file.type || 'application/octet-stream'
	}
	await uploadWithXhr(init.uploadUrl, init.method || 'PUT', file, headers, onProgress)
}

async function uploadDirectToStorageWithHeartbeat(
	file: File,
	init: ObjectFileUploadInit,
	onProgress?: (percent: number) => void
): Promise<void> {
	let heartbeatTimer: ReturnType<typeof setInterval> | undefined
	const stopHeartbeat = () => {
		if (heartbeatTimer !== undefined) {
			clearInterval(heartbeatTimer)
			heartbeatTimer = undefined
		}
	}
	try {
		await touchObjectFileUploadHeartbeat(init.objectKey)
		heartbeatTimer = setInterval(() => {
			void touchObjectFileUploadHeartbeat(init.objectKey).catch(() => {
				// ignore transient heartbeat failures during upload
			})
		}, UPLOAD_HEARTBEAT_INTERVAL_MS)
		await uploadDirectToStorage(file, init, onProgress)
	} finally {
		stopHeartbeat()
	}
}

export async function uploadObjectFileDirect(
	file: File,
	prefix: string,
	onProgress?: (percent: number) => void
): Promise<ObjectFileItem> {
	const initResponse = await initObjectFileDirectUpload(prefix, file)
	const init = resolveObjectFileUploadInit(initResponse.data)
	let ossUploaded = false
	try {
		await uploadDirectToStorageWithHeartbeat(file, init, onProgress)
		ossUploaded = true
		return await completeObjectFileDirectUploadWithRetry(init.objectKey)
	} catch (error) {
		if (!ossUploaded) {
			try {
				await abortObjectFileDirectUpload(init.objectKey)
			} catch {
				// ignore cleanup failures
			}
		}
		throw error
	}
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

export const getLatestObjectStorageDifferenceCheck = () =>
	http.get<ObjectStorageSyncTask>(`${baseUrl}/sync/tasks/latest`)

export const getObjectStorageScanTask = (taskId: string) =>
	http.get<ObjectStorageSyncTask>(`${baseUrl}/sync/tasks/${taskId}`)

export const cancelObjectStorageDifferenceCheck = (taskId: string) =>
	http.post<ObjectStorageSyncTask>(`${baseUrl}/sync/tasks/${taskId}/cancel`)

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
