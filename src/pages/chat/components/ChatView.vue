<template>
	<div
		class="chat-container"
		:class="{
			fullscreen: isFullscreen,
			'is-mobile': isMobile,
			'is-history-open': isMobile && showChatManage
		}"
	>
		<ChatManage
			v-show="showChatManage || isFullscreen"
			class="chat-manage"
			ref="chatManageRef"
			:new-chat="newChat"
			:history-chat="historyChat"
			:curr-context-id="contextId"
			:message-context="messageContext"
			:is-busy="isBusyByState"
			:agent-id="props.agentId"
			@show-chat-manage="(val) => (showChatManage = val)"
		/>
		<div
			v-if="!showChatManage || isFullscreen"
			ref="chatViewRef"
			class="chat-view"
		>
			<el-scrollbar ref="scrollbarRef" class="scroll" @scroll="checkScroll">
				<div class="message-init">
					<div class="ai-logo">
						<!--						<img src="/src/assets/ai-logo-b.png" />-->
						<span class="ai-logo-emoji">🤖</span>
					</div>
					<h2 class="title">{{ $t('ai.hi.assistant') }}</h2>
					<div v-if="showHotQuestions" class="hot-questions">
						<div class="fx hot-questions-title">
							<strong class="fx">
								<el-icon>
									<ChatLineSquare />
								</el-icon>
								{{ $t('ai.hot.question') }}</strong
							>
							<span class="change fx" @click="getHotQuestions"
								>{{ $t('ai.refresh.hot.question')
								}}<el-icon><Refresh /></el-icon
							></span>
						</div>
						<div class="question-list">
							<div
								v-for="(item, index) in hotQuestions"
								:key="index"
								class="question"
								@click="clickHotQuestion(item.question)"
							>
								<strong class="qa">HOT</strong>{{ item.question }}
							</div>
						</div>
					</div>
				</div>
				<div
					v-if="visibleMessageContext.length"
					ref="messageListRef"
					class="message-list"
					@click="handleMessageMediaClick"
				>
					<div
						v-for="(message, index) in visibleMessageContext"
						:key="index"
						class="message-row"
						:class="[message.role]"
					>
						<template v-if="message.role === 'assistant'">
							<div class="avatar-wrap">
								<el-avatar :size="messageAvatarSize" class="ai-chat-logo">
									<!--									<img src="/src/assets/ai-logo-w.png" />-->
									<span class="avatar-emoji">🤖</span>
								</el-avatar>
							</div>
							<div
								class="message-bubble-wrap"
								:class="{
									'thinking-bubble':
										isActiveAssistantTurn(index) && isBusyByState
								}"
							>
								<div class="message-content">
									<AgentThinkingBlock
										v-if="message.reasoningContent?.trim()"
										:content="message.reasoningContent"
										:active="isActiveAssistantTurn(index) && isBusyByState"
									/>
									<div
										v-if="message.content"
										:key="`assistant-md-${index}-${MARKDOWN_RENDERER_REVISION}`"
										class="assistant-answer message-md"
									>
										<div
											v-for="(seg, segIdx) in splitStreamingSegments(
												message.content
											)"
											:key="segIdx"
											class="assistant-stream-segment"
											:data-md-stream-tail="
												isActiveAssistantTurn(index) && !seg.complete
													? ''
													: null
											"
											v-html="
												renderMarkdown(
													seg.text +
														(isActiveAssistantTurn(index) && !seg.complete
															? '...'
															: '')
												)
											"
										/>
									</div>
									<div
										v-show="message.srcFile && message.srcFile.length > 0"
										class="src-file message-md"
									>
										<br />
										<p>
											{{ $t('ai.source') }}
										</p>
										<div
											v-html="
												renderMarkdown(convertSrcFilesToMd(message.srcFile))
											"
										/>
									</div>
									<AgentTurnTimeline
										v-if="message.turnSteps?.length"
										:steps="message.turnSteps"
										:active="isActiveAssistantTurn(index)"
										:current-state="
											isActiveAssistantTurn(index) ? currentAgentState : null
										"
									/>
									<div v-show="message?.content" class="message-actions">
										<div v-show="!isBusyByState" class="support">
											<span
												class="feedback-icon-good"
												:class="{ good: message.feedback === 1 }"
												@click="handleMsgFeedback(1, message)"
												>👍</span
											>
											&nbsp;
											<span
												class="feedback-icon-bad"
												:class="{ bad: message.feedback === 2 }"
												@click="handleMsgFeedback(2, message)"
												>👎</span
											>
										</div>
										<el-button
											class="copy-button"
											text
											size="small"
											:icon="DocumentCopy"
											@click="copyMessage(message.content)"
										/>
									</div>
								</div>
							</div>
						</template>
						<template v-else-if="message.role === 'user'">
							<div class="message-content">
								<div
									class="message-md"
									v-html="renderMarkdown(message.content)"
								></div>
								<div v-show="message?.content" class="message-actions">
									<el-button
										class="copy-button"
										text
										size="small"
										:icon="DocumentCopy"
										@click="copyMessage(message.content)"
									/>
								</div>
							</div>
							<div class="avatar-wrap">
								<el-avatar :size="messageAvatarSize">
									<img src="/src/assets/avatar.png" />
								</el-avatar>
							</div>
						</template>
					</div>
				</div>
			</el-scrollbar>
			<div
				v-if="!isAtBottom"
				class="scroll-to-bottom-button"
				@click="handleScrollToBottomClick"
			>
				<ElIcon>
					<ArrowDown />
				</ElIcon>
			</div>
			<div ref="bottomDockRef" class="chat-bottom-dock">
				<div
					v-show="suggestedFollowUps.length && !isBusyByState"
					class="suggested-follow-ups"
				>
					<div class="suggested-follow-ups-title">
						<span class="suggested-follow-ups-title-text">
							<el-icon class="suggested-follow-ups-title-icon">
								<ChatLineSquare />
							</el-icon>
							{{ t('ai.suggested.follow.ups') }}
						</span>
					</div>
					<ElScrollbar max-height="88px" class="suggested-follow-ups-scroll">
						<ElSpace wrap size="small">
							<ElTag
								v-for="(text, idx) in suggestedFollowUps"
								:key="idx"
								effect="plain"
								class="suggested-follow-ups-tag"
								@click="sendMessage(text)"
							>
								{{ text }}
							</ElTag>
						</ElSpace>
					</ElScrollbar>
				</div>
				<div
					class="input-area"
					:class="{ 'is-input-editing': isMobile && inputFocused }"
				>
					<ElInput
						ref="chatInputRef"
						v-model="inputMessage"
						class="chat-input"
						:placeholder="t('ai.input.placeholder')"
						type="textarea"
						:autosize="chatInputAutosize"
						:maxlength="32768"
						show-word-limit
						@touchstart.passive="ensureMobileInputExpanded"
						@pointerdown="ensureMobileInputExpanded"
						@focus="onChatInputFocus"
						@blur="onChatInputBlur"
						@keydown="handleKeydown"
						@input="handleInput"
						@keyup="handleKeyup"
					/>
					<ElButton
						:type="isBusyByState ? 'danger' : 'primary'"
						class="chat-button"
						circle
						:disabled="!isBusyByState && !inputMessage?.length"
						@click="isBusyByState ? interruptChat() : sendMessage()"
					>
						<ElIcon v-if="isBusyByState">
							<span class="stop-square"></span>
						</ElIcon>
						<ElIcon v-else>
							<Position />
						</ElIcon>
					</ElButton>
				</div>
			</div>
		</div>
		<ElImageViewer
			v-if="imagePreviewVisible"
			:url-list="imagePreviewUrlList"
			:initial-index="imagePreviewIndex"
			hide-on-click-modal
			@close="closeImagePreview"
		/>
	</div>
