/** 超过该条数的历史会话启用渐进式 DOM 提交 */
export const HISTORY_PROGRESSIVE_THRESHOLD = 12

/** 单条消息内图表围栏超过该值时启用分段渐进 markdown-it */
export const HISTORY_HEAVY_DIAGRAM_THRESHOLD = 6

/** 会话内图表围栏总数超过该值时启用分段渐进 */
export const HISTORY_SESSION_HEAVY_DIAGRAM_THRESHOLD = 10

/** 历史会话首开时先挂载的最近消息条数 */
export const HISTORY_INITIAL_MESSAGE_BATCH = 4

/** 渐进式补齐时每批增加的消息条数 */
export const HISTORY_MESSAGE_BATCH_SIZE = 3

/** 分段渐进：首开先解析的已闭合围栏段数 */
export const HISTORY_PROGRESSIVE_SEGMENT_INITIAL = 3

/** 分段渐进：每批增加的已闭合围栏段数 */
export const HISTORY_PROGRESSIVE_SEGMENT_BATCH = 1

/** 渐进式恢复期间单次自动渲染的图表块上限（图表密集会话视口内也受限） */
export const HISTORY_DIAGRAM_AUTO_RENDER_LIMIT = 2

const DIAGRAM_FENCE_RE = /```(?:mermaid|vega-lite|plantuml|puml|html)\b/g

/** 统计 Markdown 中的异步图表围栏数量 */
export const countDiagramFences = (content: string): number => {
  if (!content) {
    return 0
  }
  DIAGRAM_FENCE_RE.lastIndex = 0
  let count = 0
  while (DIAGRAM_FENCE_RE.exec(content)) {
    count += 1
  }
  return count
}

/** 是否应对该会话启用渐进式消息挂载 */
export const shouldUseProgressiveHistoryRender = (
  messageCount: number,
  sessionDiagramCount = 0
): boolean =>
  messageCount > HISTORY_PROGRESSIVE_THRESHOLD ||
  sessionDiagramCount >= HISTORY_SESSION_HEAVY_DIAGRAM_THRESHOLD

/** 是否应对会话启用分段渐进（单条超长图表示例消息场景） */
export const shouldUseProgressiveSegmentRender = (
  sessionDiagramCount: number,
  maxMessageDiagramCount: number
): boolean =>
  sessionDiagramCount >= HISTORY_SESSION_HEAVY_DIAGRAM_THRESHOLD ||
  maxMessageDiagramCount >= HISTORY_HEAVY_DIAGRAM_THRESHOLD

/** 首开渐进式渲染时的初始可见条数 */
export const initialProgressiveHistoryLimit = (messageCount: number): number =>
  Math.min(HISTORY_INITIAL_MESSAGE_BATCH, messageCount)

/** 首开分段渐进时的初始已闭合段数 */
export const initialProgressiveSegmentLimit = (completeSegmentCount: number): number =>
  Math.min(HISTORY_PROGRESSIVE_SEGMENT_INITIAL, completeSegmentCount)

/** 根据渐进式 limit 截取应进入 DOM 的消息（保留最近 limit 条） */
export const sliceMessagesForProgressiveRender = <T>(
  messages: readonly T[],
  limit: number | null
): T[] => {
  if (limit === null || messages.length <= limit) {
    return [...messages]
  }
  return messages.slice(-limit)
}

/** 计算下一批渐进式 limit；返回 null 表示已全部挂载 */
export const nextProgressiveHistoryLimit = (
  currentLimit: number,
  totalCount: number,
  batchSize = HISTORY_MESSAGE_BATCH_SIZE
): number | null => {
  const next = currentLimit + batchSize
  if (next >= totalCount) {
    return null
  }
  return next
}

/**
 * 推进分段渐进 limit（只增不减）。
 * 返回 null 表示已全部解析完毕；返回 totalCompleteSegments 表示已达上限，下一轮应置 null。
 */
export const advanceProgressiveSegmentLimit = (
  currentLimit: number,
  totalCompleteSegments: number,
  batchSize = HISTORY_PROGRESSIVE_SEGMENT_BATCH
): number | null => {
  if (currentLimit >= totalCompleteSegments) {
    return null
  }
  return Math.min(currentLimit + batchSize, totalCompleteSegments)
}

/** 消息批次扩展后，分段 limit 只允许递增，避免已解析段被回退 */
export const mergeProgressiveSegmentLimit = (
  currentLimit: number | null,
  totalCompleteSegments: number
): number => {
  const baseline = initialProgressiveSegmentLimit(totalCompleteSegments)
  if (currentLimit === null) {
    return baseline
  }
  return Math.max(currentLimit, baseline)
}

/** @deprecated 使用 advanceProgressiveSegmentLimit */
export const nextProgressiveSegmentLimit = (
  currentLimit: number,
  totalCompleteSegments: number,
  batchSize = HISTORY_PROGRESSIVE_SEGMENT_BATCH
): number | null => {
  const next = advanceProgressiveSegmentLimit(
    currentLimit,
    totalCompleteSegments,
    batchSize
  )
  if (next === null || next >= totalCompleteSegments) {
    return null
  }
  return next
}

/** 滚动位置补偿：向列表顶部追加消息后保持视口锚点 */
export const computeScrollTopAfterPrepend = (
  previousScrollTop: number,
  previousScrollHeight: number,
  nextScrollHeight: number
): number => {
  const delta = nextScrollHeight - previousScrollHeight
  return delta > 0 ? previousScrollTop + delta : previousScrollTop
}
