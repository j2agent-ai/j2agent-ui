import MarkdownIt from 'markdown-it'
import { normalizeMarkdownRepoFileUrls, normalizeRepoFileUrl } from './repoFileUrl'
import {
  DIAGRAM_COLOR_PALETTE,
  DIAGRAM_FONT_FAMILY,
  getMermaidThemeCss,
  getMermaidThemeVariables,
  getVegaLiteEmbedConfig,
  injectPlantUmlTheme
} from './diagramTheme'

type MermaidModule = {
  default?: MermaidApi
} & MermaidApi

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void
  parse: (
    text: string,
    options?: { suppressErrors?: boolean }
  ) => Promise<unknown>
  render: (
    id: string,
    text: string
  ) => Promise<{ svg: string; bindFunctions?: (element: Element) => void }>
}

type PlantUmlRenderer = (source: string) => Promise<string>

/** vega-embed 嵌入函数类型 */
type VegaEmbedFn = (
  element: HTMLElement,
  spec: Record<string, unknown>,
  options?: Record<string, unknown>
) => Promise<unknown>

const MARKDOWN_RENDER_ATTR = 'data-md-render'
const MARKDOWN_RENDERED_ATTR = 'data-md-rendered'
const MARKDOWN_RENDERING_ATTR = 'data-md-rendering'
const MARKDOWN_REVISION_ATTR = 'data-md-revision'
/**
 * 图表后处理逻辑变更时递增，用于让历史气泡在 SPA 内重新渲染（非 Mermaid 缓存）。
 * 与 ChatView 中 v-html 的 :key 保持一致。
 */
export const MARKDOWN_RENDERER_REVISION = '24'
/** 与 markdown.scss 中 --md-diagram-max-height 回退值保持一致 */
const MARKDOWN_DIAGRAM_MAX_HEIGHT_FALLBACK = 360
/** 与 markdown.scss 中 --md-html-preview-max-height 回退值保持一致 */
const MARKDOWN_HTML_PREVIEW_MAX_HEIGHT_FALLBACK = 300
/** 缩略图测量高度余量，避免 margin/box-shadow/缩放取整裁切底部 */
const HTML_PREVIEW_THUMB_MEASURE_PADDING = 20
/** body 垂直内边距合计（padding-top + padding-bottom，各 14px） */
const MARKDOWN_DIAGRAM_BODY_PADDING_VERTICAL = 28
/** body 水平内边距合计（padding-left + padding-right，各 16px） */
const MARKDOWN_DIAGRAM_BODY_PADDING_HORIZONTAL = 32
/** xychart 类目数达到该阈值且未声明 horizontal 时，自动改为横向条形图 */
const XYCHART_HORIZONTAL_MIN_CATEGORIES = 11
/** 横向条形图每行类目预留高度（px），用于拉高容器减少行挤压 */
const XYCHART_HORIZONTAL_ROW_MIN_HEIGHT = 22
/** 竖向图底部标签换行时的行高系数 */
const XYCHART_LABEL_LINE_HEIGHT_RATIO = 1.25
/** 换行后 viewBox / 容器底部预留（px） */
const XYCHART_WRAPPED_LABEL_BOTTOM_PAD = 20
/** Vega-Lite 多类目时自动倾斜 X 轴标签的阈值 */
const VEGA_LITE_MULTI_CATEGORY_THRESHOLD = 8

const diagramFitObservers = new WeakMap<HTMLElement, ResizeObserver>()
const diagramFitRafIds = new WeakMap<HTMLElement, number>()
let diagramWindowResizeBound = false
let diagramWindowResizeRaf = 0
let diagramMaxHeightCache = 0
let htmlPreviewMaxHeightCache = 0

