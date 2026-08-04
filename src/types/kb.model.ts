export interface KnowledgeGetListDto {
	data?: KnowledgeDto[]
}

export interface KnowledgeCollectionListDto {
	data?: KnowledgeCollectionDto[]
}

export interface KnowledgeCollectionDto {
	collection?: string
	selectionValue?: string
	name?: string
	repoCode?: string
	repositoryName?: string
	type?: KnowledgeRepositoryType
}

export type KnowledgeRepositoryType = 'LOCAL_FILE' | 'REMOTE'
export type KnowledgeRepositoryProtocol = 'GIT'
export type KnowledgeRepositoryStatus = 'IDLE' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'DIRECTORY_MISSING'

export interface KnowledgeRepositoryCredentialConfig {
	username?: string
	password?: string
	token?: string
	accessKey?: string
	secretKey?: string
}

export interface KnowledgeRepositoryDto {
	id?: string
	repoCode?: string
	type?: KnowledgeRepositoryType
	protocol?: KnowledgeRepositoryProtocol
	enabled?: boolean
	readonly?: boolean
	localPath?: string
	updateIntervalMinutes?: number
	status?: KnowledgeRepositoryStatus
	remoteUrl?: string
	defaultBranch?: string
	subPaths?: string[]
	lastRevision?: string
	lastRevisionMessage?: string
	lastRevisionAuthor?: string
	lastRevisionTime?: number
	lastSyncTime?: number
	lastError?: string
	protocolConfig?: Record<string, unknown>
	hasCredential?: boolean
	collections?: string[]
	displayName?: string
	collectionName?: string
	partitionNames?: string[]
	minHeadingLevel?: number
	filenameAsTitle?: boolean
}

export interface KnowledgeRepositoryListDto {
	data?: KnowledgeRepositoryDto[]
}

export interface KnowledgeRepositoryUpsertDto {
	repoCode?: string
	type?: KnowledgeRepositoryType
	protocol?: KnowledgeRepositoryProtocol
	enabled?: boolean
	updateIntervalMinutes?: number
	remoteUrl?: string
	defaultBranch?: string
	subPaths?: string[]
	protocolConfig?: Record<string, unknown>
	displayName?: string
	collectionName?: string
	partitionNames?: string[]
	minHeadingLevel?: number
	filenameAsTitle?: boolean
	credentialConfig?: KnowledgeRepositoryCredentialConfig
}

export interface KnowledgeRepositorySyncResult {
	success?: boolean
	message?: string
}

/** 知识库目录同步提交结果 */
export interface KnowledgeSyncResult {
	success?: boolean
	message?: string
}

export type KnowledgeSyncTaskType =
	| 'IDLE'
	| 'INITIALIZING'
	| 'PROBING'
	| 'INCREMENTAL_SYNC'
	| 'FULL_REBUILD'
	| 'FAILED'

export type KnowledgeSyncPhase =
	| 'IDLE'
	| 'PREPARING'
	| 'SCANNING'
	| 'DELETING'
	| 'UPSERTING'
	| 'COMPLETED'

export type KnowledgeSyncFileChangeType = 'ADDED' | 'MODIFIED' | 'DELETED'

export type KnowledgeSyncFileStatus =
	| 'PENDING'
	| 'IN_PROGRESS'
	| 'SYNCED'
	| 'DELETED'
	| 'SKIPPED'
	| 'FAILED'

export interface KnowledgeSyncFileStatusDto {
	filePath?: string
	changeType?: KnowledgeSyncFileChangeType
	status?: KnowledgeSyncFileStatus
	collection?: string
	knowledgeCount?: number
	errorMessage?: string
}

export interface KnowledgeSyncStatusDto {
	ready?: boolean
	dimension?: number | null
	modelName?: string | null
	providerType?: string | null
	embeddingBatchSize?: number | null
	lastProbeTime?: number | null
	probeError?: string | null
	taskType?: KnowledgeSyncTaskType
	maintenanceActive?: boolean
	fullRebuildRunning?: boolean
	exclusiveSyncActive?: boolean
	lastFailureMessage?: string
	phase?: KnowledgeSyncPhase
	totalCount?: number
	processedCount?: number
	currentFilePath?: string
	files?: KnowledgeSyncFileStatusDto[]
}

export interface KnowledgeDto {
	/**
	 * 知识ID（文本块的SHA-1）
	 */
	textChunkId?: string

	/**
	 * 知识概要（用于嵌入后检索的文本）
	 */
	outline?: string[]

	/**
	 * 文本块
	 */
	textChunk?: string

	/**
	 * 嵌入模型名称
	 */
	embeddingModel?: string

	/**
	 * 嵌入模型提供商名称
	 */
	embeddingProvider?: string

	/**
	 * 嵌入向量的维度
	 */
	dimension?: number

	/**
	 * 描述
	 */
	description?: string

	/**
	 * 文件名
	 */
	fileName?: string

	/**
	 * 文件ID
	 */
	fileId?: number

	/**
	 * 源文件路径
	 */
	sourceFile?: string
}

export interface KnowledgeRetrieveResponseDto {
	data: KnowledgeRetrieveItemDto[]
}

export interface KnowledgeRetrieveItemDto {
	/**
	 * 文本块的 SHA-1 哈希值
	 */
	hash?: string

	/**
	 * 匹配度 [-1, 1]
	 */
	score?: number

	/**
	 * 混合检索得分
	 */
	hybridScore?: number

	/**
	 * 稠密向量检索得分
	 */
	denseScore?: number

	/**
	 * 稀疏向量检索得分
	 */
	sparseScore?: number

	/**
	 * 距离度量类型
	 * - L2: 欧几里得距离
	 * - IP: 内积
	 * - COSINE: 余弦相似度
	 * - JACCARD: 杰卡德相似系数
	 * - HAMMING: 汉明距离
	 */
	metricType?: 'L2' | 'IP' | 'COSINE' | 'JACCARD' | 'HAMMING'

	/**
	 * 稠密向量检索指标
	 */
	denseMetricType?: 'L2' | 'IP' | 'COSINE' | 'JACCARD' | 'HAMMING'

	/**
	 * 稀疏向量检索指标
	 */
	sparseMetricType?: 'BM25'

	/**
	 * 嵌入模型名称
	 */
	embeddingModel?: string

	/**
	 * 嵌入模型提供商名称
	 */
	embeddingProvider?: string

	/**
	 * 嵌入向量的维度
	 */
	dimension?: number

	/**
	 * 嵌入文本值（知识概要）
	 */
	outline?: string

	/**
	 * 文本块内容
	 */
	textChunk?: string

	/**
	 * 文件名
	 */
	textChunkId?: string

	/**
	 * 源文件路径
	 */
	sourceFile?: string

	/**
	 * 是否被命中阈值过滤
	 */
	isFiltered?: boolean
}


export interface KnowledgeAddDto {
	/**
	 * 知识ID（文本块的SHA-1）
	 */
	id?: string;

	/**
	 * 知识概要（用于嵌入后检索的文本）
	 */
	outline?: string[];

	/**
	 * 文本块
	 */
	textChunk?: string;

	/**
	 * 描述
	 */
	description?: string;

	/**
	 * 文件ID
	 */
	fileId?: number;

	/**
	 * 分类
	 */
	classify?: string;

	/**
	 * 文件位置
	 */
	fileLocation?: string;
}
