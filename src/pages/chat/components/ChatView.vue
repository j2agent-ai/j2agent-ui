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
            <img v-if="chatLogoUrl" :src="chatLogoUrl" alt="" />
            <span v-else class="ai-logo-emoji">{{ effectiveChatLogo }}</span>
          </div>
          <h2 class="title">{{ assistantGreeting }}</h2>
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
            v-for="message in visibleMessageContext"
            :key="`${contextId}-${message.index}`"
            class="message-row"
            :class="[message.role]"
            :data-message-index="message.index"
          >
            <template v-if="message.role === 'assistant'">
              <div class="avatar-wrap">
                <el-avatar :size="messageAvatarSize" class="ai-chat-logo">
                  <img v-if="chatLogoUrl" :src="chatLogoUrl" alt="" />
                  <span v-else class="avatar-emoji">{{ effectiveChatLogo }}</span>
                </el-avatar>
              </div>
              <div
                class="message-bubble-wrap"
                :class="{
									'thinking-bubble':
										isActiveAssistantTurn(message.index) && isActiveContextStreaming
								}"
              >
                <div class="message-content">
                  <AgentThinkingBlock
                    v-if="message.reasoningContent?.trim()"
                    :content="message.reasoningContent"
                    :active="isActiveAssistantTurn(message.index) && isBusyByState"
                  />
                  <div
                    v-if="message.content"
                    :key="`assistant-md-${message.index}-${MARKDOWN_RENDERER_REVISION}`"
                    class="assistant-answer message-md"
                  >
                    <div
                      v-for="(seg, segIdx) in assistantRenderedSegments.get(
                        message.index
                      ) ?? []"
                      :key="segIdx"
                      class="assistant-stream-segment"
                      :data-md-stream-tail="
												isActiveAssistantTurn(message.index) &&
												!seg.complete &&
												isBusyByState
													? ''
													: null
											"
                    >
                      <div
                        v-if="
                          isActiveAssistantTurn(message.index) &&
                          !seg.complete &&
                          isBusyByState
                        "
                        :ref="bindActiveTailSegmentRef"
                      />
                      <div
                        v-else
                        v-html="seg.html"
                      />
                    </div>
                  </div>
                  <div
                    v-show="message.srcFile && message.srcFile.length > 0"
                    class="src-file message-md"
                  >
                    <br />
                    <p>
                      {{ $t('ai.source') }}
                    </p>
                    <ul class="src-file-list">
                      <li
                        v-for="(file, fileIndex) in message.srcFile"
                        :key="`${file.url}-${fileIndex}`"
                      >
                        <button
                          v-if="isSrcMarkdownFile(file)"
                          type="button"
                          class="src-file-link src-file-link--button"
                          @click="openSrcFilePreview(message.srcFile!, fileIndex)"
                        >{{ formatSrcFileLabel(file) }}</button>
                        <a
                          v-else
                          class="src-file-link"
                          :href="appendAuthTokenToUrl(file.url)"
                          :download="file.fullFileName || undefined"
                          target="_blank"
                          rel="noopener noreferrer"
                        >{{ formatSrcFileLabel(file) }}</a>
                      </li>
                    </ul>
                  </div>
                  <AgentTurnTimeline
                    v-if="message.turnSteps?.length"
                    :steps="message.turnSteps"
                    :active="isActiveAssistantTurn(message.index)"
                    :current-state="
											isActiveAssistantTurn(message.index) ? currentAgentState : null
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
              <div class="message-bubble-wrap">
                <div
                  class="message-content"
                  :class="{
                    'message-content--with-media': !!message.attachments?.length,
                    'message-content--image-only':
                      !!message.attachments?.length && !message.content?.trim()
                  }"
                >
                <div
                  v-if="message.attachments?.length"
                  class="message-images"
                  :class="getAttachmentGalleryClass(message.attachments.length)"
                >
                  <template v-if="message.attachments.length === 1">
                    <img
                      :key="message.attachments[0].objectKey || message.attachments[0].url || 0"
                      :src="resolveAttachmentImageSrc(message.attachments[0])"
                      :alt="message.attachments[0].name"
                      class="message-image message-image--solo"
                      @error="handleAttachmentImageError(message.attachments[0])"
                      @click.stop="openAttachmentPreview(message.attachments, 0)"
                    />
                  </template>
                  <template v-else>
                    <div
                      v-for="(image, imageIndex) in message.attachments"
                      :key="image.objectKey || image.url || imageIndex"
                      class="message-image-wrap"
                    >
                      <img
                        :src="resolveAttachmentImageSrc(image)"
                        :alt="image.name"
                        class="message-image"
                        @error="handleAttachmentImageError(image)"
                        @click.stop="openAttachmentPreview(message.attachments!, imageIndex)"
                      />
                    </div>
                  </template>
                </div>
                <div
                  v-if="message.content"
                  class="message-md"
                  v-html="userMessageHtmlMap.get(message.index) ?? ''"
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
      <div class="chat-bottom-dock">
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
          :class="{
            'is-input-editing': inputFocused,
            'is-drag-over': isDragOverImages
          }"
          @paste="handleImagePaste"
          @dragenter="handleInputDragEnter"
          @dragover="handleInputDragOver"
          @dragleave="handleInputDragLeave"
          @drop="handleInputDrop"
        >
          <div v-if="selectedAttachments.length" class="pending-images">
            <div
              v-for="(image, index) in selectedAttachments"
              :key="image.id"
              class="pending-image"
              :class="{ 'is-processing': image.processing }"
            >
              <img
                v-if="image.previewUrl"
                :src="image.previewUrl"
                :alt="image.sourceName"
              />
              <div v-else class="pending-image-placeholder">
                <ElIcon class="is-loading"><Loading /></ElIcon>
              </div>
              <button
                type="button"
                :disabled="image.processing"
                @click="removeAttachment(index)"
              >
                &times;
              </button>
            </div>
          </div>
          <input
            ref="imageInputRef"
            class="image-file-input"
            type="file"
            accept="image/*"
            multiple
            @change="handleImageSelect"
          />
          <ElInput
            ref="chatInputRef"
            v-model="inputMessage"
            class="chat-input"
            :placeholder="t('ai.input.placeholder')"
            type="textarea"
            :autosize="chatInputAutosize"
            :maxlength="32768"
            show-word-limit
            @touchstart.passive="ensureInputExpanded"
            @pointerdown="ensureInputExpanded"
            @focus="onChatInputFocus"
            @blur="onChatInputBlur"
            @keydown="handleKeydown"
            @input="handleInput"
            @keyup="handleKeyup"
          />
          <ElButton
            class="image-button"
            text
            :icon="Picture"
            :disabled="isBusyByState || sendingMessage || isProcessingImages || selectedAttachments.length >= 4"
            @click="imageInputRef?.click()"
          />
          <ElButton
            :type="isBusyByState ? 'danger' : 'primary'"
            class="chat-button"
            circle
            :disabled="
              !isBusyByState &&
              ((!inputMessage.trim() && !readyAttachments.length) ||
                sendingMessage ||
                isProcessingImages)
            "
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
    <DiagramPreviewOverlay
      :visible="diagramPreviewVisible"
      :diagrams="diagramPreviewSvgs"
      :initial-index="diagramPreviewIndex"
      @close="closeDiagramPreview"
    />
    <HtmlPreviewOverlay
      :visible="htmlPreviewVisible"
      :sources="htmlPreviewSources"
      :initial-index="htmlPreviewIndex"
      @close="closeHtmlPreview"
    />
    <MdViewerOverlay
      :visible="mdViewerVisible"
      :sources="mdViewerSources"
      :initial-index="mdViewerIndex"
      @close="closeMdViewer"
    />
  </div>
</template>