/** 读取 CSS 变量高度的解析结果（px） */
const readMarkdownCssHeight = (cssVar: string, fallback: number) => {
  if (typeof document === 'undefined') {
    return fallback
  }
  const root =
    (document.querySelector('.message-md') as HTMLElement | null) ||
    document.documentElement
  const probe = document.createElement('div')
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;height:${cssVar}`
  root.appendChild(probe)
  const height = Math.round(probe.getBoundingClientRect().height)
  root.removeChild(probe)
  return height > 0 ? height : fallback
}

/** 读取 CSS 变量 --md-diagram-max-height 的解析结果（px） */
const getMarkdownDiagramMaxHeight = () => {
  if (diagramMaxHeightCache > 0) {
    return diagramMaxHeightCache
  }
  diagramMaxHeightCache = readMarkdownCssHeight(
    'var(--md-diagram-max-height)',
    MARKDOWN_DIAGRAM_MAX_HEIGHT_FALLBACK
  )
  return diagramMaxHeightCache
}

/** 读取 CSS 变量 --md-html-preview-max-height 的解析结果（px） */
const getMarkdownHtmlPreviewMaxHeight = () => {
  if (htmlPreviewMaxHeightCache > 0) {
    return htmlPreviewMaxHeightCache
  }
  htmlPreviewMaxHeightCache = readMarkdownCssHeight(
    'var(--md-html-preview-max-height)',
    MARKDOWN_HTML_PREVIEW_MAX_HEIGHT_FALLBACK
  )
  return htmlPreviewMaxHeightCache
}

/** 图表内容区最大高度（扣除 body 垂直内边距） */
const getDiagramContentMaxHeight = () =>
  getMarkdownDiagramMaxHeight() - MARKDOWN_DIAGRAM_BODY_PADDING_VERTICAL

/** 窗口尺寸变化后需重新解析 vh 上限 */
const invalidateDiagramMaxHeightCache = () => {
  diagramMaxHeightCache = 0
  htmlPreviewMaxHeightCache = 0
}

/** 断开图表容器的尺寸监听 */
const disconnectDiagramFitObserver = (body: HTMLElement) => {
  const observer = diagramFitObservers.get(body)
  if (observer) {
    observer.disconnect()
    diagramFitObservers.delete(body)
  }
  const rafId = diagramFitRafIds.get(body)
  if (rafId) {
    cancelAnimationFrame(rafId)
    diagramFitRafIds.delete(body)
  }
}

/**
 * 确保 SVG 外包一层 `.md-diagram-fit` 用于同步占位高度。
 *
 * 注意：SVG 不一定是 body 的直接子节点（如 Vega-Lite 的结构是
 * `body > .md-vegalite-host > .vega-embed > svg`）。此时旧实现用
 * `body.insertBefore(wrap, svg)` 会抛 NotFoundError（参照节点非 body 子节点），
 * 导致整个 fit 中断、容器不被撑开/缩放、图被 max-height 裁掉。
 * 改为「wrap 追加到 body，再把 svg 移入 wrap」，无论 svg 原先嵌套多深都安全。
 */
const ensureDiagramFitWrapper = (body: HTMLElement, svg: SVGElement) => {
  let wrap = body.querySelector(
    ':scope > .md-diagram-fit'
  ) as HTMLElement | null
  if (!wrap) {
    wrap = document.createElement('div')
    wrap.className = 'md-diagram-fit'
    body.appendChild(wrap)
  }
  if (svg.parentNode !== wrap) {
    wrap.appendChild(svg)
  }
  return wrap
}

/**
 * 读取 SVG 自然尺寸（优先 viewBox，其次 width/height 属性，再 getBBox）。
 */
const getSvgNaturalSize = (svg: SVGElement) => {
  const viewBox = svg.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map((value) => Number(value))
    if (parts.length === 4 && parts.every((value) => !Number.isNaN(value))) {
      return { width: parts[2], height: parts[3] }
    }
  }

  const widthAttr = Number.parseFloat(svg.getAttribute('width') || '')
  const heightAttr = Number.parseFloat(svg.getAttribute('height') || '')
  if (widthAttr > 0 && heightAttr > 0) {
    return { width: widthAttr, height: heightAttr }
  }

  try {
    const box = (svg as SVGGraphicsElement).getBBox()
    if (box.width > 0 && box.height > 0) {
      return { width: box.width, height: box.height }
    }
  } catch {
    /* SVG 尚未参与布局时 getBBox 可能失败 */
  }

  const rect = svg.getBoundingClientRect()
  return {
    width: Math.max(rect.width, 1),
    height: Math.max(rect.height, 1)
  }
}

/**
 * 按 SVG 自然尺寸等比缩放至气泡内容区宽高上限内，容器高度贴合缩放后尺寸。
 * 宽度始终不超过气泡，不出现横向滚动条。
 */
const fitDiagramSvgInBody = (body: HTMLElement) => {
  const svg = body.querySelector('svg')
  if (!svg || !(svg instanceof SVGElement)) {
    return
  }

  const block = body.closest('.md-diagram') as HTMLElement | null
  const maxBodyHeight = getMarkdownDiagramMaxHeight()
  const contentMaxHeight = getDiagramContentMaxHeight()
  const wrap = ensureDiagramFitWrapper(body, svg)
  const natural = getSvgNaturalSize(svg)

  const bodyWidth = Math.max(
    body.clientWidth - MARKDOWN_DIAGRAM_BODY_PADDING_HORIZONTAL,
    120
  )
  const scaleWidth = bodyWidth / natural.width
  const isVerticalWrapped =
    block?.classList.contains('md-diagram-xychart--vertical') &&
    svg.querySelector('g.bottom-axis g.label text tspan') !== null

  let scale = Math.min(1, scaleWidth, contentMaxHeight / natural.height)
  if (isVerticalWrapped) {
    // 底部多行标签：不再按默认高度上限压扁，完整展示后再由容器增高
    scale = Math.min(1, scaleWidth)
  }

  const displayWidth = Math.max(1, Math.ceil(natural.width * scale))
  const displayHeight = Math.max(1, Math.ceil(natural.height * scale))
  const effectiveMaxBodyHeight = isVerticalWrapped
    ? Math.max(maxBodyHeight, displayHeight + MARKDOWN_DIAGRAM_BODY_PADDING_VERTICAL)
    : maxBodyHeight

  svg.style.transform = ''
  svg.style.transformOrigin = ''
  svg.style.display = 'block'
  svg.style.margin = '0 auto'
  svg.style.boxSizing = 'border-box'
  svg.style.maxWidth = 'none'
  svg.style.maxHeight = 'none'
  svg.style.width = `${displayWidth}px`
  svg.style.height = `${displayHeight}px`

  wrap.style.width = `${displayWidth}px`
  wrap.style.maxWidth = '100%'
  wrap.style.maxHeight = `${displayHeight}px`
  wrap.style.overflow = 'hidden'
  wrap.style.margin = '0 auto'
  wrap.style.lineHeight = '0'
  wrap.style.height = `${displayHeight}px`

  const bodyHeight = displayHeight + MARKDOWN_DIAGRAM_BODY_PADDING_VERTICAL
  body.style.boxSizing = 'border-box'
  body.style.maxHeight = `${effectiveMaxBodyHeight}px`
  body.style.height = `${bodyHeight}px`
  body.style.overflowY =
    isVerticalWrapped && bodyHeight > maxBodyHeight ? 'auto' : 'hidden'
  body.classList.remove('md-diagram-body--wide')
  body.style.overflowX = 'hidden'
  body.style.overflow = 'hidden'

  if (block) {
    block.style.maxHeight = `${effectiveMaxBodyHeight}px`
    block.style.height = `${bodyHeight}px`
    if (isVerticalWrapped) {
      block.style.overflowX = 'hidden'
      block.style.overflowY =
        bodyHeight > maxBodyHeight ? 'auto' : 'hidden'
    } else {
      block.style.overflow = 'hidden'
    }
  }
}

/** 延迟测量，确保宽度变化后浏览器已完成 SVG 布局 */
const scheduleFitDiagramSvgReflow = (body: HTMLElement) => {
  const prev = diagramFitRafIds.get(body)
  if (prev) {
    cancelAnimationFrame(prev)
  }
  diagramFitRafIds.set(
    body,
    requestAnimationFrame(() => {
      fitDiagramSvgInBody(body)
      requestAnimationFrame(() => {
        diagramFitRafIds.delete(body)
        fitDiagramSvgInBody(body)
      })
    })
  )
}

/** 窗口尺寸变化时重算所有图表外框（侧栏收起/拉宽等场景） */
const bindDiagramWindowResize = () => {
  if (diagramWindowResizeBound || typeof window === 'undefined') {
    return
  }
  diagramWindowResizeBound = true
  window.addEventListener('resize', () => {
    invalidateDiagramMaxHeightCache()
    cancelAnimationFrame(diagramWindowResizeRaf)
    diagramWindowResizeRaf = requestAnimationFrame(() => {
      document
        .querySelectorAll<HTMLElement>('.md-diagram-body')
        .forEach((el) => {
          scheduleFitDiagramSvgReflow(el)
        })
    })
  })
}

/** 监听图表块与 body 宽度变化，拉宽时重新收紧外框高度 */
const observeDiagramBodyResize = (body: HTMLElement) => {
  bindDiagramWindowResize()
  disconnectDiagramFitObserver(body)
  if (typeof ResizeObserver === 'undefined') {
    return
  }
  const block = body.closest('.md-diagram') as HTMLElement | null
  const observer = new ResizeObserver(() => scheduleFitDiagramSvgReflow(body))
  observer.observe(body)
  if (block) {
    observer.observe(block)
  }
  const messageContent = body.closest('.message-md, .message-content') as HTMLElement | null
  if (messageContent) {
    observer.observe(messageContent)
  }
  diagramFitObservers.set(body, observer)
}

/** 布局稳定后再测量并适配 SVG */
const scheduleFitDiagramSvg = (body: HTMLElement) => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fitDiagramSvgInBody(body)
      observeDiagramBodyResize(body)
    })
  })
}

let mermaidApi: MermaidApi | undefined
let mermaidSeq = 0
let plantUmlRenderer: PlantUmlRenderer | undefined
let plantUmlModuleLoad: Promise<PlantUmlRenderer> | undefined
let vegaEmbedFn: VegaEmbedFn | undefined

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
})

const escapeHtml = (value: string) => md.utils.escapeHtml(value)

const normalizeFenceLanguage = (info?: string) =>
  (info || '').trim().split(/\s+/)[0]?.toLowerCase() || ''

/** 异步块占位：spinner + 生成中 + 跳动省略号 */
const renderGeneratingHintHtml = () =>
  [
    '<span class="md-block-generating" role="status" aria-live="polite">',
    '<span class="md-block-generating-text">生成中</span>',
    '<span class="md-block-generating-dots" aria-hidden="true">',
    '<span>.</span><span>.</span><span>.</span>',
    '</span>',
    '</span>'
  ].join('')

/** innerHTML / replaceChildren 不会清掉容器上的 pending 类，渲染成功后须显式移除 */
const clearDiagramBodyPending = (body: HTMLElement) => {
  body.classList.remove('md-block-pending')
}

const renderDiagramPlaceholder = (
  type: 'mermaid' | 'plantuml' | 'vegalite',
  source: string
) => {
  const escapedSource = escapeHtml(source)
  return [
    `<div class="md-diagram md-diagram-${type}" ${MARKDOWN_RENDER_ATTR}="${type}" ${MARKDOWN_REVISION_ATTR}="${MARKDOWN_RENDERER_REVISION}">`,
    `<pre class="md-diagram-source" hidden>${escapedSource}</pre>`,
    `<div class="md-diagram-body md-block-pending">${renderGeneratingHintHtml()}</div>`,
    '</div>'
  ].join('')
}

const renderHtmlPreviewPlaceholder = (source: string) => {
  const escapedSource = escapeHtml(source)
  return [
    `<div class="md-html-block" ${MARKDOWN_RENDER_ATTR}="html">`,
    `<pre class="md-diagram-source" hidden>${escapedSource}</pre>`,
    '<div class="md-html-preview-wrap md-block-pending" role="region" aria-label="HTML 预览">',
    '<iframe class="md-html-preview" sandbox="allow-same-origin allow-scripts allow-forms allow-popups" scrolling="no" title="HTML 预览"></iframe>',
    renderGeneratingHintHtml(),
    '</div>',
    '</div>'
  ].join('')
}

const defaultFence = md.renderer.rules.fence?.bind(md.renderer.rules)

const MD_CODE_COPY_ICON =
  '<svg class="md-code-copy-icon" viewBox="0 0 1024 1024" width="11" height="11" aria-hidden="true"><path fill="currentColor" d="M768 832H256c-35.3 0-64-28.7-64-64V256c0-35.3 28.7-64 64-64h512c35.3 0 64 28.7 64 64v512c0 35.3-28.7 64-64 64zM704 192H320c-17.7 0-32 14.3-32 32v448c0 17.7 14.3 32 32 32h384c17.7 0 32-14.3 32-32V224c0-17.7-14.3-32-32-32zM448 320h128v64H448v-64z"/></svg>'

/** 普通围栏代码块：顶部语言头 + 底部安全区复制按钮 */
const wrapFenceCodeBlock = (preHtml: string, lang: string) => {
  const label = escapeHtml(lang || 'text')
  return [
    '<div class="md-code-block">',
    '<div class="md-code-block-head">',
    `<span class="md-code-lang">${label}</span>`,
    '</div>',
    preHtml,
    '<div class="md-code-block-foot">',
    '<button type="button" class="md-code-copy" aria-label="复制代码" title="复制">',
    MD_CODE_COPY_ICON,
    '</button>',
    '</div>',
    '</div>'
  ].join('')
}

md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const lang = normalizeFenceLanguage(token.info)

  if (lang === 'html') {
    return renderHtmlPreviewPlaceholder(token.content)
  }

  if (lang === 'mermaid') {
    return renderDiagramPlaceholder('mermaid', token.content)
  }

  if (lang === 'puml' || lang === 'plantuml') {
    return renderDiagramPlaceholder('plantuml', token.content)
  }

  if (lang === 'vega-lite' || lang === 'vegalite') {
    return renderDiagramPlaceholder('vegalite', token.content)
  }

  if (defaultFence) {
    return wrapFenceCodeBlock(
      defaultFence(tokens, idx, options, env, self),
      lang
    )
  }

  return wrapFenceCodeBlock(self.renderToken(tokens, idx, options), lang)
}

/** 从 `.md-code-block` 读取可复制文本 */
export const getMarkdownCodeBlockText = (block: Element) => {
  const pre = block.querySelector('pre')
  if (!pre) {
    return ''
  }
  return pre.querySelector('code')?.textContent ?? pre.textContent ?? ''
}

const MD_P_IMAGE_CLASS = 'md-p-image'

md.renderer.rules.paragraph_open = function () {
  return '<p style="line-height: var(--n-font-line-height-4);">'
}

md.renderer.rules.link_open = function(tokens, idx, options, env, self) {
  tokens[idx].attrPush(['target', '_blank'])
  tokens[idx].attrPush(['rel', 'noopener noreferrer'])
  return self.renderToken(tokens, idx, options)
}

md.renderer.rules.table_open = function() {
  return '<div class="md-table-wrap"><table class="md-table">'
}
md.renderer.rules.table_close = function() {
  return '</table></div>'
}
md.renderer.rules.thead_open = function() {
  return '<thead class="md-thead">'
}
md.renderer.rules.tbody_open = function() {
  return '<tbody class="md-tbody">'
}
md.renderer.rules.tr_open = function() {
  return '<tr class="md-tr">'
}
md.renderer.rules.th_open = function() {
  return '<th class="md-th">'
}
md.renderer.rules.td_open = function() {
  return '<td class="md-td">'
}

export const renderMarkdown = (markdown?: string) =>
  md.render(normalizeMarkdownRepoFileUrls(markdown || ''))

/** 流式尾段中可由 renderMarkdownBlocks 异步渲染的围栏语言 */
const ASYNC_DIAGRAM_FENCE_LANGS = new Set([
  'mermaid',
  'puml',
  'plantuml',
  'vegalite',
  'vega-lite',
  'html'
])

/**
 * 尾段是否仍含未闭合的异步图表/HTML 围栏（markdown-it 将未闭合围栏延伸至 EOF）。
 */
export const hasOpenAsyncDiagramFence = (text: string): boolean => {
  if (!text?.trim()) {
    return false
  }
  let inFence = false
  let openLen = 0
  let openChar = ''
  let lang = ''
  const lineRe = /^([ \t]*)(`{3,}|~{3,})(.*)$/gm
  let match: RegExpExecArray | null
  while ((match = lineRe.exec(text)) !== null) {
    const marker = match[2]
    const info = match[3].trim()
    const char = marker[0]
    const len = marker.length
    if (!inFence) {
      inFence = true
      openChar = char
      openLen = len
      lang = info.split(/\s+/)[0]?.toLowerCase() || ''
      continue
    }
    if (char === openChar && len >= openLen && !info) {
      inFence = false
      lang = ''
    }
  }
  return inFence && ASYNC_DIAGRAM_FENCE_LANGS.has(lang)
}

