export type FileDto = {
	id: string
	fullFileName: string
	url: string
}

export type ObjectFileItem = {
	objectKey: string
	name: string
	directory: boolean
	etag?: string
	size: number
	contentType?: string
	lastModified: number
	operationStatus: string
	lastError?: string
}

export type ObjectFileList = {
	data: ObjectFileItem[]
	total: number
}

export type ObjectStorageSyncTask = {
	id: string
	bucket: string
	provider: string
	status: string
	scannedCount: number
	inSyncCount: number
	ossOnlyCount: number
	dbOnlyCount: number
	mismatchCount: number
	errorMessage?: string
	createdAt: number
	startedAt?: number
	completedAt?: number
}

export type ObjectStorageSyncDiff = {
	id: string
	objectKey: string
	diffType: 'IN_SYNC' | 'OSS_ONLY' | 'DB_ONLY' | 'METADATA_MISMATCH'
	resolutionStatus: string
	ossEtag?: string
	ossSize?: number
	ossModifiedAt?: number
	dbEtag?: string
	dbSize?: number
	dbModifiedAt?: number
	resolutionAction?: string
	resolutionError?: string
}

export type ObjectStorageSyncDiffList = {
	data: ObjectStorageSyncDiff[]
	total: number
}