<script setup lang="ts">
import { ArrowDown, ChatLineSquare, DocumentCopy, Loading, Picture, Position, Refresh } from '@element-plus/icons-vue'
import {
  computed,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch
} from 'vue'
import { consumeForceNewChatFlag } from '@/routes'
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
import DiagramPreviewOverlay from './DiagramPreviewOverlay.vue'
import HtmlPreviewOverlay from './HtmlPreviewOverlay.vue'
import MdViewerOverlay, {
  type MdViewerSource
} from './MdViewerOverlay.vue'
import {
  ChatAttachmentDto,
  ChatRequestDto,
  FileDto,
  formatSrcFileLabel,
  MessageDto
} from '@/types/ai.types'
import {
  isMarkdownFile,
  resolveMarkdownFileName
} from '@/utils/repoFileUrl'
import { t } from '@ai-system/lib'
import {
  addMessageFeedback,
  getHistoryContext,
  getQaTemplate
} from '@/api/ai.api'
import { chatActivityStore } from '../ts/activity/store'
import { isContextStreaming } from '../ts/activity/live'
import { chatSessionRegistry } from '../ts/session/registry'
import { startTurn, stopTurn } from '../ts/stream/service'
import { useActiveChatSessionBindings } from '../ts/session/bindings'
import type { PendingChatImage } from '../ts/session/types'
import { buildSessionKey } from '../ts/session/types'
import { buildSessionTitle } from '../ts/history/title'
import {
  buildChatAttachmentContentUrl,
  isChatAttachmentContentUrl,
  resolveAttachmentImageSrc,
  resolveAttachmentsDisplayUrls
} from '../ts/media/attachment'
import { appendAuthTokenToUrl } from '@/utils/authenticatedUrl'
import { formatApiErrorMessage } from '@/utils/apiError'
import { processChatImageFile } from '../ts/media/image'
import { cloneSvgForPreview } from '@/utils/diagramPreview'
import { preloadDiagramRuntimes } from '@/utils/diagramMarkdownRuntime'
import {
  buildMarkdownPrefetchRootMargin,
  clearDiagramMarkupCacheForSession,
  getMarkdownCodeBlockText,
  getMarkdownHtmlBlockSource,
  MARKDOWN_RENDERER_REVISION,
  hasPendingMarkdownBlocks,
  normalizeMarkdownImageParagraphs,
  renderMarkdownCached,
  renderMarkdownBlocks,
  cancelPendingMarkdownRenderWork,
  pauseDiagramReflowInRoot,
  scheduleUpdateStreamTailSegmentInPlace
} from '@/utils/markdownRenderer'
import { registerSessionRenderCacheEvict } from '../ts/render/session-render-cache'
import { chatLogoEmoji, chatLogoUrl } from '@/oem'
import { getAgentDisplayName, getAgentLogo, agentNameMap } from '../ts/agent/name-registry'

const showChatManage = ref(false)
const chatManageRef = ref(null)
/** 聊天主区域根节点，用于写入底部悬浮层高度 CSS 变量 */
const chatViewRef = ref<HTMLElement>()
/** 监听消息列表高度变化（图片/iframe/图表异步撑高），跟随态下瞬时贴底 */
let messageListResizeObserver: ResizeObserver | undefined
const {
  activeSession,
  contextId,
  messageContext,
  inputMessage,
  selectedAttachments,
  sendingMessage,
  isBusyByState,
  currentAgentState,
  suggestedFollowUps,
  requireActiveSession
} = useActiveChatSessionBindings()
const scrollbarRef = ref()
const messageListRef = ref<HTMLElement>()
/** keep-alive 可见时允许流式 Markdown / 滚动 UI；切走后冻结快照，后台流不中断 */
const isChatViewActive = ref(true)
/** 「回到底部」按钮隐藏（即处于贴底自动跟随区域）时为 true；完全由滚动位置决定 */
const isAtBottom = ref<boolean>(true)
/** 用户正在主动滚动（滚轮 / 触摸）期间为 true：此时一律不自动下滚，避免与用户操作打架 */
let userScrolling = false
let userScrollIdleTimer: ReturnType<typeof setTimeout> | null = null
/** 用户停手多久后视为「滚动结束」，恢复自动跟随能力 */
const USER_SCROLL_IDLE_MS = 200
/** 自动下滚的统一条件：处于贴底区域（按钮已隐藏）且用户当前没有在滚动 */
const shouldAutoScroll = () => isAtBottom.value && !userScrolling
/**
 * 仅展示后端标记为可展示的消息；displayInChat === false 的条目仍保留在上下文中，但不渲染气泡。
 */
const visibleMessageContext = computed(() =>
  messageContext.value.filter((m) => m.displayInChat !== false)
)
const imageInputRef = ref<HTMLInputElement>()
const isDragOverImages = ref(false)
let inputAreaDragDepth = 0

const readyAttachments = computed(() =>
  selectedAttachments.value.filter((item) => !item.processing && item.file)
)
const isProcessingImages = computed(() =>
  selectedAttachments.value.some((item) => item.processing)
)

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('failed to read image'))
        return
      }
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('failed to read image'))
    reader.readAsDataURL(file)
  })