const isPendingAsyncMarkdownBlock = (block: Element): boolean => {
  const type = block.getAttribute(MARKDOWN_RENDER_ATTR)
  if (!type || !ASYNC_DIAGRAM_FENCE_LANGS.has(type)) {
    return false
  }
  return block.querySelector('.md-block-pending') !== null
}

const findPendingAsyncMarkdownBlock = (root: ParentNode): Element | null => {
  for (const block of root.querySelectorAll(`[${MARKDOWN_RENDER_ATTR}]`)) {
    if (isPendingAsyncMarkdownBlock(block)) {
      return block
    }
  }
  return null
}

const childNodesBefore = (parent: Element, anchor: Element): ChildNode[] => {
  const nodes: ChildNode[] = []
  for (const node of parent.childNodes) {
    if (node === anchor) {
      break
    }
    nodes.push(node)
  }
  return nodes
}

const serializeChildNodes = (nodes: ChildNode[]): string =>
  nodes
    .map((node) =>
      node instanceof Element ? node.outerHTML : node.textContent ?? ''
    )
    .join('')

const syncBlockSource = (target: Element, source: Element) => {
  const nextSource =
    source.querySelector('.md-diagram-source')?.textContent ?? ''
  const targetSource = target.querySelector('.md-diagram-source')
  if (targetSource) {
    targetSource.textContent = nextSource
  }
}

const syncChildNodesBefore = (
  root: HTMLElement,
  oldAnchor: Element,
  template: HTMLElement,
  newAnchor: Element
) => {
  const oldBefore = childNodesBefore(root, oldAnchor)
  const newBefore = childNodesBefore(template, newAnchor)
  if (serializeChildNodes(oldBefore) === serializeChildNodes(newBefore)) {
    return
  }
  oldBefore.forEach((node) => node.remove())
  const fragment = document.createDocumentFragment()
  newBefore.forEach((node) => fragment.appendChild(node.cloneNode(true)))
  root.insertBefore(fragment, oldAnchor)
}

const removeChildNodesAfter = (root: HTMLElement, anchor: Element) => {
  let next = anchor.nextSibling
  while (next) {
    const toRemove = next
    next = next.nextSibling
    toRemove.remove()
  }
}

const replaceRootChildren = (root: HTMLElement, template: HTMLElement) => {
  root.replaceChildren(
    ...Array.from(template.childNodes).map((node) => node.cloneNode(true))
  )
}

/**
 * 流式尾段就地更新：pending 图表/HTML 占位节点保留在文档中，仅同步前缀与 hidden source，
 * 避免 v-html 整段替换导致流光动画重启。
 */
export const updateStreamTailSegmentInPlace = (
  root: HTMLElement,
  markdown: string,
  appendEllipsis = false
): void => {
  const text = markdown + (appendEllipsis ? '...' : '')
  const template = document.createElement('div')
  template.innerHTML = renderMarkdown(text)

  const oldPending = findPendingAsyncMarkdownBlock(root)
  const newPending = findPendingAsyncMarkdownBlock(template)

  if (oldPending && newPending && hasOpenAsyncDiagramFence(markdown)) {
    syncChildNodesBefore(root, oldPending, template, newPending)
    syncBlockSource(oldPending, newPending)
    removeChildNodesAfter(root, oldPending)
    return
  }

  replaceRootChildren(root, template)
}

/** 聊天页 idle 预加载 mermaid/vega/plantuml，降低首图冷启动延迟 */
export const preloadDiagramRuntimes = () => {
  void getMermaidApi()
  void getVegaEmbed().catch(() => {})
  void getPlantUmlRenderer().catch(() => {})
}

/** 异步渲染 Markdown 图表块时的选项 */
export type RenderMarkdownBlocksOptions = {
  /**
   * 为 true 时，仅跳过仍处于流式尾段（带 data-md-stream-tail 标记的容器内、围栏尚未闭合）的
   * mermaid/plantuml/vegalite/html 块；已闭合的块照常立即渲染。用于 LLM 流式输出避免逐 token 重渲染抽搐。
   */
  deferDiagrams?: boolean
  /** 并发渲染图表块上限，默认 2 */
  concurrency?: number
}

const DEFAULT_DIAGRAM_RENDER_CONCURRENCY = 2

/** 待渲染块：未渲染或 revision 落后于当前渲染器版本 */
const buildPendingBlocksSelector = () =>
  `[${MARKDOWN_RENDER_ATTR}]:not([${MARKDOWN_RENDERED_ATTR}="true"]), ` +
  `[${MARKDOWN_RENDER_ATTR}][${MARKDOWN_RENDERED_ATTR}="true"]:not([${MARKDOWN_REVISION_ATTR}="${MARKDOWN_RENDERER_REVISION}"])`

const mapWithConcurrency = async <T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
) => {
  if (items.length === 0) {
    return
  }
  const concurrency = Math.max(1, limit)
  const executing = new Set<Promise<void>>()
  for (const item of items) {
    const task = fn(item).finally(() => {
      executing.delete(task)
    })
    executing.add(task)
    if (executing.size >= concurrency) {
      await Promise.race(executing)
    }
  }
  await Promise.all(executing)
}

const refitDiagramBodies = (bodies: HTMLElement[]) => {
  bodies.forEach((body) => {
    scheduleFitDiagramSvgReflow(body)
  })
}

const getSourceFromBlock = (block: Element) =>
  block.querySelector<HTMLElement>('.md-diagram-source')?.textContent || ''

/** 读取 HTML 预览块源码（隐藏 pre） */
export const getMarkdownHtmlBlockSource = (block: Element) =>
  getSourceFromBlock(block)

/** 构建 HTML 预览 iframe 的 srcdoc */
export const buildMarkdownHtmlPreviewSrcdoc = (source: string) =>
  buildHtmlPreviewDocument(source)

/**
 * 为 pie 图中未加引号的扇区标签补引号（含括号、空格时 lexer 会失败）。
 */
