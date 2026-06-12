import {
  getMermaidThemeCss,
  getMermaidThemeVariables,
  getVegaLiteEmbedConfig,
  injectPlantUmlTheme
} from '../utils/diagramTheme'
import {
  isMermaidErrorSvg,
  normalizeMermaidSource,
  parseVegaLiteSpec,
  type DiagramRenderType
} from '../utils/diagramSourceNormalize'

type MermaidModule = {
  default?: MermaidApi
} & MermaidApi

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void
  render: (
    id: string,
    text: string
  ) => Promise<{ svg: string }>
}

type PlantUmlRenderer = (source: string) => Promise<string>

type WorkerRenderRequest = {
  kind: 'render'
  id: string
  type: DiagramRenderType
  source: string
}

type WorkerWarmupRequest = {
  kind: 'warmup'
}

type WorkerRequest = WorkerRenderRequest | WorkerWarmupRequest

type WorkerResultResponse = {
  kind: 'result'
  id: string
  ok: boolean
  markup?: string
  error?: string
}

type WorkerWarmupResponse = {
  kind: 'warmup-done'
}

type WorkerResponse = WorkerResultResponse | WorkerWarmupResponse

let mermaidApi: MermaidApi | undefined
let mermaidSeq = 0
let plantUmlRenderer: PlantUmlRenderer | undefined
let plantUmlModuleLoad: Promise<PlantUmlRenderer> | undefined

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
      suppressErrorRendering: true
    })
  }
  return mermaidApi
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

const renderMermaidMarkup = async (source: string) => {
  const normalized = normalizeMermaidSource(source)
  const mermaid = await getMermaidApi()
  const id = `md-mermaid-worker-${Date.now()}-${++mermaidSeq}`
  const { svg } = await mermaid.render(id, normalized)
  if (isMermaidErrorSvg(svg)) {
    throw new Error('Mermaid 图表语法无效')
  }
  return svg
}

const renderPlantUmlMarkup = async (source: string) => {
  const renderer = await getPlantUmlRenderer()
  return renderer(injectPlantUmlTheme(source))
}

const renderVegaLiteMarkup = async (source: string) => {
  const spec = parseVegaLiteSpec(source)
  const config = getVegaLiteEmbedConfig()
  const { compile } = await import('vega-lite')
  const vega = await import('vega')
  const compiled = compile(spec, { config })
  const runtime = vega.parse(compiled.spec)
  const view = new vega.View(runtime, { renderer: 'svg' })
  return view.toSVG()
}

const renderDiagram = async (type: DiagramRenderType, source: string) => {
  switch (type) {
    case 'mermaid':
      return renderMermaidMarkup(source)
    case 'plantuml':
      return renderPlantUmlMarkup(source)
    case 'vegalite':
      return renderVegaLiteMarkup(source)
    default:
      throw new Error(`Unsupported diagram type: ${type satisfies never}`)
  }
}

const warmupRuntimes = async () => {
  await Promise.all([
    getMermaidApi(),
    getPlantUmlRenderer().catch(() => {}),
    import('vega-lite').catch(() => {}),
    import('vega').catch(() => {})
  ])
}

const postResult = (response: WorkerResultResponse) => {
  self.postMessage(response satisfies WorkerResponse)
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const message = event.data
  if (!message || typeof message !== 'object') {
    return
  }

  if (message.kind === 'warmup') {
    void warmupRuntimes()
      .then(() => {
        self.postMessage({ kind: 'warmup-done' } satisfies WorkerWarmupResponse)
      })
      .catch(() => {
        self.postMessage({ kind: 'warmup-done' } satisfies WorkerWarmupResponse)
      })
    return
  }

  if (message.kind !== 'render') {
    return
  }

  void renderDiagram(message.type, message.source)
    .then((markup) => {
      postResult({
        kind: 'result',
        id: message.id,
        ok: true,
        markup
      })
    })
    .catch((error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error || 'Unknown error')
      postResult({
        kind: 'result',
        id: message.id,
        ok: false,
        error: errorMessage
      })
    })
})