</template>

<script setup lang="ts">
import {
	ArrowDown,
	ChatLineSquare,
	DocumentCopy,
	Position,
	Refresh
} from '@element-plus/icons-vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
	ElAvatar,
	ElButton,
	ElIcon,
	ElImageViewer,
	ElInput,
	ElMessage,
	ElScrollbar,
	ElSpace,
	ElTag
} from 'element-plus'
import ChatManage from './chatManage.vue'
import AgentTurnTimeline from './AgentTurnTimeline.vue'
import AgentThinkingBlock from './AgentThinkingBlock.vue'
import {
	AgentUiEventEnvelope,
	ChatRequestDto,
	convertSrcFilesToMd,
	MessageDto
} from '@/types/ai.types'
import { t } from '@ai-system/lib'
import {
	addMessageFeedback,
	chatWebsocketClientApi,
	getHistoryContext,
	getNewContextId,
	getQaTemplate
} from '@/api/ai.api'
import { resolveTurnErrorDisplayText } from './agentTurnError'
import { useAgentEventDispatcher } from './useAgentEventDispatcher'
import {
	MARKDOWN_RENDERER_REVISION,
	renderMarkdown,
	renderMarkdownBlocks
} from '@/utils/markdownRenderer'

const showChatManage = ref(false)
const chatManageRef = ref(null)
/** 聊天主区域根节点，用于写入底部悬浮层高度 CSS 变量 */
const chatViewRef = ref<HTMLElement>()
/** 底部悬浮层（状态 / 推荐追问 / 输入框）容器 */
const bottomDockRef = ref<HTMLElement>()
let bottomDockResizeObserver: ResizeObserver | undefined
/** 监听消息列表高度变化（图片/iframe/图表异步撑高），跟随态下瞬时贴底 */
let messageListResizeObserver: ResizeObserver | undefined
const contextId = ref<string>()
let keepAliveWsClient: WebSocket
const scrollbarRef = ref()
const messageListRef = ref<HTMLElement>()
const isAtBottom = ref<boolean>(true)
/** 用户发送后短暂保持跟滚，直到主动上滑离开底部（与 isAtBottom 配合避免阈值边界误判） */
const stickToBottom = ref(false)
const messageContext = ref<MessageDto[]>([])
/**
 * 仅展示后端标记为可展示的消息；displayInChat === false 的条目仍保留在上下文中，但不渲染气泡。
 */
const visibleMessageContext = computed(() =>
	messageContext.value.filter((m) => m.displayInChat !== false)
)
const inputMessage = ref<string>('')

/** 聊天图片/图表全屏预览是否可见 */
const imagePreviewVisible = ref(false)
/** 当前预览 URL 列表（同条消息内多张图或图表可切换） */
const imagePreviewUrlList = ref<string[]>([])
/** 预览初始下标 */
const imagePreviewIndex = ref(0)
/** 图表预览产生的 blob URL，关闭时需释放 */
const previewBlobUrls = ref<string[]>([])

const isNewLlmResponse = ref<boolean>(true)
const {
	handleAgentEvent,
	recordTerminalState,
	beginOptimisticTurn,
	resetTurnStates,
	currentAgentState,
	isBusyByState,
	isTerminalState,
	suggestedFollowUps,
	clearSuggestedFollowUps
} = useAgentEventDispatcher({
	messageContext,
	isNewLlmResponse,
	sessionContextId: contextId,
	resolveTurnErrorMessage: (errorCode, errorMessage) =>
		resolveTurnErrorDisplayText(errorCode, errorMessage, t),
	onTurnFailure: (displayMessage, raw) => {
		let msg = displayMessage
		if (raw?.errorMessage?.trim()) {
			msg = `${displayMessage}: ${raw.errorMessage.trim()}`
		} else if (raw?.errorCode) {
			msg = `${displayMessage} (${raw.errorCode})`
		}
		ElMessage.error({
			message: msg,
			duration: 6000,
			showClose: true
		})
	}
})

/** 非终态 busy 时当前轮 assistant 在可见列表中的下标。 */
const activeAssistantVisibleIndex = computed(() => {
	if (!isBusyByState.value) {
		return -1
	}
	const list = visibleMessageContext.value
	for (let i = list.length - 1; i >= 0; i--) {
		if (list[i].role === 'assistant') {
			return i
		}
	}
	return -1
})

const isActiveAssistantTurn = (index: number) =>
	index === activeAssistantVisibleIndex.value

const props = defineProps({
	isFullscreen: {
		type: Boolean,
		default: false
	},
	isMobile: {
		type: Boolean,
		default: false
	},
	/** 与 WebSocket agent-id 一致，对应后端 AiAgent#getAgentId */
	agentId: {
		type: String,
		default: 'chat_assistant'
	},
	/** 是否展示热门问题（由 Agent 元数据驱动） */
	showHotQuestions: {
		type: Boolean,
		default: false
	}
})

/** 窄屏缩小消息行头像，与气泡字号更协调 */
const messageAvatarSize = computed(() => (props.isMobile ? 36 : 50))

const chatInputRef = ref<InstanceType<typeof ElInput> | null>(null)
const inputFocused = ref(false)

/** 窄屏高度由 CSS 控制，禁用 autosize，避免 iOS 内联 height 盖过样式 */
const chatInputAutosize = computed(() =>
	props.isMobile ? false : { minRows: 5, maxRows: 10 }
)

const getChatTextareaEl = (): HTMLTextAreaElement | null => {
	const root = chatInputRef.value?.$el as HTMLElement | undefined
	const el = root?.querySelector('.el-textarea__inner')
	return el instanceof HTMLTextAreaElement ? el : null
}

/** 去掉 Element Plus / Safari 残留的内联高度，让 CSS 生效 */
const clearChatTextareaInlineSize = () => {
	const ta = getChatTextareaEl()
	if (!ta) {
		return
	}
	ta.style.removeProperty('height')
	ta.style.removeProperty('min-height')
	ta.style.removeProperty('max-height')
}

const syncMobileInputHeight = () => {
	if (!props.isMobile) {
		return
	}
	nextTick(() => {
		clearChatTextareaInlineSize()
		scheduleChatBottomInsetUpdate()
		requestAnimationFrame(() => {
			clearChatTextareaInlineSize()
			scheduleChatBottomInsetUpdate()
		})
	})
}

/** touchstart / pointerdown 先于 focus，同一击内先标记撑高 */
const ensureMobileInputExpanded = () => {
	if (!props.isMobile || inputFocused.value) {
		return
	}
	inputFocused.value = true
	syncMobileInputHeight()
}

const onChatInputFocus = () => {
	inputFocused.value = true
	syncMobileInputHeight()
}

const onChatInputBlur = () => {
	inputFocused.value = false
	syncMobileInputHeight()
}