const quotePieSliceLines = (source: string) => {
  if (!/^\s*pie\b/im.test(source)) {
    return source
  }
  return source
    .split('\n')
    .map((line) => {
      const match = line.match(/^(\s*)(.+?)\s*:\s*([\d.]+)\s*$/)
      if (!match) {
        return line
      }
      const [, indent, label, value] = match
      const trimmed = label.trim()
      if (/^title\b/i.test(trimmed)) {
        return line
      }
      const unquoted = trimmed.replace(/^\\?["']|["']$/g, '').trim()
      if (!unquoted) {
        return line
      }
      return `${indent}"${unquoted}" : ${value}`
    })
    .join('\n')
}

/** 统计方括号列表中的项数（尊重引号内的逗号）。 */
const countBracketListItems = (listContent: string) => {
  let count = 0
  let depth = 0
  let inQuote: '"' | '\'' | null = null
  let hasContent = false

  for (let i = 0; i < listContent.length; i++) {
    const ch = listContent[i]
    if (inQuote) {
      if (ch === inQuote && listContent[i - 1] !== '\\') {
        inQuote = null
      }
      if (!inQuote) {
        hasContent = true
      }
      continue
    }
    if (ch === '"' || ch === '\'') {
      inQuote = ch
      continue
    }
    if (ch === '[') {
      depth++
      hasContent = true
      continue
    }
    if (ch === ']') {
      depth = Math.max(0, depth - 1)
      continue
    }
    if (ch === ',' && depth === 0) {
      if (hasContent) {
        count++
      }
      hasContent = false
      continue
    }
    if (!/\s/.test(ch)) {
      hasContent = true
    }
  }
  if (hasContent) {
    count++
  }
  return count
}

/** xychart 声明首行（仅该行可携带 horizontal 关键字）。 */
const getXychartDeclarationLine = (source: string) =>
  source.match(/^\s*xychart(?:-beta)?[^\n]*/im)?.[0] ?? ''

/** 解析 xychart 的 x-axis 类目数量。 */
const countXychartCategories = (source: string) => {
  const match = source.match(/^\s*x-axis\b[^\[]*\[([\s\S]*?)\]/im)
  if (!match) {
    return 0
  }
  return countBracketListItems(match[1])
}

/** 解析 xychart 的 bar 数据点数量。 */
const countXychartBarValues = (source: string) => {
  const match = source.match(/^\s*bar\b[^\[]*\[([\s\S]*?)\]/im)
  if (!match) {
    return 0
  }
  return countBracketListItems(match[1])
}

/** 类目计数取 x-axis 与 bar 的较大值，避免「标题 TOP15、x-axis 仅 10 项」漏触发横向。 */
const getXychartCategoryCount = (source: string) =>
  Math.max(countXychartCategories(source), countXychartBarValues(source))

/**
 * 多类目竖向 xychart 自动改为 horizontal，避免 X 轴标签重叠。
 */
const normalizeXychartOrientation = (source: string) => {
  if (!/^\s*xychart(?:-beta)?\b/im.test(source)) {
    return source
  }
  if (/\bhorizontal\b/i.test(getXychartDeclarationLine(source))) {
    return source
  }
  if (getXychartCategoryCount(source) < XYCHART_HORIZONTAL_MIN_CATEGORIES) {
    return source
  }
  return source.replace(
    /^(\s*xychart(?:-beta)?)(?!\s+horizontal)\b/im,
    '$1 horizontal'
  )
}

const isXychartSource = (source: string) =>
  /^\s*xychart(?:-beta)?\b/im.test(source)

const isXychartHorizontal = (source: string) =>
  isXychartSource(source) &&
  /\bhorizontal\b/i.test(getXychartDeclarationLine(source))

let textMeasureCanvas: HTMLCanvasElement | undefined

/** 解析 Mermaid text 节点 transform 中的 translate(x, y)。 */
const parseSvgTranslate = (transform: string) => {
  const match = transform.match(
    /translate\(\s*([-\d.]+)(?:[,\s]+([-\d.]+))?\s*\)/
  )
  if (!match) {
    return null
  }
  return {
    x: Number.parseFloat(match[1]),
    y: Number.parseFloat(match[2] ?? '0')
  }
}

const measureSvgTextWidth = (text: string, fontSize: number) => {
  if (typeof document === 'undefined') {
    return text.length * fontSize * 0.6
  }
  if (!textMeasureCanvas) {
    textMeasureCanvas = document.createElement('canvas')
  }
  const ctx = textMeasureCanvas.getContext('2d')
  if (!ctx) {
    return text.length * fontSize * 0.6
  }
  ctx.font = `${fontSize}px ${DIAGRAM_FONT_FAMILY}`
  return ctx.measureText(text).width
}

/** 按最大宽度将标签拆成多行（中文逐字、英文按词）。 */
const wrapLabelTextToLines = (
  text: string,
  maxWidth: number,
  fontSize: number
) => {
  if (!text || maxWidth <= 0) {
    return [text]
  }
  if (measureSvgTextWidth(text, fontSize) <= maxWidth) {
    return [text]
  }

  const lines: string[] = []
  let current = ''
  const flush = () => {
    if (current) {
      lines.push(current)
      current = ''
    }
  }

  for (const segment of text.split(/(\s+)/).filter((part) => part.length > 0)) {
    if (/^\s+$/.test(segment)) {
      const trial = current + segment
      if (measureSvgTextWidth(trial, fontSize) <= maxWidth) {
        current = trial
      } else {
        flush()
      }
      continue
    }

    for (const char of segment) {
      const trial = current + char
      if (measureSvgTextWidth(trial, fontSize) > maxWidth && current) {
        flush()
        current = char
      } else {
        current = trial
      }
    }
  }
  flush()
  return lines.length ? lines : [text]
}

/** 估算竖向 xychart 每个类目在 X 轴下的可用标签宽度。 */
const getVerticalXychartLabelSlotWidth = (svg: SVGElement) => {
  const labels = Array.from(
    svg.querySelectorAll<SVGTextElement>('g.bottom-axis g.label text')
  )
  if (!labels.length) {
    return 72
  }

  const xs = labels
    .map((node) => parseSvgTranslate(node.getAttribute('transform') || '')?.x)
    .filter((x): x is number => typeof x === 'number' && !Number.isNaN(x))
    .sort((a, b) => a - b)

  if (xs.length >= 2) {
    const gaps: number[] = []
    for (let i = 1; i < xs.length; i++) {
      gaps.push(xs[i] - xs[i - 1])
    }
    const medianGap = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
    return Math.max(48, medianGap * 0.88)
  }

  const viewBox = svg.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
      return Math.max(48, (parts[2] / labels.length) * 0.75)
    }
  }

  return 72
}

const applyWrappedLabelTspans = (
  textEl: SVGTextElement,
  lines: string[],
  fontSize: number
) => {
  const lineHeight = fontSize * XYCHART_LABEL_LINE_HEIGHT_RATIO
  while (textEl.firstChild) {
    textEl.removeChild(textEl.firstChild)
  }
  lines.forEach((line, index) => {
    const tspan = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'tspan'
    )
    tspan.setAttribute('x', '0')
    tspan.setAttribute('dy', index === 0 ? '0' : `${lineHeight}px`)
    tspan.textContent = line
    textEl.appendChild(tspan)
  })
}

/** 竖向 xychart：底部横向类目标签超宽时换行（tspan）。 */
const wrapXychartVerticalCategoryLabels = (svg: SVGElement) => {
  const maxWidth = getVerticalXychartLabelSlotWidth(svg)
  svg.querySelectorAll<SVGTextElement>('g.bottom-axis g.label text').forEach(
    (textEl) => {
      const raw = textEl.textContent?.trim()
      if (!raw) {
        return
      }
      const fontSize =
        Number.parseFloat(textEl.getAttribute('font-size') || '') || 14
      const lines = wrapLabelTextToLines(raw, maxWidth, fontSize)
      if (lines.length <= 1) {
        return
      }
      applyWrappedLabelTspans(textEl, lines, fontSize)
    }
  )
}

/** 换行后扩展 SVG 底部空间（布局完成后再测量）。 */
const expandXychartViewBoxForWrappedLabels = (svg: SVGElement) => {
  const viewBox = svg.getAttribute('viewBox')
  if (!viewBox) {
    return false
  }
  const parts = viewBox
    .trim()
    .split(/[\s,]+/)
    .map((value) => Number(value))
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
    return false
  }
  const [minX, minY, width, height] = parts
  let maxExtent = minY + height

  try {
    const fullBox = svg.getBBox()
    maxExtent = Math.max(
      maxExtent,
      fullBox.y + fullBox.height + XYCHART_WRAPPED_LABEL_BOTTOM_PAD
    )
  } catch {
    /* 忽略 */
  }

  svg.querySelectorAll('g.bottom-axis g.label text').forEach((node) => {
    if (!(node instanceof SVGTextElement)) {
      return
    }
    try {
      const box = node.getBBox()
      maxExtent = Math.max(
        maxExtent,
        box.y + box.height + XYCHART_WRAPPED_LABEL_BOTTOM_PAD
      )
    } catch {
      /* 未布局完成时忽略 */
    }
  })

  const neededHeight = Math.ceil(maxExtent - minY)
  if (neededHeight <= height) {
    return false
  }

  const heightScale = neededHeight / height
  svg.setAttribute('viewBox', `${minX} ${minY} ${width} ${neededHeight}`)

  const widthAttr = Number.parseFloat(svg.getAttribute('width') || '')
  const heightAttr = Number.parseFloat(svg.getAttribute('height') || '')
  if (widthAttr > 0 && heightAttr > 0) {
    svg.setAttribute('width', String(Math.ceil(widthAttr * heightScale)))
    svg.setAttribute('height', String(Math.ceil(heightAttr * heightScale)))
  } else if (heightAttr > 0) {
    svg.setAttribute('height', String(Math.ceil(heightAttr * heightScale)))
  } else {
    svg.setAttribute('height', String(neededHeight))
  }

  return true
}