const revokeBlobUrl = (url?: string) => {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

const buildOutboundAttachments = async (
  pending: PendingChatImage[]
): Promise<ChatAttachmentDto[]> =>
  Promise.all(
    pending
      .filter((item): item is PendingChatImage & { file: File } => !!item.file)
      .map(async (item) => ({
        name: item.file.name,
        contentType: item.contentType,
        size: item.file.size,
        data: await fileToBase64(item.file)
      }))
  )

const buildDisplayAttachments = (
  pending: PendingChatImage[]
): ChatAttachmentDto[] =>
  pending
    .filter((item): item is PendingChatImage & { file: File; previewUrl: string } =>
      !!item.file && !!item.previewUrl
    )
    .map((item) => ({
      name: item.file.name,
      contentType: item.contentType,
      size: item.file.size,
      url: item.previewUrl
    }))

const createPendingAttachmentId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`

const addProcessingPlaceholder = (sourceName: string): string => {
  const session = requireActiveSession()
  if (!session) {
    return ''
  }
  const id = createPendingAttachmentId()
  session.selectedAttachments.value.push({
    id,
    file: null,
    previewUrl: null,
    contentType: 'image/jpeg',
    processing: true,
    sourceName
  })
  return id
}

const finishPendingAttachment = (id: string, file: File) => {
  const session = requireActiveSession()
  if (!session) {
    return
  }
  const item = session.selectedAttachments.value.find((entry) => entry.id === id)
  if (!item) {
    return
  }
  item.file = file
  item.contentType = file.type
  item.previewUrl = URL.createObjectURL(file)
  item.processing = false
}

const removePendingAttachmentById = (id: string) => {
  const session = requireActiveSession()
  if (!session) {
    return
  }
  const index = session.selectedAttachments.value.findIndex((entry) => entry.id === id)
  if (index >= 0) {
    removeAttachment(index)
  }
}

const hasImageInTransfer = (transfer: DataTransfer | null) => {
  if (!transfer) return false
  return Array.from(transfer.items).some(
    (item) => item.kind === 'file' && item.type.startsWith('image/')
  )
}

const normalizePastedFile = (file: File): File => {
  if (file.name) return file
  const ext =
    file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png'
  return new File([file], `pasted-${Date.now()}.${ext}`, { type: file.type })
}

const ensureContextId = async (): Promise<string | undefined> => {
  const session = requireActiveSession()
  if (!session) {
    return undefined
  }
  if (session.contextId.value) {
    return session.contextId.value
  }
  try {
    const created = await chatSessionRegistry.createNewSession(props.agentId)
    return created.contextId.value
  } catch {
    ElMessage.error(t('ai.image.upload.failed'))
    return undefined
  }
}

const uploadImageFiles = async (files: File[]) => {
  if (!files.length) return
  if (isBusyByState.value || sendingMessage.value || isProcessingImages.value) {
    ElMessage.info(t('ai.assistant.waiting'))
    return
  }
  const remaining = 4 - selectedAttachments.value.length
  if (remaining <= 0) {
    ElMessage.warning(t('ai.image.max'))
    return
  }
  if (files.length > remaining) {
    ElMessage.warning(t('ai.image.max'))
  }
  let rejected = 0
  for (const rawFile of files.slice(0, remaining)) {
    const placeholderId = addProcessingPlaceholder(rawFile.name || 'image')
    try {
      const processed = await processChatImageFile(rawFile)
      if (!processed) {
        removePendingAttachmentById(placeholderId)
        rejected++
        continue
      }
      finishPendingAttachment(placeholderId, processed)
    } catch {
      removePendingAttachmentById(placeholderId)
      rejected++
    }
  }
  if (rejected > 0) {
    ElMessage.warning(t('ai.image.process.failed'))
  }
}

/** 聊天图片全屏预览是否可见 */
const imagePreviewVisible = ref(false)
/** 当前预览 URL 列表（同条消息内多张图可切换） */
const imagePreviewUrlList = ref<string[]>([])
/** 图片预览初始下标 */
const imagePreviewIndex = ref(0)
/** 图表全屏预览是否可见 */
const diagramPreviewVisible = ref(false)
/** 图表预览 SVG 克隆列表（内联挂载，避免 foreignObject 在 img 中失效） */
const diagramPreviewSvgs = ref<SVGElement[]>([])
/** 图表预览初始下标 */
const diagramPreviewIndex = ref(0)
/** HTML 全屏预览是否可见 */
const htmlPreviewVisible = ref(false)
/** HTML 预览源码列表（同条消息内多块可切换） */
const htmlPreviewSources = ref<string[]>([])
/** HTML 预览初始下标 */
const htmlPreviewIndex = ref(0)
/** Markdown 来源预览是否可见 */
const mdViewerVisible = ref(false)
/** Markdown 来源预览列表 */
const mdViewerSources = ref<MdViewerSource[]>([])
/** Markdown 来源预览初始下标 */
const mdViewerIndex = ref(0)

const isSrcMarkdownFile = (file: FileDto) =>
  isMarkdownFile(resolveMarkdownFileName(file))

const toMdViewerSource = (file: FileDto): MdViewerSource => ({
  url: file.url,
  title: formatSrcFileLabel(file),
  relativePath: file.relativePath
})

const openSrcFilePreview = (files: FileDto[], index: number) => {
  const mdSources = files
    .map((file, fileIndex) => ({ file, fileIndex }))
    .filter(({ file }) => isSrcMarkdownFile(file))
  if (!mdSources.length) {
    return
  }
  const clicked = files[index]
  const viewerIndex = clicked
    ? mdSources.findIndex(({ file }) => file.url === clicked.url)
    : 0
  closeImagePreview()
  closeDiagramPreview()
  closeHtmlPreview()
  mdViewerSources.value = mdSources.map(({ file }) => toMdViewerSource(file))
  mdViewerIndex.value = Math.max(viewerIndex, 0)
  mdViewerVisible.value = true
}

const closeMdViewer = () => {
  mdViewerVisible.value = false
  mdViewerSources.value = []
}

/** 非终态 busy 时当前轮 assistant 消息的 index（非可见列表下标）。 */
const activeAssistantMessageIndex = computed(() => {
  if (!isBusyByState.value) {
    return -1
  }
  const list = visibleMessageContext.value
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].role === 'assistant') {
      return list[i].index
    }
  }
  return -1
})

const isActiveAssistantTurn = (messageIndex: number) =>
  messageIndex === activeAssistantMessageIndex.value

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

/** 当前活跃会话是否在全局活动中心标记为进行中（驱动主区光晕动画）。 */
const isActiveContextStreaming = computed(() => {
  const cid = contextId.value || ''
  if (!cid) {
    return false
  }
  return isContextStreaming(props.agentId, cid)
})

/** 窄屏缩小消息行头像，与气泡字号更协调 */
const messageAvatarSize = computed(() => (props.isMobile ? 36 : 50))

const effectiveChatLogo = computed(
  () => getAgentLogo(props.agentId) || chatLogoEmoji
)

const assistantGreeting = computed(() => {
  agentNameMap.value
  return t('ai.hi.assistant', { name: getAgentDisplayName(props.agentId) })
})

const chatInputRef = ref<InstanceType<typeof ElInput> | null>(null)
const inputFocused = ref(false)

/** 高度由 CSS 控制，禁用 autosize，避免内联 height 盖过样式 */
const chatInputAutosize = false

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

const syncChatInputHeight = () => {
  nextTick(() => {
    clearChatTextareaInlineSize()
    requestAnimationFrame(() => {
      clearChatTextareaInlineSize()
    })
  })
}

/** touchstart / pointerdown 先于 focus，同一击内先标记撑高 */
const ensureInputExpanded = () => {
  if (inputFocused.value) {
    return
  }
  inputFocused.value = true
  syncChatInputHeight()
}

const onChatInputFocus = () => {
  inputFocused.value = true
  syncChatInputHeight()
}

const onChatInputBlur = () => {
  inputFocused.value = false
  syncChatInputHeight()
}

const sendMessage = async (msg?: string) => {
  let session = requireActiveSession()
  if (!session) {
    session = await chatSessionRegistry.enterAgent(props.agentId)
  }
  if (isBusyByState.value || sendingMessage.value || isProcessingImages.value) {
    ElMessage.info(isProcessingImages.value ? t('ai.image.processing') : t('ai.assistant.waiting'))
    return
  }
  if (msg) {
    session.inputMessage.value = msg
  }
  if (!session.inputMessage.value.trim() && !readyAttachments.value.length) {
    return
  }
  const activeContextId = await ensureContextId()
  if (!activeContextId) {
    return
  }
  session.sendingMessage.value = true
  try {
    const pendingImages = [...readyAttachments.value]
    const displayAttachments = buildDisplayAttachments(pendingImages)
    const outboundAttachments = pendingImages.length
      ? await buildOutboundAttachments(pendingImages)
      : []
    session.dispatcher.clearSuggestedFollowUps()
    const message: MessageDto = {
      index: session.messageContext.value.length,
      content: session.inputMessage.value,
      role: 'user',
      attachments: displayAttachments
    }
    session.messageContext.value.push(message)
    session.inputMessage.value = ''
    session.selectedAttachments.value = []
    const sessionTitle = buildSessionTitle(
      message.content,
      message.attachments.length
    )
    chatManageRef.value?.upsertSessionHistoryItem({
      contextId: activeContextId,
      agentId: props.agentId,
      title: sessionTitle
    })
    session.dispatcher.beginOptimisticTurn()
    chatActivityStore.markActive(props.agentId, activeContextId, 'THINKING')
    isAtBottom.value = true
    scrollToBottomAfterMessageFlush()
    const chatRequestDto: ChatRequestDto = {
      contextId: activeContextId,
      messages: [
        {
          ...message,
          attachments: outboundAttachments
        }
      ],
      retrievalKb: true,
      systemPrompt: 'GENERAL_ASSISTANT'
    }
    startTurn(session, chatRequestDto, {
      onScrollRequest: () => {
        if (shouldAutoScroll()) {
          scrollToBottom()
        }
      }
    })
  } catch {
    ElMessage.error(t('ai.image.upload.failed'))
  } finally {
    session.sendingMessage.value = false
  }
}

const handleImageSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  await uploadImageFiles(files)
}

const handleImagePaste = (event: ClipboardEvent) => {
  const items = event.clipboardData?.items
  if (!items?.length) return
  const files: File[] = []
  for (const item of items) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (!file) continue
    if (file.type && !file.type.startsWith('image/')) continue
    files.push(normalizePastedFile(file))
  }
  if (!files.length) return
  event.preventDefault()
  event.stopPropagation()
  void uploadImageFiles(files)
}

const handleInputDragEnter = (event: DragEvent) => {
  if (!hasImageInTransfer(event.dataTransfer)) return
  inputAreaDragDepth++
  isDragOverImages.value = true
}

const handleInputDragOver = (event: DragEvent) => {
  if (!hasImageInTransfer(event.dataTransfer)) return
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

const handleInputDragLeave = () => {
  inputAreaDragDepth = Math.max(0, inputAreaDragDepth - 1)
  if (inputAreaDragDepth === 0) {
    isDragOverImages.value = false
  }
}

const handleInputDrop = (event: DragEvent) => {
  inputAreaDragDepth = 0
  isDragOverImages.value = false
  event.preventDefault()
  const files = Array.from(event.dataTransfer?.files || [])
  void uploadImageFiles(files)
}

const removeAttachment = (index: number) => {
  const session = requireActiveSession()
  if (!session) {
    return
  }
  const [removed] = session.selectedAttachments.value.splice(index, 1)
  if (removed?.previewUrl) {
    revokeBlobUrl(removed.previewUrl)
  }
}

const normalizeMessageAttachmentUrls = (messages: MessageDto[]) => {
  for (const message of messages) {
    if (message.attachments?.length) {
      message.attachments =
        resolveAttachmentsDisplayUrls(message.attachments) ?? message.attachments
    }
  }
}

const handleAttachmentImageError = (attachment: ChatAttachmentDto) => {
  if (attachment.url?.startsWith('blob:')) {
    return
  }
  if (!attachment.objectKey) {
    return
  }
  if (isChatAttachmentContentUrl(attachment.url)) {
    const withAuth = appendAuthTokenToUrl(attachment.url)
    if (withAuth !== attachment.url) {
      attachment.url = withAuth
    }
    return
  }
  attachment.url = buildChatAttachmentContentUrl(attachment.objectKey)
}

const openAttachmentPreview = (attachments: ChatAttachmentDto[], index: number) => {
  closeDiagramPreview()
  imagePreviewUrlList.value = attachments.map((item) => resolveAttachmentImageSrc(item))
  imagePreviewIndex.value = index
  imagePreviewVisible.value = true
}

/** 用户附件图库布局：单图大图，多图统一方形缩略图网格 */
const getAttachmentGalleryClass = (count: number) => {
  if (count <= 1) {
    return ['message-images--single']
  }
  return ['message-images--multi', `message-images--count-${Math.min(count, 9)}`]
}
/**
 * 距真实底部小于该像素即视为「贴底」。该阈值同时决定：
 * 1)「回到底部」按钮的显隐（进入此范围即隐藏）；
 * 2) 自动跟随的触发区域（按钮隐藏 = 处于自动跟随区域）。
 */
const BOTTOM_FOLLOW_THRESHOLD = 120

/** 合并多源滚动触发的 rAF 句柄，避免多个平滑动画互相打断造成抽搐 */
let scrollRafId: number | null = null
let lastScrollHeight = 0

const getScrollWrap = (): HTMLElement | null => {
  const wrap = scrollbarRef.value?.wrapRef
  return wrap instanceof HTMLElement ? wrap : null
}

/**
 * 贴底状态下的底部锚定：
 * 内容高度变化时按 scrollHeight 增量同步补偿 scrollTop，让最后一个气泡底边保持在原屏幕位置。
 */
const keepBottomAnchored = () => {
  if (!isChatViewActive.value) {
    return
  }
  const wrap = getScrollWrap()
  if (!wrap) {
    return
  }
  const currentScrollHeight = wrap.scrollHeight
  if (!shouldAutoScroll()) {
    lastScrollHeight = currentScrollHeight
    return
  }
  const previousScrollHeight = lastScrollHeight || currentScrollHeight
  const delta = currentScrollHeight - previousScrollHeight
  if (delta !== 0) {
    wrap.scrollTop += delta
  } else {
    wrap.scrollTop = currentScrollHeight - wrap.clientHeight
  }
  lastScrollHeight = wrap.scrollHeight
  isAtBottom.value = true
}

/**
 * 滚动到底部。
 * - 流式 / 异步撑高场景用 'auto' 瞬时贴底：每次都精确落到「当前实时」底部，消除追逐过时目标导致的抽搐。
 * - 仅用户主动发送消息那一次用 'smooth'。
 * 所有触发合并进单个 rAF，DOM 更新（nextTick 的微任务）后、绘制前执行，能读到最新 scrollHeight。
 */
const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
  if (!isChatViewActive.value) {
    return
  }
  if (scrollRafId !== null) {
    cancelAnimationFrame(scrollRafId)
  }
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    const wrap = getScrollWrap()
    if (!wrap) {
      return
    }
    wrap.scrollTo({ top: wrap.scrollHeight, behavior })
    lastScrollHeight = wrap.scrollHeight
  })
}

/** 点击「回到底部」按钮：回到底部并恢复自动跟随 */
const handleScrollToBottomClick = () => {
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
/** 增量切分：delta 内出现围栏行才需要全量 regex 重扫 */
const FENCE_LINE_IN_DELTA_RE = /(^|\n)[ \t]*(`{3,}|~{3,})/

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