let chatWebsocketClient: WebSocket | undefined

/** 拆除 WebSocket 回调，避免旧连接晚到的包在新会话里被处理。 */
const detachChatWebSocket = (ws: WebSocket | undefined) => {
	if (!ws) {
		return
	}
	try {
		ws.onopen = null
		ws.onmessage = null
		ws.onerror = null
		ws.onclose = null
	} catch {
		/* ignore */
	}
	try {
		if (
			ws.readyState === WebSocket.OPEN ||
			ws.readyState === WebSocket.CONNECTING
		) {
			ws.close()
		}
	} catch {
		/* ignore */
	}
}

const sendMessage = (msg?: string) => {
	if (!isBusyByState.value) {
		getNewContextId().then(() => {
			if (msg) {
				inputMessage.value = msg
			}
			if (inputMessage.value.trim()) {
				detachChatWebSocket(chatWebsocketClient)
				chatWebsocketClient = undefined
				clearSuggestedFollowUps()
				const message: MessageDto = {
					index: messageContext.value.length,
					content: inputMessage.value,
					role: 'user'
				}
				messageContext.value.push(message)
				inputMessage.value = ''
				beginOptimisticTurn()
				stickToBottom.value = true
				scrollToBottomAfterMessageFlush()
				const chatRequestDto: ChatRequestDto = {
					contextId: contextId.value,
					messages: [message],
					retrievalKb: true,
					systemPrompt: 'GENERAL_ASSISTANT'
				}
				chatWebsocketClient = chatWebsocketClientApi(
					contextId.value,
					props.agentId
				)
				// 连接打开时的处理
				chatWebsocketClient.onopen = () => {
					chatWebsocketClient.send(JSON.stringify(chatRequestDto))
					isNewLlmResponse.value = false
					scrollToBottom()
				}
				// 接收新消息通知
				chatWebsocketClient.onmessage = (event) => {
					try {
						const payload: AgentUiEventEnvelope = JSON.parse(event.data)
						handleAgentEvent(payload)
						checkScroll()
						if (isAtBottom.value || stickToBottom.value) {
							scrollToBottom()
						}
					} catch (error) {
						console.error('解析Agent事件失败:', error)
					}
				}
				// 错误处理
				chatWebsocketClient.onerror = (error: any) => {
					if (error.responseCode === 401) {
						window.location.assign('/#/login')
					} else if (error.responseCode !== 0) {
						console.error(error)
						ElMessage.error(t('ai.assistant.service.unavailable'))
						isNewLlmResponse.value = true
						recordTerminalState('FAILED')
					}
				}
				// 关闭处理
				chatWebsocketClient.onclose = () => {
					onWsClose()
				}
			}
		})
	} else {
		ElMessage.info(t('ai.assistant.waiting'))
	}
}
const onWsClose = () => {
	if (!isTerminalState.value) {
		recordTerminalState('CANCELLED')
	}
	isNewLlmResponse.value = true
	nextTick(() => {
		detachChatWebSocket(chatWebsocketClient)
		chatWebsocketClient = undefined
		if (
			keepAliveWsClient &&
			keepAliveWsClient.readyState === keepAliveWsClient.OPEN
		) {
			keepAliveWsClient.close()
		}
	})
}

/** 根据视口高度计算“仍在底部”的允许像素余量，避免单条气泡过高导致误判 */
const getScrollBottomEpsilon = (clientHeight: number) =>
	Math.max(160, Math.floor(clientHeight * 0.18))

/** 上一次滚动位置，用于区分「用户主动上滑」与「内容异步撑高」 */
let lastScrollTop = 0
/** 合并多源滚动触发的 rAF 句柄，避免多个平滑动画互相打断造成抽搐 */
let scrollRafId: number | null = null

/**
 * 滚动到底部。
 * - 流式 / 异步撑高场景用 'auto' 瞬时贴底：每次都精确落到「当前实时」底部，消除追逐过时目标导致的抽搐。
 * - 仅用户主动发送消息那一次用 'smooth'。
 * 所有触发合并进单个 rAF，DOM 更新（nextTick 的微任务）后、绘制前执行，能读到最新 scrollHeight。
 */
const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
	if (scrollRafId !== null) {
		cancelAnimationFrame(scrollRafId)
	}
	scrollRafId = requestAnimationFrame(() => {
		scrollRafId = null
		const wrap = scrollbarRef.value?.wrapRef
		if (!wrap) {
			return
		}
		wrap.scrollTo({ top: wrap.scrollHeight, behavior })
		// 程序滚动后同步基准，避免 checkScroll 把这次贴底误判为用户上滑
		lastScrollTop = wrap.scrollTop
	})
}

/** 点击「回到底部」按钮：恢复跟随态并平滑回到底部 */
const handleScrollToBottomClick = () => {
	stickToBottom.value = true
	isAtBottom.value = true
	scrollToBottom('smooth')
}

/** 用户消息入列后等待 DOM / v-html 布局稳定再平滑滚动，避免 scrollHeight 未更新 */
const scrollToBottomAfterMessageFlush = () => {
	nextTick(() => {
		nextTick(() => {
			requestAnimationFrame(() => {
				scrollToBottom('smooth')
			})
		})
	})
}