/** 竖向图：换行 → 扩 viewBox → 按实际高度适配容器。 */
const scheduleVerticalXychartLabelLayout = (
  body: HTMLElement,
  svg: SVGElement
) => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      expandXychartViewBoxForWrappedLabels(svg)
      fitDiagramSvgInBody(body)
      observeDiagramBodyResize(body)
    })
  })
}

/** 按系列索引统一柱/条填充色，横竖向渲染结果一致。 */
const applyXychartBarColors = (svg: SVGElement) => {
  svg.querySelectorAll('g[class*="bar-plot"]').forEach((group) => {
    const className =
      group instanceof SVGElement
        ? group.className.baseVal || group.getAttribute('class') || ''
        : ''
    const indexMatch = className.match(/bar-plot-(\d+)/)
    const paletteIndex = indexMatch
      ? Number.parseInt(indexMatch[1], 10)
      : 0
    const fill =
      DIAGRAM_COLOR_PALETTE[
      paletteIndex % DIAGRAM_COLOR_PALETTE.length
        ]
    group.querySelectorAll('rect').forEach((rect) => {
      rect.setAttribute('fill', fill)
      rect.setAttribute('stroke', fill)
    })
  })
}

/** 为横向多类目 xychart 标记样式类并拉高最小高度。 */
const applyXychartDiagramPresentation = (
  block: Element,
  body: HTMLElement,
  source: string
) => {
  if (!isXychartSource(source)) {
    return
  }
  block.classList.add('md-diagram-xychart')
  if (isXychartHorizontal(source)) {
    block.classList.add('md-diagram-xychart--horizontal')
  } else {
    block.classList.add('md-diagram-xychart--vertical')
  }
  if (!isXychartHorizontal(source)) {
    return
  }
  const categoryCount = getXychartCategoryCount(source)
  if (categoryCount >= XYCHART_HORIZONTAL_MIN_CATEGORIES) {
    const minBodyHeight = Math.min(
      categoryCount * XYCHART_HORIZONTAL_ROW_MIN_HEIGHT +
      MARKDOWN_DIAGRAM_BODY_PADDING_VERTICAL,
      getMarkdownDiagramMaxHeight()
    )
    body.style.minHeight = `${minBodyHeight}px`
  }
}

/**
 * 将同一行内串联的多条 flowchart 边拆成多行。
 * LLM 常输出 `A --> B{x} B -->|y| C` 导致解析器在 B{x} 后期望换行却遇到下一个节点。
 */
const splitChainedFlowchartEdgesOnLine = (line: string) => {
  const indent = line.match(/^[\t ]*/)?.[0] ?? ''
  const splitOnce = (input: string) =>
    input.replace(
      /([\]\)\}])([ \t]+)([A-Za-z_][\w-]*)([ \t]+(?:-->|---|===|-\.->|==>|--o|--x)(?:\|[^|\n]+\|)?)/g,
      '$1\n$3$4'
    )

  let cur = line
  let prev = ''
  while (prev !== cur) {
    prev = cur
    cur = splitOnce(cur)
  }

  return cur
    .split('\n')
    .map((part, index) => (index === 0 ? part : indent + part.trimStart()))
    .join('\n')
}

const shouldNormalizeFlowchartLine = (trimmed: string) => {
  if (!trimmed || trimmed.startsWith('%%')) {
    return false
  }
  if (
    /^(?:style|classDef|class|linkStyle|click|subgraph|end)\b/i.test(trimmed)
  ) {
    return false
  }
  const arrowMatches = trimmed.match(
    /(?:-->|---|===|-\.->|==>|--o|--x)/g
  )
  return (arrowMatches?.length ?? 0) >= 2
}

const countLeadingSpaces = (line: string) => {
  const prefix = line.match(/^[\t ]*/)?.[0] ?? ''
  let n = 0
  for (const ch of prefix) {
    n += ch === '\t' ? 4 : 1
  }
  return n
}

/** 从已有缩进推断 mindmap 每层步长（常见为 2 或 4） */
const detectMindmapIndentStep = (lines: string[]) => {
  const indents = [
    ...new Set(
      lines.map((l) => countLeadingSpaces(l)).filter((i) => i > 0)
    )
  ].sort((a, b) => a - b)
  if (indents.length >= 2 && indents[1] - indents[0] > 0) {
    return indents[1] - indents[0]
  }
  return 2
}

/**
 * 修正 mindmap 缩进：LLM 常把子节点顶格（如「工具调用」），会被当成第二个 root 导致渲染失败。
 */
const normalizeMindmapIndentation = (source: string) => {
  if (!/^\s*mindmap\b/im.test(source)) {
    return source
  }

  const lines = source.split('\n')
  const indentStep = detectMindmapIndentStep(lines)
  const out: string[] = []
  const stack: number[] = []
  let rootIndent = -1
  let seenRoot = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      out.push(line)
      continue
    }
    if (/^mindmap$/i.test(trimmed)) {
      out.push(line)
      continue
    }

    const indent = countLeadingSpaces(line)

    if (!seenRoot) {
      seenRoot = true
      rootIndent = indent
      stack.length = 0
      stack.push(rootIndent)
      out.push(line)
      continue
    }

    let fixedIndent = indent

    if (indent <= rootIndent) {
      fixedIndent = stack[stack.length - 1] + indentStep
    } else {
      while (stack.length > 1 && indent <= stack[stack.length - 1]) {
        stack.pop()
      }
      if (indent <= stack[stack.length - 1]) {
        fixedIndent = stack[stack.length - 1] + indentStep
      }
    }

    while (stack.length > 1 && fixedIndent <= stack[stack.length - 1]) {
      stack.pop()
    }
    stack.push(fixedIndent)
    out.push(' '.repeat(fixedIndent) + trimmed)
  }

  return out.join('\n')
}

/**
 * 将同一行内并列的多个 flowchart 节点定义拆成多行。
 * LLM 常输出 `NE["网元"]  CHASSIS["机框"]`，解析器在首节点后期望换行却遇到下一个节点 ID。
 */
const splitMultipleFlowchartNodeDefsOnLine = (line: string) => {
  const indent = line.match(/^[\t ]*/)?.[0] ?? ''
  const nodePatterns = [
    /([A-Za-z_][\w-]*\[[^\]]*\])([ \t]+)(?=[A-Za-z_][\w-]*)/g,
    /([A-Za-z_][\w-]*\([^)]*\))([ \t]+)(?=[A-Za-z_][\w-]*)/g,
    /([A-Za-z_][\w-]*\{[^}]*\})([ \t]+)(?=[A-Za-z_][\w-]*)/g
  ]

  let cur = line
  let prev = ''
  while (prev !== cur) {
    prev = cur
    for (const pattern of nodePatterns) {
      cur = cur.replace(pattern, '$1\n')
    }
  }

  return cur
    .split('\n')
    .map((part, index) => (index === 0 ? part : indent + part.trimStart()))
    .join('\n')
}

const shouldNormalizeFlowchartNodeLine = (trimmed: string) => {
  if (!trimmed || trimmed.startsWith('%%')) {
    return false
  }
  if (
    /^(?:style|classDef|class|linkStyle|click|subgraph|end|graph|flowchart)\b/i.test(
      trimmed
    )
  ) {
    return false
  }
  const nodeLike =
    /[A-Za-z_][\w-]*(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\})/g
  const matches = trimmed.match(nodeLike)
  return (matches?.length ?? 0) >= 2
}

/** 仅对 graph / flowchart 图：把一行多个节点定义拆成多行 */
const normalizeFlowchartMultilineNodeDefs = (source: string) => {
  if (!/^\s*(?:graph|flowchart)\s/im.test(source)) {
    return source
  }
  return source
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!shouldNormalizeFlowchartNodeLine(trimmed)) {
        return line
      }
      return splitMultipleFlowchartNodeDefsOnLine(line)
    })
    .join('\n')
}

/** 仅对 graph / flowchart 图：把一行多条边拆成多行 */
const normalizeFlowchartMultilineEdges = (source: string) => {
  if (!/^\s*(?:graph|flowchart)\s/im.test(source)) {
    return source
  }
  return source
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!shouldNormalizeFlowchartLine(trimmed)) {
        return line
      }
      return splitChainedFlowchartEdgesOnLine(line)
    })
    .join('\n')
}

/**
 * 修正 subgraph 中文标签写法。LLM 常输出 `subgraph入库侧` 或 `subgraph 查询侧`，
 * 解析器要求 `subgraph id [标签]`（id 为 ASCII，标签可含中文）。
 */
const normalizeFlowchartSubgraphLabels = (source: string) => {
  if (!/^\s*(?:graph|flowchart)\s/im.test(source)) {
    return source
  }
  let counter = 0
  return source.replace(
    /^(\s*)subgraph\s*([^\[\n]+?)\s*$/gm,
    (match, indent: string, rest: string) => {
      const trimmed = rest.trim()
      if (!trimmed || /^end\b/i.test(trimmed)) {
        return match
      }
      if (/^[A-Za-z_][\w-]*\s*\[/.test(trimmed)) {
        return match
      }
      counter += 1
      return `${indent}subgraph _sg${counter} [${trimmed}]`
    }
  )
}

/**
 * 规范化 LLM 生成的 Mermaid 源码，修复弯引号、全角冒号、转义引号等常见导致解析失败的问题。
 */
const normalizeMermaidSource = (source: string) => {
  let text = source
    .replace(/\r\n/g, '\n')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[\u201c\u201d\u201e\u201f\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201a\u201b\u2032\u2035]/g, '\'')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, '\'')
    .replace(/：/g, ':')
    .replace(/\u00a0/g, ' ')
  text = normalizeMindmapIndentation(text)
  text = normalizeFlowchartSubgraphLabels(text)
  text = normalizeFlowchartMultilineNodeDefs(text)
  text = normalizeFlowchartMultilineEdges(text)
  text = quotePieSliceLines(text)
  return normalizeXychartOrientation(text)
}