/** 当前流式 assistant 消息的增量切分缓存，避免每个 token 对全文跑 FENCE_BLOCK_RE */
let activeStreamSplitCache: {
  content: string
  segments: StreamSegment[]
} | null = null

const resetActiveStreamSplitCache = () => {
  activeStreamSplitCache = null
  resetActiveStreamRenderedCache()
}

/**
 * 流式输出专用：纯追加 token 且 delta 内无新围栏行时，只延长尾段而不全量 regex。
 */
const splitStreamingSegmentsForActiveStream = (
  content: string
): StreamSegment[] => {
  if (activeStreamSplitCache?.content === content) {
    return activeStreamSplitCache.segments
  }
  const prev = activeStreamSplitCache
  if (
    prev &&
    content.startsWith(prev.content) &&
    prev.segments.length > 0 &&
    !prev.segments[prev.segments.length - 1].complete
  ) {
    const delta = content.slice(prev.content.length)
    if (!FENCE_LINE_IN_DELTA_RE.test(delta)) {
      const completed = prev.segments.slice(0, -1)
      let tailStart = 0
      for (const seg of completed) {
        tailStart += seg.text.length
      }
      const segments = [
        ...completed,
        { text: content.slice(tailStart), complete: false }
      ]
      activeStreamSplitCache = { content, segments }
      return segments
    }
  }
  const segments = splitStreamingSegments(content)
  activeStreamSplitCache = { content, segments }
  return segments
}

type RenderedStreamSegment = StreamSegment & { html: string }

type SegmentCacheEntry = {
  content: string
  segments: RenderedStreamSegment[]
  revision: string
}

type UserHtmlCacheEntry = {
  content: string
  html: string
  revision: string
}

/** 按会话 key 隔离 Markdown 段缓存，切换对话时不全量失效 */
const assistantSegmentCacheBySession = new Map<
  string,
  Map<number, SegmentCacheEntry>
>()
const userHtmlCacheBySession = new Map<string, Map<number, UserHtmlCacheEntry>>()

const getActiveSessionKey = () => activeSession.value?.key ?? ''

const getAssistantSegmentCache = () => {
  const sessionKey = getActiveSessionKey()
  if (!sessionKey) {
    return new Map<number, SegmentCacheEntry>()
  }
  let cache = assistantSegmentCacheBySession.get(sessionKey)
  if (!cache) {
    cache = new Map()
    assistantSegmentCacheBySession.set(sessionKey, cache)
  }
  return cache
}

const getUserHtmlCache = () => {
  const sessionKey = getActiveSessionKey()
  if (!sessionKey) {
    return new Map<number, UserHtmlCacheEntry>()
  }
  let cache = userHtmlCacheBySession.get(sessionKey)
  if (!cache) {
    cache = new Map()
    userHtmlCacheBySession.set(sessionKey, cache)
  }
  return cache
}

/** 删除会话等显式失效时清空 Markdown 段缓存；routine 切会话勿调用 */
const evictSessionRenderCache = (sessionKey: string) => {
  assistantSegmentCacheBySession.delete(sessionKey)
  userHtmlCacheBySession.delete(sessionKey)
  clearDiagramMarkupCacheForSession(sessionKey)
}

const findVisibleMessageByIndex = (messageIndex: number) =>
  visibleMessageContext.value.find((message) => message.index === messageIndex)

const buildRenderedSegments = (
  content: string,
  streamingTail = false
): RenderedStreamSegment[] => {
  const segments = streamingTail
    ? splitStreamingSegmentsForActiveStream(content)
    : splitStreamingSegments(content)
  return segments.map((seg, idx) => {
    const isTail = idx === segments.length - 1 && !seg.complete
    const shouldRenderHtml = seg.complete || !isTail || !streamingTail
    return {
      ...seg,
      html: shouldRenderHtml ? renderMarkdownCached(seg.text) : ''
    }
  })
}

/** 流式 assistant 已渲染段缓存：仅尾段增长时复用数组与已闭合段对象，避免 Vue 每 token 重建 DOM */
let activeStreamRenderedCache: {
  content: string
  segments: RenderedStreamSegment[]
} | null = null

const resetActiveStreamRenderedCache = () => {
  activeStreamRenderedCache = null
}

const buildRenderedSegmentsForActiveStream = (
  content: string
): RenderedStreamSegment[] => {
  if (activeStreamRenderedCache?.content === content) {
    return activeStreamRenderedCache.segments
  }
  const rawSegments = splitStreamingSegmentsForActiveStream(content)
  const prev = activeStreamRenderedCache
  if (
    prev &&
    content.startsWith(prev.content) &&
    rawSegments.length > 0 &&
    !rawSegments[rawSegments.length - 1].complete &&
    rawSegments.length === prev.segments.length
  ) {
    const nextSegments = prev.segments.slice(0, -1)
    const tailRaw = rawSegments[rawSegments.length - 1]
    nextSegments.push({ ...tailRaw, html: '' })
    activeStreamRenderedCache = { content, segments: nextSegments }
    return nextSegments
  }

  const nextSegments: RenderedStreamSegment[] = []
  for (let idx = 0; idx < rawSegments.length; idx++) {
    const seg = rawSegments[idx]
    const isTail = idx === rawSegments.length - 1 && !seg.complete
    const prevSeg = prev?.segments[idx]
    if (
      prevSeg &&
      prevSeg.complete &&
      seg.complete &&
      prevSeg.text === seg.text
    ) {
      nextSegments.push(prevSeg)
      continue
    }
    nextSegments.push({
      ...seg,
      html: isTail ? '' : renderMarkdownCached(seg.text)
    })
  }
  activeStreamRenderedCache = { content, segments: nextSegments }
  return nextSegments
}

const buildStableAssistantSegments = (
  messageIndex: number,
  content: string
): RenderedStreamSegment[] => {
  const cache = getAssistantSegmentCache()
  const hit = cache.get(messageIndex)
  if (
    hit?.content === content &&
    hit.revision === MARKDOWN_RENDERER_REVISION
  ) {
    return hit.segments
  }
  const segments = buildRenderedSegments(content, false)
  cache.set(messageIndex, {
    content,
    segments,
    revision: MARKDOWN_RENDERER_REVISION
  })
  return segments
}

const getStableUserHtml = (messageIndex: number, content: string): string => {
  const cache = getUserHtmlCache()
  const hit = cache.get(messageIndex)
  if (
    hit?.content === content &&
    hit.revision === MARKDOWN_RENDERER_REVISION
  ) {
    return hit.html
  }
  const html = renderMarkdownCached(content)
  cache.set(messageIndex, {
    content,
    html,
    revision: MARKDOWN_RENDERER_REVISION
  })
  return html
}

const buildAssistantRenderedSegmentsMap = (): Map<
  number,
  RenderedStreamSegment[]
> => {
  const map = new Map<number, RenderedStreamSegment[]>()
  const streamingMsgIndex = isBusyByState.value
    ? activeAssistantMessageIndex.value
    : -1
  visibleMessageContext.value.forEach((message) => {
    if (message.role === 'assistant' && message.content) {
      if (
        isChatViewActive.value &&
        isBusyByState.value &&
        message.index === streamingMsgIndex
      ) {
        map.set(message.index, buildRenderedSegmentsForActiveStream(message.content))
      } else {
        map.set(
          message.index,
          buildStableAssistantSegments(message.index, message.content)
        )
      }
    }
  })
  return map
}

const frozenAssistantRenderedSegments = shallowRef(
  new Map<number, RenderedStreamSegment[]>()
)
/** 活跃期间最近一次 segments 快照，切走时 O(1) 冻结，避免 onDeactivated 全量 markdown-it */
const lastActiveRenderedSegments = shallowRef(
  new Map<number, RenderedStreamSegment[]>()
)