/** 已闭合的围栏代码块（``` 或 ~~~，含信息行与配对结束行），用于切分稳定段与流式尾段 */
const FENCE_BLOCK_RE = /^([ \t]*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1\2[ \t]*(?:\n|$)/gm

type StreamSegment = { text: string; complete: boolean }

/**
 * 将（流式）消息切分为若干「已完成段」（各自以一个已闭合代码块结尾）加末尾一个「流式尾段」。
 * 已完成段的内容在后续 token 中不再变化，渲染出的字符串恒定 → Vue 不重建其 DOM →
 * 段内 iframe / 图表渲染后保持稳定，既能「围栏一闭合就当场渲染」，又不会逐 token 重载抽搐。
 */
const splitStreamingSegments = (content: string): StreamSegment[] => {
	const segments: StreamSegment[] = []
	let lastIndex = 0
	let match: RegExpExecArray | null
	FENCE_BLOCK_RE.lastIndex = 0
	while ((match = FENCE_BLOCK_RE.exec(content)) !== null) {
		const end = match.index + match[0].length
		segments.push({ text: content.slice(lastIndex, end), complete: true })
		lastIndex = end
	}
	segments.push({ text: content.slice(lastIndex), complete: false })
	return segments
}

const activateMarkdownBlocks = () => {
	nextTick(() => {
		const root = messageListRef.value
		if (!root) {
			return
		}
		renderMarkdownBlocks(root, { deferDiagrams: isBusyByState.value })
			.then(() => {
				if (isAtBottom.value || stickToBottom.value) {
					scrollToBottom()
				}
			})
			.catch((error) => {
				console.error('Markdown图表渲染失败:', error)
			})
	})
}

const checkScroll = () => {
	if (!scrollbarRef.value?.wrapRef) {
		return
	}
	const { scrollTop, scrollHeight, clientHeight } = scrollbarRef.value.wrapRef
	const epsilon = getScrollBottomEpsilon(clientHeight)
	const distFromBottom = scrollHeight - clientHeight - scrollTop
	// 仅当用户主动上滑（scrollTop 明显减小）才解除跟随；
	// 内容异步撑高只增大 distFromBottom 而不减小 scrollTop，不应被误判为离开底部。
	if (scrollTop < lastScrollTop - 2 && distFromBottom > epsilon) {
		stickToBottom.value = false
	}
	// 跟随态下保持按钮隐藏，避免内容撑高的瞬间闪现「回到底部」
	isAtBottom.value = distFromBottom <= epsilon || stickToBottom.value
	lastScrollTop = scrollTop
}

let send: boolean = true

const lastAssistantTurnStepsLength = computed(() => {
	const list = visibleMessageContext.value
	for (let i = list.length - 1; i >= 0; i--) {
		if (list[i].role === 'assistant') {
			return list[i].turnSteps?.length ?? 0
		}
	}
	return 0
})

const handleKeydown = (event: KeyboardEvent) => {
	if (event.key === 'Enter' && !event.shiftKey) {
		send = true
		event.preventDefault()
	}
}

const handleInput = () => {
	send = false
}

const handleKeyup = () => {
	if (send) {
		send = false
		sendMessage()
	}
}

const hotQuestions = ref([])
const getHotQuestions = () => {
	if (!props.showHotQuestions) {
		hotQuestions.value = []
		return
	}
	getQaTemplate(props.agentId).then((res) => {
		hotQuestions.value = res.data.data
	})
}
const clickHotQuestion = (msg) => {
	sendMessage(msg)
}

const handleMsgFeedback = (type, message?) => {
	message.feedback = type
	addMessageFeedback({
		contextId: contextId.value,
		agentId: props.agentId,
		index: message.index,
		feedback: type // 用户反馈: 0: 无, 1: 赞, 2: 踩
	}).then((res) => {
		if (type === 1) {
			ElMessage({
				message: '😊',
				type: 'info'
			})
		}
		if (type === 2) {
			ElMessage({
				message: '😭',
				type: 'info'
			})
		}
	})
}

const fallbackCopyText = (text: string) => {
	const textarea = document.createElement('textarea')
	textarea.value = text
	textarea.setAttribute('readonly', 'true')
	textarea.style.position = 'absolute'
	textarea.style.left = '-9999px'
	document.body.appendChild(textarea)
	textarea.select()
	document.execCommand('copy')
	document.body.removeChild(textarea)
}

/** 释放图表预览占用的 blob URL */
const revokePreviewBlobUrls = () => {
	previewBlobUrls.value.forEach((url) => URL.revokeObjectURL(url))
	previewBlobUrls.value = []
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** 为预览用 SVG 铺一层白色底，避免全屏查看时透明区域发灰/发黑 */
const appendSvgWhiteBackground = (svg: SVGElement) => {
	const viewBox = svg.viewBox?.baseVal
	let x = 0
	let y = 0
	let width = 800
	let height = 600
	if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
		x = viewBox.x
		y = viewBox.y
		width = viewBox.width
		height = viewBox.height
	} else {
		const attrW = Number.parseFloat(svg.getAttribute('width') || '')
		const attrH = Number.parseFloat(svg.getAttribute('height') || '')
		if (!Number.isNaN(attrW) && attrW > 0) {
			width = attrW
		}
		if (!Number.isNaN(attrH) && attrH > 0) {
			height = attrH
		}
	}
	const rect = document.createElementNS(SVG_NS, 'rect')
	rect.setAttribute('x', String(x))
	rect.setAttribute('y', String(y))
	rect.setAttribute('width', String(width))
	rect.setAttribute('height', String(height))
	rect.setAttribute('fill', '#ffffff')
	svg.insertBefore(rect, svg.firstChild)
}

/**
 * 将消息内 SVG 图表转为可预览的 blob URL（全屏显示时去掉缩放 transform）。
 */
const svgElementToPreviewUrl = (svg: SVGElement) => {
	const clone = svg.cloneNode(true) as SVGElement
	clone.style.transform = ''
	clone.style.maxWidth = ''
	clone.style.maxHeight = ''
	const viewBox = svg.viewBox?.baseVal
	if (viewBox?.width > 0 && viewBox?.height > 0) {
		clone.setAttribute('width', String(viewBox.width))
		clone.setAttribute('height', String(viewBox.height))
	} else {
		clone.removeAttribute('height')
	}
	appendSvgWhiteBackground(clone)
	const serialized = new XMLSerializer().serializeToString(clone)
	const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
	const url = URL.createObjectURL(blob)
	previewBlobUrls.value.push(url)
	return url
}

/**
 * 点击消息气泡内 Markdown 图片时，收集同气泡全部图片并打开全屏预览。
 */
const openMessageImagePreview = (
	messageContent: Element,
	targetImg: HTMLImageElement
) => {
	const imgs = messageContent.querySelectorAll('img')
	const urlList: string[] = []
	let index = 0
	imgs.forEach((el) => {
		const src = (el as HTMLImageElement).src?.trim()
		if (!src) {
			return
		}
		if (el === targetImg) {
			index = urlList.length
		}
		urlList.push(src)
	})
	if (!urlList.length) {
		return
	}
	revokePreviewBlobUrls()
	imagePreviewUrlList.value = urlList
	imagePreviewIndex.value = index
	imagePreviewVisible.value = true
}

/**
 * 点击消息气泡内 Mermaid/PlantUML/Vega-Lite 图表时，收集同气泡全部图表并打开全屏预览。
 */
const openMessageDiagramPreview = (
	messageContent: Element,
	targetSvg: SVGElement
) => {
	revokePreviewBlobUrls()
	const svgs = messageContent.querySelectorAll(
		'.md-diagram:not(.md-diagram-error) .md-diagram-body svg'
	)
	const urlList: string[] = []
	let index = 0
	svgs.forEach((el) => {
		if (!(el instanceof SVGElement)) {
			return
		}
		if (el === targetSvg) {
			index = urlList.length
		}
		urlList.push(svgElementToPreviewUrl(el))
	})
	if (!urlList.length) {
		revokePreviewBlobUrls()
		return
	}
	imagePreviewUrlList.value = urlList
	imagePreviewIndex.value = index
	imagePreviewVisible.value = true
}

/**
 * 点击消息气泡内图片或图表，打开全屏预览（与 ElImageViewer 一致）。
 */
const handleMessageMediaClick = (event: MouseEvent) => {
	const target = event.target
	if (!(target instanceof Element)) {
		return
	}
	const messageContent = target.closest('.message-md, .message-content')
	if (!messageContent) {
		return
	}

	if (target instanceof HTMLImageElement) {
		openMessageImagePreview(messageContent, target)
		return
	}

	const diagramBody = target.closest('.md-diagram-body')
	if (!diagramBody || diagramBody.closest('.md-diagram-error')) {
		return
	}
	const svg = diagramBody.querySelector('svg')
	if (!(svg instanceof SVGElement)) {
		return
	}
	openMessageDiagramPreview(messageContent, svg)
}

/** 关闭聊天图片/图表全屏预览 */
const closeImagePreview = () => {
	imagePreviewVisible.value = false
	revokePreviewBlobUrls()
}

const copyMessage = async (content?: string) => {
	if (!content) {
		return
	}
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(content)
		} else {
			fallbackCopyText(content)
		}
		ElMessage.success('复制成功')
	} catch (error) {
		try {
			fallbackCopyText(content)
			ElMessage.success('复制成功')
		} catch (fallbackError) {
			console.error('复制失败:', error, fallbackError)
			ElMessage.error('复制失败')
		}
	}
}