const setBlockError = (block: Element, error: unknown) => {
  const body = block.querySelector<HTMLElement>('.md-diagram-body')
  const message =
    error instanceof Error ? error.message : String(error || 'Unknown error')
  block.classList.add('md-diagram-error')
  if (body) {
    clearDiagramBodyPending(body)
    // 用原生 details/summary 展示长错误，避免被容器 overflow 裁切后“看不见”
    body.innerHTML = [
      '<div class="md-diagram-error-title"><strong>图表渲染失败</strong></div>',
      '<details class="md-diagram-error-details">',
      '<summary class="md-diagram-error-summary">查看错误详情</summary>',
      `<pre class="md-diagram-error-pre"><code>${escapeHtml(
        message
      )}</code></pre>`,
      '</details>'
    ].join('')
  }
}

const getMermaidApi = async () => {
  if (!mermaidApi) {
    const mod = (await import('mermaid')) as unknown as MermaidModule
    mermaidApi = mod.default || mod
    mermaidApi.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'default',
      themeVariables: getMermaidThemeVariables() as unknown as Record<
        string,
        unknown
      >,
      themeCSS: getMermaidThemeCss(),
      // 解析失败时抛错，避免默认「炸弹」错误 SVG 插入 DOM
      suppressErrorRendering: true
    })
  }
  return mermaidApi
}

/**
 * 判断 Mermaid 返回的 SVG 是否为内置错误图。
 * 不可用 includes('error-icon')：正常图表的 <style> 里也会定义 .error-icon 样式。
 */
const isMermaidErrorSvg = (svg: string) =>
  /aria-roledescription=["']error["']/.test(svg) ||
  /<(?:g|svg)[^>]*\sclass=["'][^"']*\berror-icon\b/.test(svg)

const renderMermaidBlock = async (block: Element) => {
  const rawSource = getSourceFromBlock(block)
  const body = block.querySelector<HTMLElement>('.md-diagram-body')
  if (!rawSource.trim() || !body) {
    return
  }

  const source = normalizeMermaidSource(rawSource)
  applyXychartDiagramPresentation(block, body, source)
  const mermaid = await getMermaidApi()
  const id = `md-mermaid-${Date.now()}-${++mermaidSeq}`
  const { svg, bindFunctions } = await mermaid.render(id, source)
  if (isMermaidErrorSvg(svg)) {
    throw new Error('Mermaid 图表语法无效')
  }
  body.innerHTML = svg
  clearDiagramBodyPending(body)
  const renderedSvg = body.querySelector('svg')
  if (renderedSvg instanceof SVGElement && isXychartSource(source)) {
    applyXychartBarColors(renderedSvg)
    if (!isXychartHorizontal(source)) {
      wrapXychartVerticalCategoryLabels(renderedSvg)
      scheduleVerticalXychartLabelLayout(body, renderedSvg)
    } else {
      scheduleFitDiagramSvg(body)
    }
  } else {
    scheduleFitDiagramSvg(body)
  }
  bindFunctions?.(body)
}

const loadPlantUmlModule = () => {
  if (!plantUmlModuleLoad) {
    plantUmlModuleLoad = (async () => {
      await import('@plantuml/core/viz-global.js')
      const { renderToString } = await import('@plantuml/core')
      return (source: string) =>
        new Promise<string>((resolve, reject) => {
          const lines = source.split(/\r\n|\r|\n/)
          renderToString(lines, resolve, (message: string) =>
            reject(new Error(message))
          )
        })
    })()
  }
  return plantUmlModuleLoad
}

const getPlantUmlRenderer = async () => {
  if (!plantUmlRenderer) {
    plantUmlRenderer = await loadPlantUmlModule()
  }
  return plantUmlRenderer
}

const renderPlantUmlBlock = async (block: Element) => {
  const source = getSourceFromBlock(block)
  const body = block.querySelector<HTMLElement>('.md-diagram-body')
  if (!source.trim() || !body) {
    return
  }

  const renderer = await getPlantUmlRenderer()
  body.innerHTML = await renderer(injectPlantUmlTheme(source))
  clearDiagramBodyPending(body)
  scheduleFitDiagramSvg(body)
}

/**
 * 规范化 LLM 生成的 Vega-Lite JSON 源码，修复弯引号、HTML 实体等常见解析问题。
 */
const normalizeVegaLiteSource = (source: string) =>
  source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[\u201c\u201d\u201e\u201f\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201a\u201b\u2032\u2035]/g, '\'')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, '\'')
    .trim()

/** 多类目 nominal/ordinal X 轴自动倾斜标签（不覆盖 Agent 已配置的 axis）。 */
const enhanceVegaLiteSpec = (spec: Record<string, unknown>) => {
  const encoding = spec.encoding as Record<string, unknown> | undefined
  if (!encoding?.x || typeof encoding.x !== 'object' || Array.isArray(encoding.x)) {
    return spec
  }
  const xEnc = encoding.x as Record<string, unknown>
  const xType = xEnc.type as string | undefined
  if (xType && xType !== 'nominal' && xType !== 'ordinal') {
    return spec
  }

  let categoryCount = 0
  const data = spec.data as { values?: unknown[] } | undefined
  if (Array.isArray(data?.values)) {
    const field = typeof xEnc.field === 'string' ? xEnc.field : ''
    if (field) {
      const unique = new Set(
        data.values.map((row) =>
          row && typeof row === 'object'
            ? (row as Record<string, unknown>)[field]
            : undefined
        )
      )
      categoryCount = unique.size
    } else {
      categoryCount = data.values.length
    }
  }
  if (categoryCount < VEGA_LITE_MULTI_CATEGORY_THRESHOLD) {
    return spec
  }

  const existingAxis =
    xEnc.axis && typeof xEnc.axis === 'object' && !Array.isArray(xEnc.axis)
      ? (xEnc.axis as Record<string, unknown>)
      : {}
  if (existingAxis.labelAngle != null) {
    return spec
  }

  return {
    ...spec,
    encoding: {
      ...encoding,
      x: {
        ...xEnc,
        axis: {
          ...existingAxis,
          labelAngle: -45,
          labelLimit: 120
        }
      }
    }
  }
}

/**
 * 将代码块内容解析为 Vega-Lite 规格对象。
 */
const parseVegaLiteSpec = (source: string): Record<string, unknown> => {
  const text = normalizeVegaLiteSource(source)
  if (!text) {
    throw new Error('Vega-Lite 规格不能为空')
  }
  try {
    const spec = JSON.parse(text) as unknown
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
      throw new Error('Vega-Lite 规格必须是 JSON 对象')
    }
    return enhanceVegaLiteSpec(spec as Record<string, unknown>)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Vega-Lite')) {
      throw error
    }
    throw new Error('Vega-Lite 规格必须是合法 JSON')
  }
}

/** 懒加载 vega-embed，仅在首次渲染 Vega-Lite 块时拉取 */
const getVegaEmbed = async (): Promise<VegaEmbedFn> => {
  if (!vegaEmbedFn) {
    const mod = await import('vega-embed')
    const embed = mod.default
    if (typeof embed !== 'function') {
      throw new Error('vega-embed 模块未导出默认嵌入函数')
    }
    vegaEmbedFn = embed as VegaEmbedFn
  }
  return vegaEmbedFn
}

/** 渲染 Vega-Lite 代码块为 SVG，并接入图表缩放逻辑 */
const renderVegaLiteBlock = async (block: Element) => {
  const rawSource = getSourceFromBlock(block)
  const body = block.querySelector<HTMLElement>('.md-diagram-body')
  if (!rawSource.trim() || !body) {
    return
  }

  const spec = parseVegaLiteSpec(rawSource)
  const embed = await getVegaEmbed()
  const host = document.createElement('div')
  host.className = 'md-vegalite-host'
  body.replaceChildren(host)
  clearDiagramBodyPending(body)
  await embed(host, spec, {
    actions: false,
    renderer: 'svg',
    theme: 'quartz',
    config: getVegaLiteEmbedConfig(),
    tooltip: { theme: 'light' }
  })
  // vega-embed 把 svg 包进 .vega-embed 容器，svg 不是 body 直接子节点；
  // 提到 body 直下，便于 fit 测量/缩放，并去掉空的中间容器避免影响居中与高度。
  const vegaSvg = host.querySelector('svg')
  if (vegaSvg) {
    body.replaceChildren(vegaSvg)
  }
  scheduleFitDiagramSvg(body)
}

