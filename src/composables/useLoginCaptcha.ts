import { nextTick, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getPowCaptcha, verifyPowCaptcha, type PowCaptchaResp } from '@/api/captcha.api'
import { t } from '@ai-system/lib'
import { solvePow } from '@/utils/pow'

export interface CaptchaToken {
	code: string
	hash: string
}

export interface UseLoginCaptchaOptions {
	/** 滑动验证通过后回调（登录页用于自动提交） */
	onSlideSuccess?: () => void
}

/**
 * 登录/注册共用的人机验证（PoW + 滑动验证码）。
 */
export function useLoginCaptcha(options: UseLoginCaptchaOptions = {}) {
	const slideCaptchaRef = ref<{ updateSlideCaptcha: () => void }>()
	const powLoading = ref(false)
	const captchaDialogShow = ref(false)
	const powFailCount = ref(0)
	const captchaToken = ref<CaptchaToken | null>(null)
	const challengeData = ref<PowCaptchaResp | null>(null)
	const challengeLoading = ref(false)

	function onCaptchaDialogClose() {
		// 供页面在需要时重置 loading
	}

	function onPowVerifyFailed() {
		powFailCount.value += 1
		ElMessage.error(t('login.powFail'))
		if (powFailCount.value >= 3) {
			powFailCount.value = 0
			captchaDialogShow.value = true
			nextTick(() => slideCaptchaRef.value?.updateSlideCaptcha())
		}
	}

	async function loadPowChallenge() {
		if (challengeLoading.value) return
		challengeLoading.value = true
		try {
			const { data } = await getPowCaptcha()
			challengeData.value = data
		} catch {
			challengeData.value = null
		} finally {
			challengeLoading.value = false
		}
	}

	async function runPowVerify() {
		if (!challengeData.value || powLoading.value || captchaToken.value) return
		powLoading.value = true
		const challenge = challengeData.value
		try {
			const powNonce = await solvePow(
				challenge.hash,
				challenge.powSalt,
				challenge.powDifficulty
			)
			if (powNonce === null) {
				onPowVerifyFailed()
				challengeData.value = null
				return
			}
			const verifyRes = await verifyPowCaptcha(challenge.hash, powNonce)
			if (verifyRes.data.result && verifyRes.data.code) {
				captchaToken.value = { code: verifyRes.data.code, hash: challenge.hash }
				powFailCount.value = 0
			} else {
				onPowVerifyFailed()
				challengeData.value = null
			}
		} catch {
			ElMessage.error(t('login.powFail'))
			challengeData.value = null
		} finally {
			powLoading.value = false
		}
	}

	function slideCaptchaSuccess(e: CaptchaToken) {
		captchaToken.value = { code: e.code, hash: e.hash }
		powFailCount.value = 0
		captchaDialogShow.value = false
		options.onSlideSuccess?.()
	}

	async function handlePrimaryAction(blocked?: boolean) {
		if (blocked || powLoading.value || challengeLoading.value || captchaDialogShow.value) return
		if (captchaToken.value) return
		if (!challengeData.value) {
			await loadPowChallenge()
			if (!challengeData.value) return
		}
		void runPowVerify()
	}

	function resetCaptcha() {
		captchaToken.value = null
		challengeData.value = null
		powFailCount.value = 0
	}

	return {
		slideCaptchaRef,
		powLoading,
		captchaDialogShow,
		captchaToken,
		challengeData,
		challengeLoading,
		onCaptchaDialogClose,
		slideCaptchaSuccess,
		handlePrimaryAction,
		resetCaptcha
	}
}

/** 从 axios 错误体提取可读 message */
export function extractApiErrorMessage(
	error: unknown,
	fallback: string
): string {
	if (typeof error !== 'object' || error === null || !('response' in error)) {
		return fallback
	}
	const data = (error as { response?: { data?: { message?: string; error?: string } } }).response
		?.data
	if (data?.message) return data.message
	if (data?.error) return data.error
	return fallback
}
