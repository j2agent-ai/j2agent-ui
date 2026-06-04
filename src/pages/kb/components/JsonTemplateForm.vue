<template>
	<div class="json-template-form-container">
		<div class="download-template">
			<el-button
				type="primary"
				@click="downloadTemplate"
				:loading="downloading"
			>
				{{ t('kb.download.json.template') }}
			</el-button>
		</div>

		<div class="upload-section" style="margin-top: 20px">
			<el-upload
				ref="uploadRef"
				:auto-upload="false"
				:multiple="false"
				:on-change="handleFileChange"
				:on-remove="handleFileRemove"
				:on-exceed="handleExceed"
				:file-list="fileList"
				accept=".json"
				:limit="1"
				drag
			>
				<el-icon class="el-icon--upload">
					<upload />
				</el-icon>
				<div class="el-upload__text">
					<em>{{ t('kb.json.template.drop.or.click.upload') }}</em>
				</div>
			</el-upload>
		</div>

		<div v-if="selectedFile" class="file-info" style="margin-top: 10px">
			<p>
				{{ t('common.selected.file') }}: {{ selectedFile.name }} ({{
					formatFileSize(selectedFile.size)
				}})
			</p>
		</div>

		<div class="submit-btn-container">
			<el-button
				type="success"
				:disabled="!selectedFile"
				:loading="uploading"
				@click="submitUpload"
			>
				{{ t('common.submit') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { t } from '@ai-system/lib'
import {
	ElButton,
	ElIcon,
	ElMessage,
	ElUpload,
	genFileId,
	type UploadFile,
	type UploadFiles,
	type UploadInstance,
	type UploadProps,
	type UploadRawFile
} from 'element-plus'
import { Upload } from '@element-plus/icons-vue'
import { ref } from 'vue'
import { downloadJsonTemplate, importJsonKnowledge } from '@/api/kb/kb.api'

const emit = defineEmits<{
	(e: 'add-success'): void
	(e: 'loading-change', loading: boolean): void
}>()

defineExpose({
	clearForm
})

const downloading = ref(false)
const uploading = ref(false)
const selectedFile = ref<File | null>(null)
const fileList = ref<UploadFile[]>([])
const uploadRef = ref<UploadInstance>()

// 下载JSON模板
const downloadTemplate = async () => {
	try {
		downloading.value = true
		await downloadJsonTemplate()
	} catch (e) {
		ElMessage.error(t('common.download.failed'))
	} finally {
		downloading.value = false
	}
}

// 处理文件选择变化
const handleFileChange = (file: UploadFile, files: UploadFiles) => {
	if (files.length > 1) {
		fileList.value = [file] // 只保留最后一个选择的文件
	} else {
		fileList.value = files // 正常赋值
	}
	selectedFile.value = file.raw || null
}

// 核心修复：处理超出限制的情况（覆盖上传）
const handleExceed: UploadProps['onExceed'] = (files) => {
	uploadRef.value!.clearFiles() // 清除旧文件
	const file = files[0] as UploadRawFile
	file.uid = genFileId() // 给新文件生成一个新的 uid
	uploadRef.value!.handleStart(file) // 手动触发选择新文件（这会再次触发 handleFileChange）
}

const handleFileRemove = () => {
	selectedFile.value = null
	fileList.value = []
}

// 提交上传
const submitUpload = async () => {
	if (!selectedFile.value) {
		ElMessage.warning(t('kb.please.select.file'))
		return
	}
	try {
		uploading.value = true
		emit('loading-change', true)
		await importJsonKnowledge(selectedFile.value)
		ElMessage.success(t('common.success'))
		emit('add-success')
		clearForm()
	} catch (error: any) {
		// 没有收到服务器响应 (说明不是 404/500 等服务器错误，而是请求未发出或中断)
		const noResponse = !error.response
		if (noResponse) {
			// 命中：很大可能是文件变动，或者是用户真的断网了
			// 在本地上传场景下，通常提示用户“文件可能已变动”是合理的
			// ERR_UPLOAD_FILE_CHANGED
			ElMessage.error(t('common.file.change'))
			// 强制清空，让用户重新选
			clearForm()
		}
	} finally {
		uploading.value = false
		emit('loading-change', false)
	}
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
	if (bytes === 0) return '0 Bytes'
	const k = 1024
	const sizes = ['Bytes', 'KB', 'MB', 'GB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function clearForm() {
	selectedFile.value = null
	fileList.value = []
	uploadRef.value?.clearFiles()
}
</script>

<style scoped lang="scss">
.json-template-form-container {
	padding: 20px;

	.download-template {
		text-align: center;

		p {
			margin-bottom: 15px;
			color: var(--n-color-text-muted);
		}
	}

	.upload-section {
		border: 1px dashed var(--n-color-border);
		border-radius: 6px;
		padding: 20px;
		text-align: center;
		transition: border-color 0.3s;

		&:hover {
			border-color: var(--el-color-primary);
		}
	}

	.file-info {
		padding: 10px;
		background: var(--n-color-bg-glass-weak);
		border-radius: 4px;
		font-size: 14px;
		color: var(--n-color-text-muted);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.submit-btn-container {
		display: flex;
		justify-content: flex-end;
		margin-top: 20px;
	}
}
</style>