/** 预解析 assistant 消息段；流式期间仅重算当前轮，历史消息走稳定段缓存 */
const assistantRenderedSegments = computed(() => {
  if (!isChatViewActive.value) {
    return frozenAssistantRenderedSegments.value
  }
  const map = buildAssistantRenderedSegmentsMap()
  lastActiveRenderedSegments.value = map
  return map
})

const userMessageHtmlMap = computed(() => {
  const map = new Map<number, string>()
  visibleMessageContext.value.forEach((message) => {
    if (message.role === 'user' && message.content) {
      map.set(message.index, getStableUserHtml(message.index, message.content))
    }
  })
  return map
})

/** 当前流式 assistant 尾段原文（围栏未闭合部分），非流式时为 null */
const activeAssistantTailText = computed(() => {
  if (!isChatViewActive.value || !isBusyByState.value) {
    return null
  }
  const idx = activeAssistantMessageIndex.value
  if (idx < 0) {
    return null
  }
  const message = findVisibleMessageByIndex(idx)
  if (!message?.content || message.role !== 'assistant') {
    return null
  }
  const segments = splitStreamingSegmentsForActiveStream(message.content)
  const tail = segments[segments.length - 1]
  if (tail.complete) {
    return null
  }
  return tail.text
})

/** 当前流式尾段就地更新容器（不用 v-html，避免 pending 占位被销毁） */
const activeTailSegmentEl = ref<HTMLElement | null>(null)

const bindActiveTailSegmentRef = (el: unknown) => {
  activeTailSegmentEl.value = el instanceof HTMLElement ? el : null
}

const MARKDOWN_BLOCKS_DEBOUNCE_MS = 100
/** 历史会话切换后图表恢复 debounce，避免连点叠加 flush */
const SESSION_RESTORE_DEBOUNCE_MS = 200
/** 切换后短暂限制后台预渲染，降低主线程峰值 */
const SESSION_SWITCH_GUARD_MS = 500
const SESSION_SWITCH_PREFETCH_MARGIN = '400px 0px'
let markdownBlocksDebounceTimer: ReturnType<typeof setTimeout> | null = null
let restoreSessionDiagramsTimer: ReturnType<typeof setTimeout> | null = null
let restoreSessionDiagramsToken = 0
let sessionSwitchGuardUntil = 0
let sessionSwitchGuardFollowupTimer: ReturnType<typeof setTimeout> | null = null
/** 是否曾 deactivate（区分首次 mount 的 onActivated 与从首页切回） */
let chatViewWasDeactivated = false

const cancelSessionSwitchGuardFollowup = () => {
  if (sessionSwitchGuardFollowupTimer !== null) {
    clearTimeout(sessionSwitchGuardFollowupTimer)
    sessionSwitchGuardFollowupTimer = null
  }
}

const markSessionSwitchGuard = () => {
  sessionSwitchGuardUntil = Date.now() + SESSION_SWITCH_GUARD_MS
  cancelSessionSwitchGuardFollowup()
  sessionSwitchGuardFollowupTimer = setTimeout(() => {
    sessionSwitchGuardFollowupTimer = null
    if (isChatViewActive.value) {
      flushActivateMarkdownBlocks()
    }
  }, SESSION_SWITCH_GUARD_MS + 50)
}

const isInSessionSwitchGuard = () => Date.now() < sessionSwitchGuardUntil

/** 流式输出时仅扫描当前轮 assistant 消息子树，避免全列表 querySelector */
const getMarkdownBlocksScope = (): Element | null => {
  const listRoot = messageListRef.value
  if (!listRoot || !isBusyByState.value) {
    return listRoot
  }
  const msgIndex = activeAssistantMessageIndex.value
  if (msgIndex < 0) {
    return listRoot
  }
  const row = listRoot.querySelector(
    `[data-message-index="${msgIndex}"]`
  )
  if (!(row instanceof Element)) {
    return listRoot
  }
  return row.querySelector('.message-bubble-wrap') ?? row
}

const runMarkdownBlocks = () => {
  if (!isChatViewActive.value) {
    return
  }
  nextTick(() => {
    const listRoot = messageListRef.value
    if (!listRoot) {
      return
    }
    const scopeRoot = getMarkdownBlocksScope() ?? listRoot
    const renderOptions = buildMarkdownBlocksRenderOptions()
    normalizeMarkdownImageParagraphs(scopeRoot)
    if (!hasPendingMarkdownBlocks(scopeRoot, renderOptions)) {
      return
    }
    renderMarkdownBlocks(scopeRoot, renderOptions)
      .then(() => {
        if (shouldAutoScroll()) {
          scrollToBottom()
        }
      })
      .catch((error) => {
        console.error('Markdown图表渲染失败:', error)
      })
  })
}

const activateMarkdownBlocks = () => {
  if (!isChatViewActive.value) {
    return
  }
  if (markdownBlocksDebounceTimer !== null) {
    clearTimeout(markdownBlocksDebounceTimer)
  }
  markdownBlocksDebounceTimer = setTimeout(() => {
    markdownBlocksDebounceTimer = null
    runMarkdownBlocks()
  }, MARKDOWN_BLOCKS_DEBOUNCE_MS)
}

/** 流式结束或会话切换时立即渲染，不等待 debounce */
const flushActivateMarkdownBlocks = () => {
  if (!isChatViewActive.value) {
    return
  }
  if (markdownBlocksDebounceTimer !== null) {
    clearTimeout(markdownBlocksDebounceTimer)
    markdownBlocksDebounceTimer = null
  }
  runMarkdownBlocks()
}

const buildMarkdownBlocksRenderOptions = () => {
  const scrollRoot =
    (scrollbarRef.value?.wrapRef as HTMLElement | undefined) ?? null
  const inSwitchGuard = isInSessionSwitchGuard()
  const sessionKey = getActiveSessionKey()
  return {
    deferDiagrams: isBusyByState.value,
    scrollRoot,
    prefetchRootMargin: inSwitchGuard
      ? SESSION_SWITCH_PREFETCH_MARGIN
      : buildMarkdownPrefetchRootMargin(scrollRoot),
    backgroundConcurrency: inSwitchGuard ? 0 : undefined,
    diagramCacheScope: sessionKey || undefined
  }
}

/** 切回会话：复用 HTML 占位缓存，仅 flush 图表 DOM（不重算 markdown-it / 不 bulk evict） */
const restoreSessionDiagrams = async () => {
  if (!isChatViewActive.value) {
    return
  }
  await nextTick()
  flushActivateMarkdownBlocks()
  await nextTick()
  const listRoot = messageListRef.value
  if (!listRoot) {
    return
  }
  const scopeRoot = getMarkdownBlocksScope() ?? listRoot
  if (hasPendingMarkdownBlocks(scopeRoot, buildMarkdownBlocksRenderOptions())) {
    flushActivateMarkdownBlocks()
  }
}

const scheduleRestoreSessionDiagrams = () => {
  const token = ++restoreSessionDiagramsToken
  if (restoreSessionDiagramsTimer !== null) {
    clearTimeout(restoreSessionDiagramsTimer)
  }
  restoreSessionDiagramsTimer = setTimeout(() => {
    restoreSessionDiagramsTimer = null
    if (token !== restoreSessionDiagramsToken) {
      return
    }
    void restoreSessionDiagrams()
  }, SESSION_RESTORE_DEBOUNCE_MS)
}

const cancelScheduledRestoreSessionDiagrams = () => {
  restoreSessionDiagramsToken += 1
  if (restoreSessionDiagramsTimer !== null) {
    clearTimeout(restoreSessionDiagramsTimer)
    restoreSessionDiagramsTimer = null
  }
}

const checkScroll = () => {
  const wrap = getScrollWrap()
  if (!wrap) {
    return
  }
  const { scrollTop, scrollHeight, clientHeight } = wrap
  const distFromBottom = scrollHeight - clientHeight - scrollTop
  // 按钮显隐与自动跟随触发区域共用同一阈值：进入贴底区即隐藏按钮，并允许自动跟随
  isAtBottom.value = distFromBottom <= BOTTOM_FOLLOW_THRESHOLD
  lastScrollHeight = scrollHeight
}

/** 标记用户正在滚动，并在停手一段时间后复位（停手前一律不自动下滚） */
const markUserScrolling = () => {
  userScrolling = true
  if (userScrollIdleTimer !== null) {
    clearTimeout(userScrollIdleTimer)
  }
  userScrollIdleTimer = setTimeout(() => {
    userScrolling = false
    userScrollIdleTimer = null
  }, USER_SCROLL_IDLE_MS)
}

const handleScrollWheel = () => {
  markUserScrolling()
}
const handleScrollTouchStart = () => {
  markUserScrolling()
}
const handleScrollTouchMove = () => {
  markUserScrolling()
}

let scrollIntentEl: HTMLElement | null = null

/** 在滚动容器上挂载滚轮 / 触摸监听，作为「用户正在滚动」的即时信号 */
const bindUserScrollIntent = () => {
  const wrap = scrollbarRef.value?.wrapRef as HTMLElement | undefined
  if (!wrap || scrollIntentEl === wrap) {
    return
  }
  unbindUserScrollIntent()
  scrollIntentEl = wrap
  wrap.addEventListener('wheel', handleScrollWheel, { passive: true })
  wrap.addEventListener('touchstart', handleScrollTouchStart, { passive: true })
  wrap.addEventListener('touchmove', handleScrollTouchMove, { passive: true })
}