const newChat = () => {
	interruptChat()
	// 先使当前会话 ID 失效，避免旧连接迟到的 NOTICE 仍与「当前会话」匹配
	contextId.value = undefined
	resetTurnStates()
	inputMessage.value = ''
	messageContext.value = []
	isAtBottom.value = true
	stickToBottom.value = false
	lastScrollTop = 0
	getNewContextId().then((contextIdDto) => {
		contextId.value = contextIdDto.data.contextId
	})
	getHotQuestions()
	scrollToBottom()
}

/** 切换智能体时重置会话，避免沿用上一次的上下文与连接 */
watch(
	() => props.agentId,
	() => {
		newChat()
	}
)

/** Agent 元数据异步到达后补拉热门问题 */
watch(
	() => props.showHotQuestions,
	(enabled) => {
		if (enabled) {
			getHotQuestions()
		} else {
			hotQuestions.value = []
		}
	}
)

/**
 * 监听消息列表的高度变化：图片 / iframe / 图表等高度不定的元素是异步、分多帧确定高度的，
 * 任何一次撑高都会移动「底部」位置。处于跟随态时立即瞬时贴底，从根上消除「追逐过时目标」造成的抽搐。
 */
watch(messageListRef, (el) => {
	messageListResizeObserver?.disconnect()
	messageListResizeObserver = undefined
	if (el && typeof ResizeObserver !== 'undefined') {
		messageListResizeObserver = new ResizeObserver(() => {
			if (stickToBottom.value || isAtBottom.value) {
				scrollToBottom('auto')
			}
		})
		messageListResizeObserver.observe(el)
	}
})

watch(
	messageContext,
	() => {
		activateMarkdownBlocks()
	},
	{ deep: true, flush: 'post' }
)

/** 流式结束但 content 不再变化时，补渲染推迟的 mermaid/plantuml/vegalite/html 块 */
watch(isBusyByState, () => {
	activateMarkdownBlocks()
})

const historyChat = (historyId) => {
	interruptChat()
	const previousContextId = contextId.value
	contextId.value = undefined
	resetTurnStates()
	inputMessage.value = ''
	stickToBottom.value = false
	if (historyId !== previousContextId) {
		chatManageRef.value.getHistoryListData()
	}
	contextId.value = historyId
	getHistoryContext(historyId, props.agentId).then((res) => {
		messageContext.value = res.data.messages
		scrollToBottom()
	})
}

// 中止正在进行的对话
const interruptChat = () => {
	if (isBusyByState.value) {
		recordTerminalState('CANCELLED')
	}
	isNewLlmResponse.value = true
	detachChatWebSocket(chatWebsocketClient)
	chatWebsocketClient = undefined
	if (
		keepAliveWsClient &&
		keepAliveWsClient.readyState === keepAliveWsClient.OPEN
	) {
		keepAliveWsClient.close()
	}
}

/**
 * 根据底部悬浮层实际高度更新滚动区内边距，避免最后几条气泡被遮挡。
 */
const updateChatBottomInset = () => {
	const dockEl = bottomDockRef.value
	const viewEl = chatViewRef.value
	if (!dockEl || !viewEl) {
		return
	}
	const height = Math.ceil(dockEl.getBoundingClientRect().height)
	viewEl.style.setProperty('--chat-bottom-inset', `${height}px`)
}

/** 在 DOM 更新后重新测量底部悬浮层高度 */
const scheduleChatBottomInsetUpdate = () => {
	nextTick(() => {
		updateChatBottomInset()
	})
}

watch(inputFocused, () => {
	if (props.isMobile) {
		syncMobileInputHeight()
		return
	}
	nextTick(() => {
		chatInputRef.value?.resizeTextarea?.()
		scheduleChatBottomInsetUpdate()
	})
})

onMounted(() => {
	newChat()
	nextTick(() => {
		scheduleChatBottomInsetUpdate()
		if (typeof ResizeObserver !== 'undefined' && bottomDockRef.value) {
			bottomDockResizeObserver = new ResizeObserver(() => {
				updateChatBottomInset()
			})
			bottomDockResizeObserver.observe(bottomDockRef.value)
		}
	})
})

onUnmounted(() => {
	bottomDockResizeObserver?.disconnect()
	bottomDockResizeObserver = undefined
	messageListResizeObserver?.disconnect()
	messageListResizeObserver = undefined
	if (scrollRafId !== null) {
		cancelAnimationFrame(scrollRafId)
		scrollRafId = null
	}
	interruptChat()
	revokePreviewBlobUrls()
})

watch(
	() => [
		lastAssistantTurnStepsLength.value,
		suggestedFollowUps.value.length,
		isBusyByState.value
	],
	() => {
		scheduleChatBottomInsetUpdate()
	}
)

defineExpose({
	showChatManage,
	chatManageRef,
	isBusyByState,
	getHistoryListData: () => chatManageRef.value.getHistoryListData(),
	newChat
})
</script>
<style scoped lang="scss">
@use '@/styles/platform' as *;

/* 聊天气泡：水晶染色 + 细棱线；$with-black-shadow 控制是否带黑色外投影 */
@mixin chat-bubble-crystal-glass($pale, $vivid, $deep, $blur, $with-black-shadow: true) {
	background: color-mix(
		in srgb,
		color-mix(in srgb, #fff 34%, transparent),
		color-mix(in srgb, $vivid 52%, transparent)
	);
	backdrop-filter: blur($blur) saturate(195%);
	-webkit-backdrop-filter: blur($blur) saturate(195%);
	border: none;
	@if $with-black-shadow {
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, $pale 82%, transparent),
			inset 0 -1px 0 color-mix(in srgb, $deep 48%, transparent),
			0 6px 18px rgba(0, 0, 0, 0.16),
			0 14px 36px rgba(0, 0, 0, 0.12);
	} @else {
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, $pale 82%, transparent),
			inset 0 -1px 0 color-mix(in srgb, $deep 35%, transparent);
	}
	isolation: isolate;
}

