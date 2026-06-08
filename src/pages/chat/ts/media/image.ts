/**
 * 聊天图片上传前处理。
 * 解码、缩放、JPEG 压缩，确保体积满足 WebSocket 发送与后端上限。
 */

/** 与后端 ChatAttachmentService 上限一致 */
const BACKEND_MAX_BYTES = 10 * 1024 * 1024
/** WebSocket 发送前的目标体积（留余量给 Base64 膨胀） */
const TARGET_MAX_BYTES = 3 * 1024 * 1024
const MAX_DIMENSION = 2048
const MIN_DIMENSION = 480
const OUTPUT_MIME = 'image/jpeg'
const OUTPUT_EXT = 'jpg'
const INITIAL_QUALITY = 0.88
const MIN_QUALITY = 0.55

const loadImageBitmap = async (file: File): Promise<{ source: CanvasImageSource; width: number; height: number }> => {
	if (typeof createImageBitmap === 'function') {
		try {
			const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
			return { source: bitmap, width: bitmap.width, height: bitmap.height }
		} catch {
			/* fallback below */
		}
	}
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file)
		const img = new Image()
		img.onload = () => {
			URL.revokeObjectURL(url)
			resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight })
		}
		img.onerror = () => {
			URL.revokeObjectURL(url)
			reject(new Error('failed to decode image'))
		}
		img.src = url
	})
}

const scaleToMaxDimension = (width: number, height: number, maxDimension: number) => {
	if (width <= maxDimension && height <= maxDimension) {
		return { width, height }
	}
	const scale = maxDimension / Math.max(width, height)
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	}
}

const drawToCanvas = (
	source: CanvasImageSource,
	width: number,
	height: number
): HTMLCanvasElement => {
	const canvas = document.createElement('canvas')
	canvas.width = width
	canvas.height = height
	const ctx = canvas.getContext('2d')
	if (!ctx) {
		throw new Error('canvas unavailable')
	}
	ctx.fillStyle = '#ffffff'
	ctx.fillRect(0, 0, width, height)
	ctx.drawImage(source, 0, 0, width, height)
	return canvas
}

const closeImageSource = (source: CanvasImageSource) => {
	if (source instanceof ImageBitmap) {
		source.close()
	}
}

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
	new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('failed to encode image'))),
			OUTPUT_MIME,
			quality
		)
	})

const buildOutputName = (originalName: string): string => {
	const base = originalName.replace(/\.[^.]+$/, '').trim() || `image-${Date.now()}`
	return `${base}.${OUTPUT_EXT}`
}

const encodeWithCompression = async (
	source: CanvasImageSource,
	width: number,
	height: number
): Promise<Blob> => {
	let targetWidth = width
	let targetHeight = height
	let canvas = drawToCanvas(source, targetWidth, targetHeight)

	for (let resizeAttempt = 0; resizeAttempt < 6; resizeAttempt++) {
		for (let quality = INITIAL_QUALITY; quality >= MIN_QUALITY; quality -= 0.07) {
			const blob = await canvasToBlob(canvas, quality)
			if (blob.size <= TARGET_MAX_BYTES) {
				closeImageSource(source)
				return blob
			}
		}
		targetWidth = Math.max(MIN_DIMENSION, Math.round(targetWidth * 0.85))
		targetHeight = Math.max(MIN_DIMENSION, Math.round(targetHeight * 0.85))
		canvas = drawToCanvas(source, targetWidth, targetHeight)
	}

	const fallback = await canvasToBlob(canvas, MIN_QUALITY)
	closeImageSource(source)
	if (fallback.size > BACKEND_MAX_BYTES) {
		throw new Error('image too large after compression')
	}
	return fallback
}

/** 将任意可解码图片转为 JPEG，并按尺寸/质量压缩到可发送范围 */
export const processChatImageFile = async (rawFile: File): Promise<File | null> => {
	if (!rawFile.size) {
		return null
	}
	let loaded: { source: CanvasImageSource; width: number; height: number }
	try {
		loaded = await loadImageBitmap(rawFile)
	} catch {
		return null
	}
	if (!loaded.width || !loaded.height) {
		return null
	}
	const { width, height } = scaleToMaxDimension(loaded.width, loaded.height, MAX_DIMENSION)
	const blob = await encodeWithCompression(loaded.source, width, height)
	return new File([blob], buildOutputName(rawFile.name), { type: OUTPUT_MIME })
}