const unbindUserScrollIntent = () => {
  if (!scrollIntentEl) {
    return
  }
  scrollIntentEl.removeEventListener('wheel', handleScrollWheel)
  scrollIntentEl.removeEventListener('touchstart', handleScrollTouchStart)
  scrollIntentEl.removeEventListener('touchmove', handleScrollTouchMove)
  scrollIntentEl = null
}

const reconnectMessageListResizeObserver = () => {
  const el = messageListRef.value
  messageListResizeObserver?.disconnect()
  messageListResizeObserver = undefined
  if (el && typeof ResizeObserver !== 'undefined') {
    messageListResizeObserver = new ResizeObserver(() => {
      keepBottomAnchored()
    })
    messageListResizeObserver.observe(el)
  }
}

let send = false

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    send = true
    event.preventDefault()
  }
}

const handleInput = () => {
  send = false
}

const handleKeyup = (event: KeyboardEvent) => {
  if (send && event.key === 'Enter') {
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
  closeDiagramPreview()
  closeHtmlPreview()
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
  closeImagePreview()
  closeHtmlPreview()
  const svgs = messageContent.querySelectorAll(
    '.md-diagram:not(.md-diagram-error) .md-diagram-body svg'
  )
  const clones: SVGElement[] = []
  let index = 0
  svgs.forEach((el) => {
    if (!(el instanceof SVGElement)) {
      return
    }
    if (el === targetSvg) {
      index = clones.length
    }
    clones.push(cloneSvgForPreview(el))
  })
  if (!clones.length) {
    return
  }
  diagramPreviewSvgs.value = clones
  diagramPreviewIndex.value = index
  diagramPreviewVisible.value = true
}

/**
 * 点击消息气泡内 HTML 预览缩略图，收集同气泡全部 HTML 块并打开全屏预览。
 */
const openMessageHtmlPreview = (
  messageContent: Element,
  targetWrap: HTMLElement
) => {
  closeImagePreview()
  closeDiagramPreview()
  const blocks = messageContent.querySelectorAll(
    '.md-html-block[data-md-rendered="true"]'
  )
  const sources: string[] = []
  let index = 0
  blocks.forEach((block) => {
    const wrap = block.querySelector('.md-html-preview-wrap')
    const source = getMarkdownHtmlBlockSource(block)
    if (!source.trim()) {
      return
    }
    if (wrap === targetWrap) {
      index = sources.length
    }
    sources.push(source)
  })
  if (!sources.length) {
    return
  }
  htmlPreviewSources.value = sources
  htmlPreviewIndex.value = index
  htmlPreviewVisible.value = true
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

  const copyBtn = target.closest('.md-code-copy')
  if (copyBtn) {
    event.preventDefault()
    event.stopPropagation()
    const block = copyBtn.closest('.md-code-block')
    if (block) {
      void copyMessage(getMarkdownCodeBlockText(block))
    }
    return
  }

  const htmlPreviewWrap = target.closest(
    '.md-html-preview-wrap:not(.md-block-pending)'
  )
  if (htmlPreviewWrap instanceof HTMLElement) {
    event.preventDefault()
    event.stopPropagation()
    openMessageHtmlPreview(messageContent, htmlPreviewWrap)
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

/** 关闭聊天图片全屏预览 */
const closeImagePreview = () => {
  imagePreviewVisible.value = false
}

/** 关闭图表全屏预览 */
const closeDiagramPreview = () => {
  diagramPreviewVisible.value = false
  diagramPreviewSvgs.value = []
}

/** 关闭 HTML 全屏预览 */
const closeHtmlPreview = () => {
  htmlPreviewVisible.value = false
  htmlPreviewSources.value = []
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

/** 进入智能体：列表页 forceNewChat flag 时强制新建；否则预激活会话保留，未预激活则新建 */
const bootstrapAgentSession = async (forceNew = false) => {
  if (forceNew || consumeForceNewChatFlag(props.agentId)) {
    await chatSessionRegistry.createNewSession(props.agentId)
  } else {
    await chatSessionRegistry.enterAgent(props.agentId)
  }
  isAtBottom.value = true
  getHotQuestions()
  nextTick(() => {
    scrollToBottom()
    flushActivateMarkdownBlocks()
  })
}

const newChat = async () => {
  await chatSessionRegistry.createNewSession(props.agentId)
  isAtBottom.value = true
  getHotQuestions()
  scrollToBottom()
}

/** 切换智能体时进入新对话（活动面板/历史已 activate 的同 agent 会话除外） */
watch(
  () => props.agentId,
  async (_newAgentId, oldAgentId) => {
    if (oldAgentId === undefined) {
      return
    }
    await bootstrapAgentSession()
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
 * 监听消息列表高度变化：贴底时同步补偿 scrollTop，而不是下一帧滚到底部。
 * 这样内容向下增长时，最后一个气泡底边在屏幕上的位置保持不变。
 */
watch(messageListRef, () => {
  reconnectMessageListResizeObserver()
})

/** 滚动容器可能因 v-if（历史栏 / 全屏切换）重建，wrapRef 变化后需重新挂载用户滚动监听 */
watch(scrollbarRef, () => {
  nextTick(() => {
    bindUserScrollIntent()
  })
})

/** 流式尾段就地增量更新，保留 pending 图表占位节点以维持流光动画 */
watch(
  [activeAssistantTailText, activeTailSegmentEl],
  ([text, el]) => {
    if (!isChatViewActive.value || !text || !el) {
      return
    }
    scheduleUpdateStreamTailSegmentInPlace(el, text, true)
  },
  { flush: 'post' }
)

/** 围栏闭合产生新稳定段时再触发图表渲染，避免每个 token 都 scan DOM */
watch(
  () => {
    if (!isChatViewActive.value || !isBusyByState.value) {
      return 0
    }
    const idx = activeAssistantMessageIndex.value
    if (idx < 0) {
      return 0
    }
    const message = findVisibleMessageByIndex(idx)
    if (!message?.content) {
      return 0
    }
    return splitStreamingSegmentsForActiveStream(message.content).filter(
      (seg) => seg.complete
    ).length
  },
  (count, prev) => {
    if (!isChatViewActive.value || count <= (prev ?? 0)) {
      return
    }
    nextTick(() => {
      flushActivateMarkdownBlocks()
    })
  }
)

/** 历史消息入列或流式结束后补渲染图表块；流式期间不 deep 扫描全列表 */
watch(
  () =>
    [
      activeSession.value?.messageContext.value.length,
      isBusyByState.value
    ] as const,
  ([length, busy], prev) => {
    if (!isChatViewActive.value || busy) {
      return
    }
    const prevLength = prev?.[0]
    if (prevLength !== undefined && length === prevLength) {
      return
    }
    flushActivateMarkdownBlocks()
  }
)

/** 流式结束但 content 不再变化时，补渲染推迟的 mermaid/plantuml/vegalite/html 块 */
watch(isBusyByState, (busy, wasBusy) => {
  if (!isChatViewActive.value || busy || !wasBusy) {
    return
  }
  resetActiveStreamSplitCache()
  resetActiveStreamRenderedCache()
  const el = activeTailSegmentEl.value
  const idx = activeAssistantMessageIndex.value
  if (el && idx >= 0) {
    const message = findVisibleMessageByIndex(idx)
    if (message?.content && message.role === 'assistant') {
      const tail = splitStreamingSegments(message.content).at(-1)
      if (tail?.text) {
        scheduleUpdateStreamTailSegmentInPlace(el, tail.text, false, true)
      }
    }
  }
  flushActivateMarkdownBlocks()
})

/** 后台会话流式更新时，活跃会话 pendingScroll 由 ChatView 消费 */
watch(
  () => activeSession.value?.pendingScroll.value,
  (pending) => {
    if (!pending || !isChatViewActive.value) {
      return
    }
    if (shouldAutoScroll()) {
      scrollToBottom()
    }
    const session = requireActiveSession()
    if (session) {
      session.pendingScroll.value = false
    }
  }
)

watch(
  () => chatSessionRegistry.activeSessionKey.value,
  () => {
    cancelScheduledRestoreSessionDiagrams()
    resetActiveStreamSplitCache()
    resetActiveStreamRenderedCache()
    activeTailSegmentEl.value = null
    if (markdownBlocksDebounceTimer !== null) {
      clearTimeout(markdownBlocksDebounceTimer)
      markdownBlocksDebounceTimer = null
    }
  }
)

/** 与侧边栏点历史同路：激活会话、按需拉取、滚底、恢复图表 DOM */
const showSessionView = async (targetContextId: string) => {
  cancelScheduledRestoreSessionDiagrams()
  cancelSessionSwitchGuardFollowup()
  cancelPendingMarkdownRenderWork(messageListRef.value ?? null)
  if (markdownBlocksDebounceTimer !== null) {
    clearTimeout(markdownBlocksDebounceTimer)
    markdownBlocksDebounceTimer = null
  }

  const session = chatSessionRegistry.activateSession(
    props.agentId,
    targetContextId
  )
  isAtBottom.value = true
  markSessionSwitchGuard()

  if (
    !session.loadedFromServer.value &&
    session.messageContext.value.length === 0
  ) {
    try {
      const res = await getHistoryContext(targetContextId, props.agentId)
      session.messageContext.value = res.data.messages ?? []
      normalizeMessageAttachmentUrls(session.messageContext.value)
      session.loadedFromServer.value = true
    } catch (error) {
      ElMessage.error(
        formatApiErrorMessage(error, {
          fallback: t('ai.error.system', { traceId: crypto.randomUUID() }),
          formatSystem: (traceId) => t('ai.error.system', { traceId })
        })
      )
    }
  }

  if (activeSession.value?.pendingScroll.value) {
    activeSession.value.pendingScroll.value = false
  }
  scrollToBottom()
  scheduleRestoreSessionDiagrams()
}

const historyChat = async (historyId: string) => {
  await showSessionView(historyId)
}

// 中止当前活跃会话正在进行的对话
const interruptChat = () => {
  const session = requireActiveSession()
  if (session) {
    stopTurn(session)
  }
}

watch(inputFocused, () => {
  syncChatInputHeight()
})

/** 宽屏 → 窄屏时收起输入框，避免仍停留在展开态 */
watch(
  () => props.isMobile,
  (mobile, wasMobile) => {
    if (mobile && wasMobile === false) {
      inputFocused.value = false
      getChatTextareaEl()?.blur()
      syncChatInputHeight()
      return
    }
    if (!mobile && wasMobile === true) {
      syncChatInputHeight()
    }
  }
)

onMounted(async () => {
  registerSessionRenderCacheEvict(evictSessionRenderCache)
  isChatViewActive.value = true
  preloadDiagramRuntimes()
  await bootstrapAgentSession()
  nextTick(() => {
    chatManageRef.value?.getHistoryListData()
    bindUserScrollIntent()
  })
})

/** keep-alive 切走：冻结 UI 快照并暂停重渲染，不中断 WebSocket 流式 */
const suspendChatViewUi = () => {
  if (!isChatViewActive.value) {
    return
  }
  cancelScheduledRestoreSessionDiagrams()
  cancelSessionSwitchGuardFollowup()
  cancelPendingMarkdownRenderWork(messageListRef.value ?? null)
  pauseDiagramReflowInRoot(messageListRef.value ?? null)
  frozenAssistantRenderedSegments.value = lastActiveRenderedSegments.value
  isChatViewActive.value = false
  activeTailSegmentEl.value = null
  if (markdownBlocksDebounceTimer !== null) {
    clearTimeout(markdownBlocksDebounceTimer)
    markdownBlocksDebounceTimer = null
  }
  unbindUserScrollIntent()
  if (userScrollIdleTimer !== null) {
    clearTimeout(userScrollIdleTimer)
    userScrollIdleTimer = null
  }
  messageListResizeObserver?.disconnect()
  messageListResizeObserver = undefined
  if (scrollRafId !== null) {
    cancelAnimationFrame(scrollRafId)
    scrollRafId = null
  }
}

onActivated(() => {
  isChatViewActive.value = true
  resetActiveStreamSplitCache()
  activeTailSegmentEl.value = null
  bindUserScrollIntent()
  reconnectMessageListResizeObserver()
  if (!chatViewWasDeactivated) {
    return
  }
  chatViewWasDeactivated = false
  const cid = contextId.value
  if (cid) {
    void showSessionView(cid)
  }
})

/** keep-alive 切走：暂停 UI 监听，不中断 WebSocket 流式 */
onDeactivated(() => {
  chatViewWasDeactivated = true
  suspendChatViewUi()
})

onUnmounted(() => {
  suspendChatViewUi()
  closeDiagramPreview()
  closeImagePreview()
  closeHtmlPreview()
})

defineExpose({
  showChatManage,
  chatManageRef,
  isBusyByState,
  getHistoryListData: () => chatManageRef.value?.getHistoryListData(),
  newChat,
  historyChat,
  removeSession: (contextId: string) => {
    evictSessionRenderCache(buildSessionKey(props.agentId, contextId))
    chatSessionRegistry.removeSession(props.agentId, contextId)
  }
})
</script>
<style scoped lang="scss">
@use '@/styles/platform' as *;
@use '../chatThinkGlow.scss' as thinkGlow;

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
    box-shadow: inset 0 1px 0 color-mix(in srgb, $pale 82%, transparent),
    inset 0 -1px 0 color-mix(in srgb, $deep 48%, transparent),
    0 6px 18px rgba(0, 0, 0, 0.16),
    0 14px 36px rgba(0, 0, 0, 0.12);
  } @else {
    box-shadow: inset 0 1px 0 color-mix(in srgb, $pale 82%, transparent),
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
      --chat-scrollbar-right-offset: calc(-1 * var(--chat-content-h-pad) + 2px);
      padding: var(--n-padding-basic) var(--chat-content-h-pad) 0;
      padding-bottom: 0;

      .chat-bottom-dock {
        left: var(--chat-content-h-pad);
        right: var(--chat-content-h-pad);
      }
    }

    .ai-logo {
      width: 160px;
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
        min-height: 120px;
        max-height: 240px;
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

    /* 窄屏：仅覆盖 inset，高度规则见全局 .input-area */
    .input-area {
      --chat-input-inset-x: 14px;
      --chat-input-inset-y: 12px;
    }
  }

  .chat-view {
    /* 固定预留：输入区浮在滚动层上方，不随 input 实时高度改变 scroll 内边距 */
    --chat-bottom-reserve: 140px;
    --chat-bottom-scroll-gap: 30px;
    /* 与 .input-area.is-input-editing 展开高度一致，按钮相对屏幕底边固定 */
    --chat-input-expanded-height: 148px;
    --chat-scroll-button-gap: 12px;
    --chat-scroll-button-offset: calc(
      var(--chat-input-expanded-height) + var(--chat-scroll-button-gap)
    );
    --chat-scrollbar-right-offset: calc(-2 * var(--n-padding-basic) + 2px);
    --chat-scrollbar-thumb: color-mix(
      in srgb,
      var(--n-color-neutral-6) 78%,
      var(--n-color-neutral-4)
    );
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
      overflow: visible;

      :deep(.el-scrollbar__view) {
        padding-bottom: calc(
          var(--chat-bottom-reserve, 260px) + var(--chat-bottom-scroll-gap, 30px)
        );
      }

      :deep(.el-scrollbar__bar.is-vertical) {
        right: var(--chat-scrollbar-right-offset);
        width: 4px;

        .el-scrollbar__thumb {
          background-color: var(--chat-scrollbar-thumb);
          opacity: 1;
        }
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
  width: 200px; // 固定宽度
  margin: 0 auto;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
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
  --chat-message-gap: 36px;
  --chat-attachment-gallery-max: 320px;
  --chat-attachment-thumb-size: 96px;
  --chat-attachment-gap: 6px;
  --chat-attachment-radius: 10px;
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

    .message-images {
      display: grid;
      gap: var(--chat-attachment-gap);
      width: fit-content;
      max-width: var(--chat-attachment-gallery-max);

      &--single {
        display: block;
        width: fit-content;
        max-width: var(--chat-attachment-gallery-max);
        line-height: 0;
      }

      &--multi {
        grid-template-columns: repeat(2, var(--chat-attachment-thumb-size));

        &.message-images--count-3,
        &.message-images--count-5,
        &.message-images--count-6,
        &.message-images--count-7,
        &.message-images--count-8,
        &.message-images--count-9 {
          grid-template-columns: repeat(3, var(--chat-attachment-thumb-size));
        }

        .message-image-wrap {
          width: var(--chat-attachment-thumb-size);
          height: var(--chat-attachment-thumb-size);
          aspect-ratio: 1;
        }

        .message-image {
          width: 100%;
          height: 100%;
          max-height: none;
          object-fit: cover;
        }
      }
    }

    .message-image-wrap {
      overflow: hidden;
      border-radius: var(--chat-attachment-radius);
      background: #fff;
      border: 1px solid color-mix(in srgb, #cbd5e1 55%, transparent);
      box-shadow: 0 1px 6px rgba(15, 23, 42, 0.06);
      line-height: 0;
    }

    .message-image {
      display: block;
      cursor: zoom-in;
      vertical-align: top;
      transition: opacity 0.2s ease;

      &:hover {
        opacity: 0.92;
      }

      &--solo {
        width: auto;
        height: auto;
        max-width: var(--chat-attachment-gallery-max);
        max-height: 320px;
        object-fit: contain;
        border-radius: var(--chat-attachment-radius);
        background: #fff;
        border: 1px solid color-mix(in srgb, #cbd5e1 55%, transparent);
        box-shadow: 0 1px 6px rgba(15, 23, 42, 0.06);
      }
    }

    .message-images--multi .message-image {
      width: 100%;
    }

    .message-content--with-media {
      align-items: flex-start;
      box-sizing: border-box;

      .message-images {
        margin-bottom: 8px;
        flex-shrink: 0;
      }

      .message-md {
        width: 100%;
        min-width: 0;
        align-self: stretch;
      }
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

          .src-file-list {
            margin: 0;
            padding-left: 1.25em;
          }

          .src-file-link {
            color: var(--n-color-link);
            text-decoration: none;

            &:hover {
              text-decoration: underline;
            }
          }

          .src-file-link--button {
            padding: 0;
            border: none;
            background: transparent;
            font: inherit;
            font-style: italic;
            cursor: pointer;
            text-align: left;
          }
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

      .message-bubble-wrap.thinking-bubble {
        overflow: visible;
      }

      .message-bubble-wrap.thinking-bubble .message-content {
        @include chat-bubble-crystal-glass(
          #f2f1ef,
          color-mix(in srgb, #f2f1ef 70%, transparent),
          color-mix(in srgb, #969088 88%, transparent),
          10px,
          false
        );
        @include thinkGlow.think-glow-ring;
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

      .message-bubble-wrap {
        grid-column: 2;
        grid-row: 1;
        justify-self: end;
        max-width: 100%;
        min-width: 0;
      }

      /* 用户气泡：天蓝水晶染色 */
      .message-content {
        width: 100%;
        min-width: 0;
        @include chat-bubble-crystal-glass(
          #d8f0ff,
          color-mix(in srgb, #5cadf2 86%, transparent),
          color-mix(in srgb, #3896d9 92%, transparent),
          10px
        );

        &--with-media {
          height: auto;
          min-height: 0;
          padding: 10px 12px;
          align-items: flex-start;
        }

        &--image-only {
          padding: 8px;

          .message-images {
            margin-bottom: 0;
          }
        }

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
  --chat-attachment-thumb-size: 96px;
  --chat-attachment-gap: 6px;
  --chat-attachment-radius: 10px;
  overflow: visible;
  display: flex;
  padding: 0;
  border-radius: 15px;
  position: relative;
  flex-wrap: wrap;
  --chat-input-inset-x: 16px;
  --chat-input-inset-y: 14px;
  --chat-input-action-size: 32px;
  --chat-input-action-gap: 8px;
  --chat-input-pad-end: calc(
    var(--chat-input-inset-x) + var(--chat-input-action-size) + var(--chat-input-action-gap)
  );
  --chat-input-pad-bottom: calc(
    var(--chat-input-inset-y) + var(--chat-input-action-size) + 2px
  );

  &:not(.is-input-editing) {
    --chat-input-pad-bottom: calc(
      var(--chat-input-inset-y) + var(--chat-input-action-size) + 2px
    );
  }

  &:not(.is-input-editing) .el-textarea.chat-input {
    :deep(.el-textarea__inner) {
      min-height: 82px;
      height: 82px !important;
      max-height: 82px;
      overflow-y: hidden;
    }
  }

  &.is-input-editing .el-textarea.chat-input {
    --chat-input-inset-y: 14px;

    :deep(.el-textarea__inner) {
      min-height: var(--chat-input-expanded-height, 148px);
      height: var(--chat-input-expanded-height, 148px) !important;
      max-height: var(--chat-input-expanded-height, 148px);
      overflow-y: auto;
    }
  }

  &.is-drag-over {
    outline: 2px dashed var(--el-color-primary);
    outline-offset: 2px;
  }

  .image-file-input {
    display: none;
  }

  .pending-images {
    display: grid;
    grid-template-columns: repeat(auto-fill, var(--chat-attachment-thumb-size, 96px));
    width: 100%;
    gap: var(--chat-attachment-gap, 6px);
    padding: 10px 12px;
    margin-bottom: 8px;
    border-radius: 15px;
    @include n-glass-surface(1);
  }

  .pending-image {
    position: relative;
    width: var(--chat-attachment-thumb-size, 96px);
    height: var(--chat-attachment-thumb-size, 96px);
    overflow: hidden;
    border-radius: var(--chat-attachment-radius, 10px);
    background: #fff;
    border: 1px solid color-mix(in srgb, #cbd5e1 55%, transparent);
    box-shadow: 0 1px 6px rgba(15, 23, 42, 0.06);

    &.is-processing {
      opacity: 0.85;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .pending-image-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.06);
      color: var(--el-color-primary);
      font-size: 22px;
    }

    button {
      position: absolute;
      top: -7px;
      right: -7px;
      width: 22px;
      height: 22px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      color: #fff;
      background: rgba(0, 0, 0, 0.68);
      cursor: pointer;

      &:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
    }
  }

  .el-button.image-button {
    position: absolute;
    left: var(--chat-input-inset-x);
    bottom: var(--chat-input-inset-y);
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--chat-input-action-size);
    height: var(--chat-input-action-size);
    padding: 0;
    margin: 0;
    border: none;
    border-radius: 50%;
    @include n-glass-surface(1);

    :deep(.el-icon) {
      font-size: 18px;
    }
  }

  .el-textarea {
    &.chat-input {
      overflow: visible;
      width: 100%;

      :deep(.el-input__count) {
        right: var(--chat-input-pad-end);
        bottom: var(--chat-input-inset-y);
        z-index: 2;
        padding: 2px 8px;
        border-radius: 8px;
        line-height: 1.4;
        @include n-glass-surface(1);
      }

      :deep(.el-textarea__inner) {
        @include n-glass-surface(2);
        box-sizing: border-box;
        padding: var(--chat-input-inset-y) var(--chat-input-pad-end) var(--chat-input-pad-bottom)
          var(--chat-input-inset-x);
        line-height: 1.5;
        font-size: var(--n-font-size-2);
        border-radius: 15px;
        word-wrap: break-word;
        word-break: break-all;
        border: none !important;
        outline: none;
        box-shadow: 0 0 12px rgba(0, 0, 0, 0.08);
        transition: box-shadow 0.2s ease,
          min-height 0.2s ease,
          height 0.2s ease,
          max-height 0.2s ease;
      }

      :deep(.el-textarea__inner::placeholder) {
        line-height: 1.5;
        color: var(--n-color-text-placeholder);
      }

      :deep(.el-textarea__inner:focus) {
        box-shadow: 0 0 10px color-mix(in srgb, var(--el-color-primary) 30%, transparent),
        0 0 24px color-mix(in srgb, var(--el-color-primary) 14%, transparent);
      }
    }
  }

  .el-button.chat-button {
    position: absolute;
    right: var(--chat-input-inset-x);
    bottom: var(--chat-input-inset-y);
    z-index: 2;
    width: var(--chat-input-action-size);
    height: var(--chat-input-action-size);
    padding: 0;
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
  transition: color 0.2s ease,
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
    background-color: var(--n-color-neutral-w, #fff);
    border: 1px solid var(--n-color-border-soft, rgba(0, 0, 0, 0.08));

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 4px;
      box-sizing: border-box;
    }
  }
}

.chat-view .scroll-to-bottom-button {
  position: absolute;
  bottom: calc(
    var(--chat-scroll-button-offset, 160px) + var(--chat-side-gutter, 20px)
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
    --chat-scrollbar-right-offset: calc(-1 * var(--chat-content-h-pad, 16px) + 2px);
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

/* 手机紧凑：与 layout.ts CHAT_MOBILE_COMPACT_MEDIA_MAX_PX（599）同步 */
@media only screen and (max-width: 600px) {
  .chat-container.is-mobile {
    --chat-content-h-pad: 12px;
    --chat-init-top-gap: 48px;
    --chat-hot-questions-width: 92%;

    .chat-view {
      --chat-bottom-reserve: 118px;
      --chat-input-expanded-height: 132px;
    }

    .ai-logo {
      width: 110px;
    }

    .ai-logo-emoji {
      font-size: 44px;
    }

    .message-init {
      padding: 8px 0;

      .title {
        font-size: 14px;
        margin-top: 10px;
      }

      .hot-questions {
        margin-top: 12px;
        padding: 10px 12px;
        font-size: 11px;
        min-height: 96px;
        max-height: 200px;

        .hot-questions-title {
          margin-bottom: 8px;
          font-size: 12px;
        }

        .question-list .question {
          margin-bottom: 8px;
          line-height: 1.4;

          .qa {
            font-size: 10px;
            height: 18px;
            line-height: 18px;
          }
        }
      }
    }

    .message-init .sub-tip {
      font-size: 14px;
    }

    .message-list {
      --chat-message-avatar-size: 32px;

      .message-row .message-content {
        padding: 8px 10px;
        min-height: 36px;
      }
    }

    .input-area {
      --chat-input-inset-x: 12px;
      --chat-input-inset-y: 10px;
      --chat-input-action-size: 28px;

      &:not(.is-input-editing) .el-textarea.chat-input {
        :deep(.el-textarea__inner) {
          min-height: 72px;
          height: 72px !important;
          max-height: 72px;
        }
      }
    }
  }
}

/* ElImageViewer 挂载到 body，需 :global 穿透 scoped */
:global(.el-image-viewer__close) {
  display: none;
}
</style>