.chat-container {
	/* 与左侧历史栏 padding-bottom 共用，保证输入框底边对齐 */
	--chat-side-gutter: 20px;
	height: 100%;
	display: flex;
	flex-direction: column;
	position: relative;

	&.fullscreen {
		flex-direction: row;
		align-items: stretch;

		:deep(.chat-manage) {
			align-self: stretch;
			height: 100%;
			flex-shrink: 0;
		}

		.chat-manage-view {
			width: 320px;
			max-width: 320px;
			height: 100%;

			:deep(.chat-list) {
				height: 100% !important;
				max-height: 100% !important;
			}
		}

		.chat-view {
			flex-grow: 1;
			width: 100%;
		}
	}

	/* 窄屏：仅呼出历史时显示全屏遮罩（勿对容器写 display:!important，否则会盖掉 v-show） */
	&.is-mobile {
		flex: 1;
		min-height: 0;
		height: 100%;

		&.is-history-open {
			:deep(.chat-manage-container) {
				position: fixed;
				top: 0;
				right: 0;
				bottom: 0;
				left: 0;
				z-index: 30;
				display: flex;
				align-items: center;
				justify-content: center;
				width: 100%;
				max-width: none;
				min-width: 0;
				margin: 0;
				/* 覆盖桌面侧栏 padding-top:70px；顶栏高度用 padding 顶出内容区，遮罩背景铺满无白条 */
				padding: var(--n-topbar-height, 50px) 0 0 !important;
				height: auto;
				max-height: none;
				overflow: hidden;
				box-sizing: border-box;
				background: color-mix(in srgb, var(--n-color-neutral-b) 32%, transparent);
			}

			:deep(.chat-manage-card) {
				width: 70%;
				max-width: 70%;
				height: min(82vh, 100%);
				max-height: 82vh;
				flex: 0 1 auto;
				margin: 0;
				padding: 16px;
				overflow: hidden;
			}

			:deep(.chat-list) {
				flex: 1;
				min-height: 0;
			}
		}

		--chat-side-gutter: 12px;
		--chat-content-h-pad: 16px;
		--chat-init-top-gap: 80px;
		--chat-hot-questions-width: 80%;

		.chat-view {
			padding: var(--n-padding-basic) var(--chat-content-h-pad) 0;
			padding-bottom: 0;

			.chat-bottom-dock {
				left: var(--chat-content-h-pad);
				right: var(--chat-content-h-pad);
			}
		}

		.ai-logo {
			width: 72px;
		}

		.ai-logo-emoji {
			font-size: 64px;
		}

		.message-init {
			align-items: center;
			width: 100%;
			max-width: 100%;
			box-sizing: border-box;
			margin-top: var(--chat-init-top-gap);
			padding: 16px 0;

			.title {
				font-size: 17px;
				margin-top: 16px;
			}

			.hot-questions {
				align-self: center;
				min-width: 0;
				width: var(--chat-hot-questions-width);
				max-width: var(--chat-hot-questions-width);
				margin-top: 20px;
				padding: 16px 18px;
				font-size: var(--n-font-size-1);

				.hot-questions-title {
					margin-bottom: 12px;
				}

				.question-list .question {
					margin-bottom: 12px;

					.qa {
						margin-right: 8px;
					}
				}
			}
		}

		.message-list {
			--chat-message-gap: 28px;
			padding: 16px 0;

			.message-row {
				margin: 0;

				.message-content {
					padding: 10px 12px;
					min-height: 40px;
					font-size: var(--n-font-size-1);
				}

				&.assistant .message-content .assistant-answer {
					font-size: var(--n-font-size-1);
				}

				&.assistant .message-content .src-file {
					font-size: 11px;
				}
			}

			.message-row + .message-row {
				margin-top: var(--chat-message-gap);
			}
		}

		.message-list {
			--chat-message-avatar-size: 36px;
			--chat-message-avatar-margin: 6px;
		}

		.avatar-emoji {
			font-size: 22px;
		}

		.suggested-follow-ups {
			padding: 10px 12px 8px;
		}

		.suggested-follow-ups-title-text {
			font-size: 12px;
		}

		.suggested-follow-ups-title-icon {
			font-size: 14px;
		}

		.suggested-follow-ups :deep(.el-tag.suggested-follow-ups-tag) {
			font-size: var(--n-font-size-1);
			padding: 4px 10px;
		}

		/* 窄屏：平时矮框，聚焦加高；发送钮仍在输入框内右下角 */
		.input-area .el-textarea.chat-input {
			--chat-input-pad-y: 12px;
			--chat-input-pad-x: 16px;
			--chat-input-pad-end: 48px;

			:deep(.el-textarea__inner) {
				box-sizing: border-box;
				padding: var(--chat-input-pad-y) var(--chat-input-pad-end)
					var(--chat-input-pad-y) var(--chat-input-pad-x);
				line-height: 1.5;
				font-size: var(--n-font-size-2);
				transition:
					min-height 0.2s ease,
					height 0.2s ease,
					max-height 0.2s ease;
			}

			:deep(.el-textarea__inner::placeholder) {
				line-height: 1.5;
				color: var(--n-color-text-placeholder);
			}
		}

		.input-area:not(.is-input-editing) .el-textarea.chat-input {
			:deep(.el-textarea__inner) {
				min-height: 58px;
				height: 58px !important;
				max-height: 58px;
				overflow-y: hidden;
			}

			:deep(.el-input__count) {
				bottom: 12px;
			}
		}

		.input-area.is-input-editing .el-textarea.chat-input {
			--chat-input-pad-y: 14px;

			:deep(.el-textarea__inner) {
				min-height: 148px;
				height: 148px !important;
				max-height: 148px;
				overflow-y: auto;
			}

			:deep(.el-input__count) {
				bottom: 14px;
			}
		}

		.input-area .el-button.chat-button {
			right: 12px;
			bottom: 13px;
		}

		.input-area.is-input-editing .el-button.chat-button {
			bottom: 14px;
		}
	}

	.chat-view {
		--chat-bottom-inset: 200px;
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: center;
		height: 100%;
		min-height: 0;
		overflow: visible;
		padding: calc(2 * var(--n-padding-basic));
		padding-bottom: 0;

		.scroll {
			flex: 1;
			height: 100%;
			min-height: 0;
			overflow: hidden;

			:deep(.el-scrollbar__view) {
				padding-bottom: calc(var(--chat-bottom-inset, 200px) + 12px);
			}
		}

		.chat-bottom-dock {
			position: absolute;
			/* 对齐 content 区；底边与左侧历史栏卡片底边同一水平线 */
			left: calc(2 * var(--n-padding-basic));
			right: calc(2 * var(--n-padding-basic));
			bottom: var(--chat-side-gutter);
			z-index: 10;
			display: flex;
			flex-direction: column;
			gap: 10px;
			pointer-events: none;

			> * {
				pointer-events: auto;
			}
		}
	}
}

.ai-logo {
	width: 100px; // 固定宽度
	margin: 0 auto;

	img {
		width: 100%;
		height: 100%;
		object-fit: contain; // 保持图片比例
	}
}

.ai-logo-emoji {
	display: block;
	font-size: 100px;
	line-height: 1;
}

.avatar-emoji {
	display: block;
	font-size: 30px;
	margin: auto;
	line-height: 1;
}

.message-init {
	text-align: center;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	// margin: 20px auto;
	// width: 380px;
	margin-top: 60px;
	padding: 20px 0;

	.title {
		font-size: 20px;
		color: var(--n-color-text-primary);
		margin-top: 20px;
	}

	.sub-tip {
		font-size: 18px;
		color: var(--n-color-text-muted);
		line-height: 1.5;
		display: block;
		// width: 280px;
		margin: 20px 0 30px;
	}

	.hot-questions {
		display: flex;
		margin-top: 20px;
		flex-direction: column;
		@include n-glass-surface(2);
		box-shadow: 0 0 12px rgba(0, 0, 0, 0.08);
		border-radius: var(--n-radius-quadruple);
		color: var(--n-color-text-primary);
		min-width: 350px;
		max-width: 450px;
		padding: 20px;
		max-height: 300px;
		min-height: 160px;
		overflow: auto;

		.hot-questions-title {
			justify-content: space-between;
			margin-bottom: 15px;

			strong {
				.el-icon {
					margin-right: 2px;
				}
			}

			.change {
				cursor: pointer;
				display: flex;
				justify-content: center;
				align-items: center;

				&:hover {
					color: var(--el-color-primary);
				}
			}
		}

		.question-list {
			flex-direction: column;
			justify-content: center;

			.question {
				display: flex;
				align-items: flex-start;
				margin-bottom: 15px;
				cursor: pointer;
				line-height: 1.5;
				text-align: left;
				white-space: normal;
				word-break: break-word;
				overflow-wrap: anywhere;
				width: 100%;

				&:hover {
					color: var(--el-color-primary);
				}

				.qa {
					flex-shrink: 0;
					margin-right: 10px;
					height: 20px;
					line-height: 20px;
					color: var(--el-color-primary);
					font-style: italic;
					background-color: var(--el-color-primary-light-9);
					display: inline-block;
					padding: 0 4px 0 4px;
					border-radius: 15px;
				}

				&:last-child {
					margin-bottom: 0;
				}
			}
		}
	}
}