const buildHtmlPreviewDocument = (html: string) => `<!doctype html>
<html>
<head>
	<meta charset="utf-8">
	<base target="_blank">
	<style>
		html, body {
			margin: 0;
			padding: 0;
			min-height: 0;
			height: auto;
			box-sizing: border-box;
			overflow: visible;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			color: #1f2933;
			background: #fff;
		}
		body {
			display: block;
		}
		body > :first-child {
			margin-top: 0 !important;
			padding-top: 0 !important;
			min-height: 0 !important;
			align-items: flex-start !important;
			justify-content: flex-start !important;
		}
		* {
			box-sizing: border-box;
		}
		img, svg, canvas, video {
			max-width: 100%;
			height: auto;
		}
		table {
			max-width: 100%;
		}
	</style>
</head>
<body>${html}</body>
</html>`

/**
 * 测量 HTML 预览文档真实内容占位。
 * 结合 bbox 与 scrollHeight（iframe 仅设宽度、不设虚高时 scrollHeight 可信），并加底部余量防裁切。
 */
const measureHtmlPreviewContentSize = (doc: Document, layoutWidth: number) => {
  const body = doc.body
  const html = doc.documentElement
  if (!body) {
    return { width: layoutWidth, height: 1 }
  }

  const bodyRect = body.getBoundingClientRect()
  let maxBottom = 0
  let maxRight = 0

  const consider = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    if (rect.width < 1 && rect.height < 1) {
      return
    }
    maxBottom = Math.max(maxBottom, rect.bottom - bodyRect.top)
    maxRight = Math.max(maxRight, rect.right - bodyRect.left)
  }

  for (const child of body.children) {
    if (child instanceof HTMLElement) {
      consider(child)
    }
  }
  body.querySelectorAll<HTMLElement>('*').forEach(consider)

  const bboxHeight = Math.max(1, Math.ceil(maxBottom))
  const bboxWidth = Math.max(1, Math.ceil(maxRight))
  const scrollHeight = Math.ceil(
    Math.max(body.scrollHeight, html.scrollHeight, html.offsetHeight)
  )
  const scrollWidth = Math.ceil(
    Math.max(body.scrollWidth, html.scrollWidth, layoutWidth)
  )

  // scrollHeight 异常偏大（历史 5000px 虚高）时忽略，仅信任 bbox
  const height =
    scrollHeight > bboxHeight && scrollHeight <= bboxHeight * 2.5
      ? scrollHeight
      : bboxHeight
  const width =
    scrollWidth > bboxWidth && scrollWidth <= layoutWidth * 2.5
      ? scrollWidth
      : Math.max(bboxWidth, layoutWidth)

  return {
    width: Math.max(layoutWidth, width),
    height: height + HTML_PREVIEW_THUMB_MEASURE_PADDING
  }
}

const resolveHtmlPreviewContainerWidth = (wrap: HTMLElement) => {
  const fromWrap = wrap.clientWidth
  if (fromWrap > 0) {
    return fromWrap
  }
  const fromParent = wrap.parentElement?.clientWidth ?? 0
  if (fromParent > 0) {
    return fromParent
  }
  const fromMessage = wrap.closest('.message-md, .message-content') as HTMLElement | null
  if (fromMessage && fromMessage.clientWidth > 0) {
    return fromMessage.clientWidth
  }
  return 360
}

const ensureHtmlPreviewScaler = (
  wrap: HTMLElement,
  iframe: HTMLIFrameElement
): HTMLElement => {
  let scaler = wrap.querySelector<HTMLElement>(':scope > .md-html-preview-scaler')
  if (!scaler) {
    scaler = document.createElement('div')
    scaler.className = 'md-html-preview-scaler'
    wrap.insertBefore(scaler, iframe)
    scaler.appendChild(iframe)
  }
  return scaler
}

const htmlPreviewFitObservers = new WeakMap<HTMLElement, ResizeObserver>()

/**
 * 将 HTML 预览 iframe 缩略为无滚动的等比缩略图（点击后在全屏层交互）。
 */
const applyHtmlPreviewThumbScale = (
  iframe: HTMLIFrameElement,
  scale: number,
  contentWidth: number,
  contentHeight: number,
  scaledW: number,
  scaledH: number
) => {
  const scaler = ensureHtmlPreviewScaler(
    iframe.closest('.md-html-preview-wrap') as HTMLElement,
    iframe
  )

  iframe.style.width = `${contentWidth}px`
  iframe.style.height = `${contentHeight}px`
  iframe.style.display = 'block'
  iframe.style.margin = '0'
  iframe.style.overflow = 'visible'
  iframe.style.pointerEvents = 'none'
  iframe.style.border = 'none'
  iframe.setAttribute('scrolling', 'no')

  const iframeStyle = iframe.style as CSSStyleDeclaration & { zoom?: string }
  if (scale !== 1 && 'zoom' in iframeStyle) {
    iframeStyle.zoom = String(scale)
    iframe.style.transform = 'none'
    iframe.style.transformOrigin = ''
  } else {
    iframeStyle.zoom = ''
    iframe.style.transform = scale !== 1 ? `scale(${scale})` : 'none'
    iframe.style.transformOrigin = '0 0'
  }

  const scalerPad = scale < 1 ? 2 : 4
  scaler.style.width = `${scaledW + scalerPad}px`
  scaler.style.height = `${scaledH + scalerPad}px`
  scaler.style.margin = '0 auto'
  scaler.style.flexShrink = '0'
  scaler.style.overflow = 'visible'
}

const resizeHtmlPreview = (iframe: HTMLIFrameElement): boolean => {
  try {
    const doc = iframe.contentDocument
    if (!doc?.body) {
      return false
    }
    const wrap = iframe.closest('.md-html-preview-wrap') as HTMLElement | null
    if (!wrap) {
      return false
    }

    const thumbMaxHeight = getMarkdownHtmlPreviewMaxHeight()
    const containerWidth = Math.max(resolveHtmlPreviewContainerWidth(wrap) - 2, 160)

    // 仅在目标宽度下排版；勿拉高 iframe，否则 scrollHeight 污染测量
    iframe.style.width = `${containerWidth}px`
    iframe.style.height = 'auto'
    iframe.style.minHeight = '0'
    iframe.style.transform = 'none'
    ;(iframe.style as CSSStyleDeclaration & { zoom?: string }).zoom = ''
    void doc.body.offsetHeight

    const { width: contentWidth, height: contentHeight } =
      measureHtmlPreviewContentSize(doc, containerWidth)

    // 优先撑满缩略图高度，必要时放大；宽度超出时再收紧
    const scaleH = thumbMaxHeight / contentHeight
    const scaleW = containerWidth / contentWidth
    const scale = Math.min(scaleH, scaleW)
    const scaledW = Math.max(1, Math.ceil(contentWidth * scale))
    const scaledH = Math.max(1, Math.ceil(contentHeight * scale))

    applyHtmlPreviewThumbScale(
      iframe,
      scale,
      contentWidth,
      contentHeight,
      scaledW,
      scaledH
    )

    wrap.style.width = '100%'
    wrap.style.height = `${thumbMaxHeight}px`
    wrap.style.minHeight = `${thumbMaxHeight}px`
    wrap.style.maxHeight = `${thumbMaxHeight}px`
    wrap.style.display = 'flex'
    wrap.style.alignItems = 'center'
    wrap.style.justifyContent = 'center'
    wrap.style.overflow = 'hidden'
    wrap.dataset.mdHtmlThumb = 'true'
    return true
  } catch {
    /* sandboxed previews may be unreadable in stricter browser modes */
    return false
  }
}

const bindHtmlPreviewContentResize = (
  iframe: HTMLIFrameElement,
  onResize: () => void
) => {
  const doc = iframe.contentDocument
  if (!doc) {
    return
  }
  doc.querySelectorAll('img').forEach((img) => {
    if (img.complete) {
      return
    }
    img.addEventListener('load', onResize, { once: true })
    img.addEventListener('error', onResize, { once: true })
  })
}

const scheduleHtmlPreviewFit = (iframe: HTMLIFrameElement) => {
  const run = () => {
    resizeHtmlPreview(iframe)
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      run()
      bindHtmlPreviewContentResize(iframe, run)
    })
  })
}

const resolveExpandedHtmlPreviewContainerWidth = (iframe: HTMLIFrameElement) => {
  const wrap = iframe.closest('.md-html-preview-wrap') as HTMLElement | null
  if (wrap) {
    return Math.max(resolveHtmlPreviewContainerWidth(wrap), 360)
  }
  const parent = iframe.parentElement
  if (!parent) {
    return 360
  }
  const styles = getComputedStyle(parent)
  const padX =
    (Number.parseFloat(styles.paddingLeft) || 0) +
    (Number.parseFloat(styles.paddingRight) || 0)
  return Math.max(parent.clientWidth - padX, 360)
}

/** 全屏 HTML 预览：自然尺寸、可滚动、可交互 */
export const resizeMarkdownHtmlPreviewExpanded = (
  iframe: HTMLIFrameElement
): boolean => {
  try {
    const doc = iframe.contentDocument
    if (!doc?.body) {
      return false
    }
    const containerWidth = resolveExpandedHtmlPreviewContainerWidth(iframe)
    const { width: contentWidth, height: contentHeight } =
      measureHtmlPreviewContentSize(doc, containerWidth)

    ;(iframe.style as CSSStyleDeclaration & { zoom?: string }).zoom = ''
    iframe.style.transform = ''
    iframe.style.transformOrigin = ''
    iframe.style.width = '100%'
    iframe.style.minWidth = `${contentWidth}px`
    iframe.style.height = `${contentHeight}px`
    iframe.style.display = 'block'
    iframe.style.margin = '0'
    iframe.style.overflow = 'visible'
    iframe.style.pointerEvents = 'auto'
    iframe.setAttribute('scrolling', 'auto')
    return true
  } catch {
    return false
  }
}

/** 监听 HTML 预览块宽度变化并重新适配高度 */
const observeHtmlPreviewResize = (
  block: HTMLElement,
  iframe: HTMLIFrameElement
) => {
  const existing = htmlPreviewFitObservers.get(block)
  if (existing) {
    existing.disconnect()
  }
  if (typeof ResizeObserver === 'undefined') {
    return
  }
  const wrap = block.querySelector('.md-html-preview-wrap')
  const observer = new ResizeObserver(() => scheduleHtmlPreviewFit(iframe))
  observer.observe(block)
  if (wrap instanceof HTMLElement) {
    observer.observe(wrap)
  }
  htmlPreviewFitObservers.set(block, observer)
}

const renderHtmlPreviewBlock = (block: Element) => {
  const source = getSourceFromBlock(block)
  const iframe = block.querySelector<HTMLIFrameElement>(
    'iframe.md-html-preview'
  )
  const wrap = block.querySelector<HTMLElement>('.md-html-preview-wrap')
  if (!iframe || !wrap) {
    return
  }

  const finishLoading = () => {
    scheduleHtmlPreviewFit(iframe)
    wrap.classList.remove('md-block-pending')
    observeHtmlPreviewResize(block as HTMLElement, iframe)
  }

  iframe.onload = finishLoading
  iframe.srcdoc = buildHtmlPreviewDocument(source)
}

/** 图表块已按旧版逻辑渲染时，重置为占位以便用当前 revision 重绘。 */
const resetStaleDiagramBlock = (block: Element) => {
  block.removeAttribute(MARKDOWN_RENDERED_ATTR)
  block.classList.remove(
    'md-diagram-error',
    'md-diagram-xychart',
    'md-diagram-xychart--horizontal',
    'md-diagram-xychart--vertical'
  )
  const body = block.querySelector<HTMLElement>('.md-diagram-body')
  if (body) {
    disconnectDiagramFitObserver(body)
    body.classList.remove('md-diagram-body--wide')
    body.classList.add('md-block-pending')
    body.innerHTML = renderGeneratingHintHtml()
    body.style.cssText = ''
  }
  block.removeAttribute(MARKDOWN_REVISION_ATTR)
}

const getDiagramBodyForRefit = (block: Element): HTMLElement | undefined => {
  const type = block.getAttribute(MARKDOWN_RENDER_ATTR)
  if (type === 'html') {
    return undefined
  }
  const body = block.querySelector<HTMLElement>('.md-diagram-body')
  return body ?? undefined
}

const renderBlock = async (
  block: Element,
  options?: RenderMarkdownBlocksOptions
): Promise<HTMLElement | undefined> => {
  if (block.getAttribute(MARKDOWN_RENDERING_ATTR) === 'true') {
    return undefined
  }

  const revision = block.getAttribute(MARKDOWN_REVISION_ATTR)
  const alreadyRendered = block.getAttribute(MARKDOWN_RENDERED_ATTR) === 'true'
  if (alreadyRendered) {
    if (revision === MARKDOWN_RENDERER_REVISION) {
      return undefined
    }
    resetStaleDiagramBlock(block)
  }

  const type = block.getAttribute(MARKDOWN_RENDER_ATTR)
  const isAsyncBlock =
    type === 'mermaid' ||
    type === 'plantuml' ||
    type === 'vegalite' ||
    type === 'html'
  // 仅推迟“仍在流式输出（围栏未闭合）”的块——其所在容器带 data-md-stream-tail 标记。
  // 已闭合的块即便整条消息还在继续输出，也立即就地渲染；因其所在 DOM 不再被重建，渲染结果保持稳定、不抽搐。
  if (
    isAsyncBlock &&
    options?.deferDiagrams &&
    (block as Element).closest?.('[data-md-stream-tail]')
  ) {
    return undefined
  }

  block.setAttribute(MARKDOWN_RENDERING_ATTR, 'true')
  try {
    if (type === 'html') {
      renderHtmlPreviewBlock(block)
    } else if (type === 'mermaid') {
      await renderMermaidBlock(block)
    } else if (type === 'plantuml') {
      await renderPlantUmlBlock(block)
    } else if (type === 'vegalite') {
      await renderVegaLiteBlock(block)
    }
    block.setAttribute(MARKDOWN_RENDERED_ATTR, 'true')
    block.setAttribute(MARKDOWN_REVISION_ATTR, MARKDOWN_RENDERER_REVISION)
    return getDiagramBodyForRefit(block)
  } catch (error) {
    setBlockError(block, error)
    return undefined
  } finally {
    block.removeAttribute(MARKDOWN_RENDERING_ATTR)
  }
}

const isImageOnlyParagraphElement = (p: HTMLParagraphElement): boolean => {
  const meaningful = [...p.childNodes].filter((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? '').trim().length > 0
    }
    return node.nodeType === Node.ELEMENT_NODE
  })
  if (meaningful.length === 1) {
    const only = meaningful[0]
    if (only instanceof HTMLImageElement) {
      return true
    }
    if (only instanceof HTMLAnchorElement) {
      const imgs = only.querySelectorAll('img')
      return imgs.length === 1 && (only.textContent ?? '').trim().length === 0
    }
  }
  return false
}

const applyImageParagraphNormalization = (p: HTMLParagraphElement) => {
  p.classList.add(MD_P_IMAGE_CLASS)
  p.style.lineHeight = '0'
}

const clearImageParagraphNormalization = (p: HTMLParagraphElement) => {
  p.classList.remove(MD_P_IMAGE_CLASS)
  p.style.lineHeight = ''
}

const isImageLoadedSuccessfully = (img: HTMLImageElement) =>
  img.complete && img.naturalWidth > 0 && img.naturalHeight > 0

const bindImageLoadNormalization = (img: HTMLImageElement) => {
  const normalizeOnSuccess = () => {
    if (!isImageLoadedSuccessfully(img)) {
      return
    }
    const p = img.closest('p')
    if (p instanceof HTMLParagraphElement && isImageOnlyParagraphElement(p)) {
      applyImageParagraphNormalization(p)
    }
  }

  const normalizeOnError = () => {
    const p = img.closest('p')
    if (p instanceof HTMLParagraphElement) {
      clearImageParagraphNormalization(p)
    }
  }

  if (isImageLoadedSuccessfully(img)) {
    normalizeOnSuccess()
  } else if (img.complete) {
    normalizeOnError()
  } else {
    img.addEventListener('load', normalizeOnSuccess, { once: true })
    img.addEventListener('error', normalizeOnError, { once: true })
  }
}

/**
 * 图片加载成功后压缩单图段落的 line-height；加载失败时保持正常行高，避免 alt 文本叠在一起。
 */
export const normalizeMarkdownImageParagraphs = (root: ParentNode | Element) => {
  root.querySelectorAll<HTMLImageElement>('.message-md img').forEach((img) => {
    const src = img.getAttribute('src')
    if (src) {
      const normalized = normalizeRepoFileUrl(src)
      if (normalized !== src) {
        img.src = normalized
      }
    }
    bindImageLoadNormalization(img)
  })
}

/** 在 root 内渲染 mermaid/plantuml/vegalite/html 等异步 Markdown 块 */
export const renderMarkdownBlocks = async (
  root: ParentNode | Element,
  options?: RenderMarkdownBlocksOptions
) => {
  const blocks = Array.from(
    root.querySelectorAll<Element>(buildPendingBlocksSelector())
  )
  const bodiesToRefit: HTMLElement[] = []
  const concurrency =
    options?.concurrency ?? DEFAULT_DIAGRAM_RENDER_CONCURRENCY
  await mapWithConcurrency(blocks, concurrency, async (block) => {
    const body = await renderBlock(block, options)
    if (body) {
      bodiesToRefit.push(body)
    }
  })
  refitDiagramBodies(bodiesToRefit)
  normalizeMarkdownImageParagraphs(root)
}

/** 对 root 内已渲染图表按当前宽度重新适配外框高度 */
export const refitDiagramBlocksInRoot = (root: ParentNode | Element) => {
  root.querySelectorAll<HTMLElement>('.md-diagram-body').forEach((body) => {
    scheduleFitDiagramSvgReflow(body)
  })
}

export const resetMarkdownRendererForTest = () => {
  mermaidApi = undefined
  mermaidSeq = 0
  plantUmlRenderer = undefined
  plantUmlModuleLoad = undefined
  vegaEmbedFn = undefined
  invalidateDiagramMaxHeightCache()
}

/** 单测用：xychart 横向修正与类目计数 */
export const markdownRendererXychartInternals = {
  getXychartDeclarationLine,
  countXychartCategories,
  countXychartBarValues,
  getXychartCategoryCount,
  normalizeXychartOrientation,
  isXychartHorizontal
}