.message-list {
	/* 左右各一列头像区，气泡远侧边界对齐对侧头像近边 */
	--chat-message-avatar-size: 50px;
	--chat-message-avatar-margin: 10px;
	--chat-message-avatar-col: calc(
		var(--chat-message-avatar-size) + 2 * var(--chat-message-avatar-margin)
	);
	--chat-message-gap: 28px;
	padding: 24px 0;

	.message-row {
		margin: 0;
		display: grid;
		grid-template-columns:
			var(--chat-message-avatar-col)
			minmax(0, 1fr)
			var(--chat-message-avatar-col);
		align-items: start;

		.message-content {
			padding: 14px 16px 14px;
			border-radius: 15px;
			height: 100%;
			min-height: 48px;
			font-size: var(--n-font-size-2);
			word-wrap: break-word;
			word-break: break-all;
			justify-content: center;
			display: flex;
			flex-direction: column;
			color: var(--n-color-text-primary);
		}

		.message-md :deep(p),
		.message-md :deep(li),
		.message-md :deep(strong),
		.message-md :deep(em),
		.message-md :deep(h1),
		.message-md :deep(h2),
		.message-md :deep(h3),
		.message-md :deep(h4),
		.message-md :deep(h5),
		.message-md :deep(h6),
		.message-md :deep(th),
		.message-md :deep(td) {
			color: inherit;
		}

		.message-md :deep(a) {
			color: var(--n-color-link);
		}

		.message-md :deep(pre),
		.message-md :deep(pre *) {
			color: var(--n-dark-panel-text);
		}

		.message-md :deep(pre code) {
			color: var(--n-dark-panel-text);
		}

		.message-md :deep(.md-diagram-body),
		.message-md :deep(.md-diagram-body *) {
			color: var(--n-color-diagram-text);
		}

		.message-md :deep(img) {
			max-width: 100%;
			height: auto;
			display: block;
			cursor: pointer;
			border-radius: 6px;
			transition: opacity 0.2s ease;
		}

		.message-md :deep(img:hover) {
			opacity: 0.92;
		}

		.message-md :deep(.md-diagram:not(.md-diagram-error) .md-diagram-body) {
			cursor: pointer;
			border-radius: 6px;
			transition: opacity 0.2s ease;
		}

		.message-md
			:deep(.md-diagram:not(.md-diagram-error) .md-diagram-body:hover) {
			opacity: 0.92;
		}

		&.assistant {
			.avatar-wrap {
				grid-column: 1;
				grid-row: 1;
			}

			.message-bubble-wrap {
				grid-column: 2;
				grid-row: 1;
				justify-self: start;
				max-width: 100%;
				min-width: 0;
			}

			/* 助手气泡：柔和暖灰水晶（低饱和、护眼） */
			.message-content {
				@include chat-bubble-crystal-glass(
					#f2f1ef,
					color-mix(in srgb, #f2f1ef 70%, transparent),
					color-mix(in srgb, #969088 88%, transparent),
					8px
				);

				:deep(.agent-thinking-block) {
					margin-bottom: 10px;
				}

				.assistant-answer {
					font-size: var(--n-font-size-2);
					color: inherit;
				}

				/* 流式分段仅为渲染稳定性服务，不应产生额外盒子/间距 */
				.assistant-stream-segment {
					display: contents;
				}

				.src-file {
					margin-top: 15px;
					font-style: italic;
					font-size: var(--n-font-size-1);
				}

				.message-actions {
					display: flex;
					justify-content: flex-end;
					align-items: center;
					gap: 8px;
					margin-top: 10px;

					.copy-button {
						padding: 0;
					}
				}

				.support {
					text-align: right;

					.feedback-icon-good {
						cursor: pointer;

						&:last-child {
							margin-right: 0;
						}

						&:hover,
						&.good {
							text-shadow: 0px 0px 10px var(--el-color-success);
						}
					}

					.feedback-icon-bad {
						cursor: pointer;

						&:last-child {
							margin-right: 0;
						}

						&:hover,
						&.bad {
							text-shadow: 0px 0px 10px var(--el-color-error);
						}
					}
				}
			}

			/* 思考态外围光晕：下方变量可调；双伪元素透明度交替，避免插值发黑 */
			.message-bubble-wrap.thinking-bubble {
				--think-glow-orange: rgba(255, 147, 68, 0.85);
				--think-glow-blue: rgba(64, 158, 255, 0.85);
				--think-glow-blur: 18px;
				--think-glow-spread: 6px;
				--think-glow-duration: 1.4s;
				overflow: visible;
			}

			.message-bubble-wrap.thinking-bubble .message-content {
				position: relative;
				z-index: 0;
				overflow: visible;

				@include chat-bubble-crystal-glass(
					#f2f1ef,
					color-mix(in srgb, #f2f1ef 70%, transparent),
					color-mix(in srgb, #969088 88%, transparent),
					10px,
					false
				);

				&::before,
				&::after {
					content: '';
					position: absolute;
					inset: 0;
					border-radius: inherit;
					pointer-events: none;
					z-index: -1;
					box-shadow: 0 0 var(--think-glow-blur) var(--think-glow-spread)
						currentColor;
				}

				&::before {
					color: var(--think-glow-orange);
					animation: think-glow-orange var(--think-glow-duration) ease-in-out
						infinite;
				}

				&::after {
					color: var(--think-glow-blue);
					animation: think-glow-blue var(--think-glow-duration) ease-in-out
						infinite;
				}
			}

			.message-bubble-wrap.thinking-bubble .message-content:hover {
				transform: none;
			}
		}

		&.user {
			.avatar-wrap {
				grid-column: 3;
				grid-row: 1;
			}

			/* 用户气泡：天蓝水晶染色 */
			.message-content {
				grid-column: 2;
				grid-row: 1;
				justify-self: end;
				max-width: 100%;
				min-width: 0;
				@include chat-bubble-crystal-glass(
					#d8f0ff,
					color-mix(in srgb, #5cadf2 86%, transparent),
					color-mix(in srgb, #3896d9 92%, transparent),
					10px
				);

				.message-actions {
					display: flex;
					justify-content: flex-end;
					margin-top: 10px;

					.copy-button {
						padding: 0;
					}
				}
			}
		}
	}

	.message-row + .message-row {
		margin-top: var(--chat-message-gap);
	}
}

.input-area {
	overflow: visible;
	display: flex;
	padding: 0;
	border-radius: 15px;
	position: relative;

	.el-textarea {
		&.chat-input {
			overflow: visible;

			:deep(.el-input__count) {
				right: 60px;
				bottom: 16px;
				z-index: 2;
				padding: 2px 8px;
				border-radius: 8px;
				line-height: 1.4;
				@include n-glass-surface(1);
			}

			:deep(.el-textarea__inner) {
				@include n-glass-surface(2);
				box-sizing: border-box;
				padding: 15px 48px 15px 20px;
				line-height: 1.5;
				font-size: var(--n-font-size-2);
				border-radius: 15px;
				word-wrap: break-word;
				word-break: break-all;
				border: none !important;
				outline: none;
				box-shadow: 0 0 12px rgba(0, 0, 0, 0.08);
				transition: box-shadow 0.2s ease;
			}

			:deep(.el-textarea__inner::placeholder) {
				line-height: 1.5;
				color: var(--n-color-text-placeholder);
			}

			:deep(.el-textarea__inner:focus) {
				box-shadow:
					0 0 10px color-mix(in srgb, var(--el-color-primary) 30%, transparent),
					0 0 24px color-mix(in srgb, var(--el-color-primary) 14%, transparent);
			}
		}
	}

	.el-button.chat-button {
		position: absolute;
		right: 20px;
		bottom: 15px;
		z-index: 2;
		border: none;
		@include n-glass-surface(1);

		&.el-button--primary:not(.is-disabled) {
			background: var(--el-color-primary);
		}

		&.el-button--danger:not(.is-disabled) {
			background: var(--el-color-danger);
		}

		&.is-disabled {
			opacity: 1;
			cursor: not-allowed;
			--chat-btn-disabled-tint: var(--el-color-primary);
			background: color-mix(
				in srgb,
				var(--chat-btn-disabled-tint) 22%,
				var(--n-color-bg-glass-strong)
			) !important;
			color: color-mix(
				in srgb,
				var(--chat-btn-disabled-tint) 78%,
				var(--n-color-text-muted)
			) !important;

			&.el-button--danger {
				--chat-btn-disabled-tint: var(--el-color-danger);
			}

			:deep(.el-icon) {
				color: inherit;
			}
		}
	}

	.stop-square {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 2px;
		background-color: currentColor;
	}
}

.suggested-follow-ups {
	align-self: stretch;
	width: 100%;
	max-width: 100%;
	margin: 0;
	padding: 14px 16px 12px;
	border-radius: var(--n-radius-quadruple);
	@include n-glass-surface(2);
	color: var(--n-color-text-primary);
}

.suggested-follow-ups-title {
	margin-bottom: 10px;
}

.suggested-follow-ups-title-text {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 13px;
	font-weight: 600;
	color: var(--n-color-text-primary);
	letter-spacing: 0.02em;
}

.suggested-follow-ups-title-icon {
	font-size: 16px;
	color: var(--el-color-primary);
	flex-shrink: 0;
}

.suggested-follow-ups-scroll {
	width: 100%;

	:deep(.el-scrollbar__bar) {
		&.is-horizontal {
			height: 5px;
		}
	}
}

.suggested-follow-ups :deep(.el-tag.suggested-follow-ups-tag) {
	cursor: pointer;
	max-width: 100%;
	white-space: normal;
	height: auto;
	line-height: 1.4;
	padding: 6px 12px;
	border-radius: 999px;
	font-weight: 500;
	color: var(--n-color-text-primary);
	@include n-glass-surface(1);
	transition:
		color 0.2s ease,
		border-color 0.2s ease,
		background 0.2s ease,
		box-shadow 0.2s ease,
		transform 0.15s ease;
}

.suggested-follow-ups :deep(.el-tag.suggested-follow-ups-tag:hover) {
	color: var(--el-color-primary);
	border-color: color-mix(in srgb, var(--el-color-primary), transparent 45%);
	background: color-mix(
		in srgb,
		var(--el-color-primary-light-8),
		transparent 35%
	);
	box-shadow: var(--n-shadow-card);
	transform: translateY(-1px);
}

// 思考光晕：只动画 opacity，橙蓝叠化（中间不会插值出黑影）
@keyframes think-glow-orange {
	0%,
	100% {
		opacity: 1;
	}
	50% {
		opacity: 0;
	}
}

@keyframes think-glow-blue {
	0%,
	100% {
		opacity: 0;
	}
	50% {
		opacity: 1;
	}
}

.avatar-wrap {
	margin: 0 var(--chat-message-avatar-margin, 10px);

	.el-avatar {
		margin: 0;
		flex-shrink: 0;
		width: var(--chat-message-avatar-size, 50px);
		height: var(--chat-message-avatar-size, 50px);

		:deep(img) {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.ai-chat-logo {
		background-color: #3b3b3b;

		img {
			width: 100%;
			height: 100%;
			object-fit: contain; // 保持图片比例
		}
	}
}

.chat-view .scroll-to-bottom-button {
	position: absolute;
	bottom: calc(
		var(--chat-bottom-inset, 200px) + 12px + var(--chat-side-gutter, 20px)
	);
	left: 50%;
	z-index: 11;
	transform: translateX(-50%);
	background: color-mix(in srgb, var(--n-color-neutral-w), transparent 80%);
	border: 1px solid rgba(255, 255, 255, 0.18);
	box-shadow: 0 4px 12px 0 rgba(31, 38, 135, 0.1);
	backdrop-filter: blur(2px);
	-webkit-backdrop-filter: blur(2px);
	border-radius: 50%;
	padding: 13px;
	cursor: pointer;
	pointer-events: auto;
	transition: all 0.3s ease;
}

.chat-view .scroll-to-bottom-button:hover {
	background: color-mix(in srgb, var(--n-color-neutral-4), transparent 50%);
	backdrop-filter: blur(5px);
	-webkit-backdrop-filter: blur(5px);
	box-shadow: 0 6px 16px 0 rgb(112 112 112 / 0.2);
	transform: translateX(-50%) scale(1.2);
}

/* 与 layout.ts：总宽 < 3×聊天记录栏(340px) 时窄屏，媒体查询上界 1019px */
@media only screen and (max-width: 1019px) {
	.chat-container:not(.is-mobile) .chat-view {
		padding-left: var(--chat-content-h-pad, 16px);
		padding-right: var(--chat-content-h-pad, 16px);
	}

	.chat-container:not(.is-mobile) .message-init {
		margin-top: var(--chat-init-top-gap, 80px);

		.hot-questions {
			align-self: center;
			min-width: 0;
			width: var(--chat-hot-questions-width, 80%);
			max-width: var(--chat-hot-questions-width, 80%);
		}
	}
}

/* 手机设备样式 */
@media only screen and (max-width: 600px) {
	.chat-container.is-mobile {
		--chat-content-h-pad: 14px;
		--chat-init-top-gap: 64px;

		.ai-logo {
			width: 60px;
		}

		.ai-logo-emoji {
			font-size: 52px;
		}

		.message-init {
			padding: 14px 0;

			.title {
				font-size: 16px;
				margin-top: 14px;
			}

			.hot-questions {
				padding: 14px 16px;
			}
		}

		.message-init .sub-tip {
			font-size: 14px;
		}
	}
}
</style>
