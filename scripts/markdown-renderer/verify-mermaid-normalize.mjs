/**
 * 运行：node j2agent-ui/scripts/markdown-renderer/verify-mermaid-normalize.mjs
 * 校验 Markdown 渲染器 Mermaid normalize 对 flowchart / pie / sequenceDiagram 的容错结果。
 */
import mermaid from 'mermaid'
import { normalizeMermaidSource } from '../../src/utils/diagramSourceNormalize.ts'

mermaid.initialize({ startOnLoad: false })

const normalizeCases = [
  {
    group: 'flowchart',
    name: 'title-prefix-node-id-and-crowded-next-statement',
    input: `flowchart LR
    TextChunk["逻辑 text_chunk"]
    TitleVec["type=title (1条)"]
    ContentSeg["type=content_segment 多条"]TextChunk --> TitleVec
    TextChunk --> ContentSeg`,
    expectedLines: [
      'flowchart LR',
      'TextChunk["逻辑 text_chunk"]',
      'TitleVec["type=title (1条)"]',
      'ContentSeg["type=content_segment 多条"]',
      'TextChunk --> TitleVec',
      'TextChunk --> ContentSeg',
    ],
  },
  {
    group: 'flowchart',
    name: 'title-keyword-crowded-with-number-still-fixed',
    input: `xychart-beta
  title15趟列车余票状态分布
  x-axis [A]
  bar [1]`,
    expectedLines: [
      'xychart-beta',
      'title "15趟列车余票状态分布"',
      'x-axis [A]',
      'bar [1]',
    ],
  },
  {
    group: 'pie',
    name: 'user-compressed-multiline',
    input: `pie showData
  title 当前各网元种类占比 "AP" : 756
  "AC" : 311 "SDN交换机" : 91
  "网关" : 71 "工业路由器" : 6 "通用设备" : 2`,
    expectedLines: [
      'pie showData',
      'title "当前各网元种类占比"',
      '"AP" : 756',
      '"AC" : 311',
      '"SDN交换机" : 91',
      '"网关" : 71',
      '"工业路由器" : 6',
      '"通用设备" : 2',
    ],
  },
  {
    group: 'pie',
    name: 'single-line-all',
    input:
      'pie showData title 当前各网元种类占比 "AP" : 756 "AC" : 311 "SDN交换机" : 91',
    expectedLines: [
      'pie showData',
      'title "当前各网元种类占比"',
      '"AP" : 756',
      '"AC" : 311',
      '"SDN交换机" : 91',
    ],
  },
  {
    group: 'pie',
    name: 'pie-line-slices-no-title',
    input: 'pie showData "AP" : 756 "AC" : 311',
    expectedLines: ['pie showData', '"AP" : 756', '"AC" : 311'],
  },
  {
    group: 'pie',
    name: 'pie-line-title-without-keyword',
    input: 'pie showData 当前占比 "AP" : 756 "AC" : 311',
    expectedLines: ['pie showData', 'title "当前占比"', '"AP" : 756', '"AC" : 311'],
  },
  {
    group: 'pie',
    name: 'comma-separated-slices',
    input: `pie showData
  title 占比
  "AC" : 311, "SDN交换机" : 91, "网关" : 71`,
    expectedLines: [
      'pie showData',
      'title "占比"',
      '"AC" : 311',
      '"SDN交换机" : 91',
      '"网关" : 71',
    ],
  },
  {
    group: 'pie',
    name: 'unquoted-labels-compressed',
    input: `pie showData
  title 设备占比
  AP : 756 AC : 311 SDN交换机 : 91`,
    expectedLines: [
      'pie showData',
      'title "设备占比"',
      '"AP" : 756',
      '"AC" : 311',
      '"SDN交换机" : 91',
    ],
  },
  {
    group: 'pie',
    name: 'single-quotes',
    input: `pie showData
  'AC' : 311 '网关' : 71`,
    expectedLines: ['pie showData', '"AC" : 311', '"网关" : 71'],
  },
  {
    group: 'pie',
    name: 'already-correct-unchanged-structure',
    input: `pie showData
  title 当前告警级别占比
  "严重" : 12
  "重要" : 14`,
    expectedLines: [
      'pie showData',
      'title "当前告警级别占比"',
      '"严重" : 12',
      '"重要" : 14',
    ],
  },
  {
    group: 'pie',
    name: 'pie-without-showData',
    input: 'pie title 占比 "A" : 1 "B" : 2',
    expectedLines: ['pie', 'title "占比"', '"A" : 1', '"B" : 2'],
  },
  {
    group: 'pie',
    name: 'fullwidth-colon',
    input: 'pie showData "AC" ： 311 "网关" ： 71',
    expectedLines: ['pie showData', '"AC" : 311', '"网关" : 71'],
  },
  {
    group: 'pie',
    name: 'title-quoted-with-slice-on-same-line',
    input: `pie showData
  title "当前各网元种类占比" "AP" : 756`,
    expectedLines: [
      'pie showData',
      'title "当前各网元种类占比"',
      '"AP" : 756',
    ],
  },
  {
    group: 'pie',
    name: 'orphan-title-without-keyword',
    input: `pie showData
  当前各网元种类占比 "AP" : 756`,
    expectedLines: ['pie showData', 'title "当前各网元种类占比"', '"AP" : 756'],
  },
  {
    group: 'pie',
    name: 'semicolon-separated-slices',
    input: 'pie showData "AC" : 311; "网关" : 71; "AP" : 756',
    expectedLines: ['pie showData', '"AC" : 311', '"网关" : 71', '"AP" : 756'],
  },
]

const parseCases = [
  {
    group: 'sequence',
    name: 'crowded-get-seq',
    input: `sequenceDiagram
  participant ADV as ReactCompatibleAdvisor participant MEM as AppendOnlyWindowChatMemory
  participant REPO as ChatMemoryRepository participant TRIM as MessageWindowTrimmer ADV->>MEM: get conversationId MEM->>REPO: findByConversationId 全量
  REPO-->>MEM: all messages
  MEM->>MEM: filterReplayable MEM->>TRIM: trimToWindow max 100 TRIM-->>MEM: windowed list MEM-->>ADV: replayable window alt 首轮无 AssistantMessage ADV->>ADV: prepend 到 prompt instructions else ReAct 后续跳 ADV->>ADV: 仅用图内 instructions 不 prepend
  end`,
  },
  {
    group: 'sequence',
    name: 'end-in-message',
    input: `sequenceDiagram
  A->>B: send end signal
  B-->>A: ack`,
  },
  {
    group: 'sequence',
    name: 'alt-noop-end-message',
    input: `sequenceDiagram
  alt x
    A->>A: noop end
  end`,
  },
  {
    group: 'sequence',
    name: 'save-and-sync',
    input: `sequenceDiagram
  A->>B: save and sync
  B-->>A: ok`,
  },
  {
    group: 'sequence',
    name: 'attachment-flow-crowded-else-end',
    input: `sequenceDiagram
    participant UI as 浏览器 participant API as J2Agent participant OSS as 对象存储 participant LLM as 视觉 LLM

    UI->>UI: 本地预览（blob URL，仅输入区）
    UI->>API: WebSocket ChatRequestDto + attachments.data（Base64）
    API->>OSS: putObject chat/userId/contextId/uuid_file API-->>UI: NOTICE user-attachments-ready（展示 URL，见 access-mode）
    API->>API: validateAndReference + object_file_reference
    API->>OSS: getObject 读字节（仅 LLM 推理）
    API->>LLM: UserMessage.media（base64/Resource）
    API->>API: encode 记忆 meta_json.attachments（objectKey，不含 url）
    alt direct 模式 UI->>OSS: 气泡 <img> 直连预签名 URL
    else proxy 模式 UI->>API: 气泡 <img> GET /chat/files/content end`,
  },
  {
    group: 'sequence',
    name: 'attachment-flow-crowded-header-and-cross-line-end',
    input: `sequenceDiagram participant UI as 浏览器
    participant API as J2Agent
    participant OSS as 对象存储
    participant LLM as 视觉 LLM UI->>UI: 本地预览（blob URL，仅输入区）
    UI->>API: WebSocket ChatRequestDto + attachments.data（Base64）
    API->>OSS: putObject chat/userId/contextId/uuid_file API-->>UI: NOTICE user-attachments-ready（展示 URL，见 access-mode）
    API->>API: validateAndReference + object_file_reference API->>OSS: getObject 读字节（仅 LLM 推理）
    API->>LLM: UserMessage.media（base64/Resource）
    API->>API: encode 记忆 meta_json.attachments（objectKey，不含 url）
    alt direct 模式
        UI->>OSS: 气泡 <img> 直连预签名 URL else proxy 模式
        UI->>API: 气泡 <img> GET /chat/files/content end`,
  },
  {
    group: 'sequence',
    name: 'else-closed-then-send-end-message',
    input: `sequenceDiagram
  alt x
    A->>B: first
  else y
    A->>B: second end
  A->>B: send end
  B-->>A: ok`,
  },
]

let failed = 0

for (const { group, name, input, expectedLines } of normalizeCases) {
  const normalized = normalizeMermaidSource(input)
  const lines = normalized.split('\n').map((line) => line.trim())
  const ok = JSON.stringify(lines) === JSON.stringify(expectedLines)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${group}/${name}`)
  if (!ok) {
    failed += 1
    console.log('  expected:', expectedLines)
    console.log('  got:     ', lines)
    console.log('  raw:\n', normalized)
  }
}

for (const { group, name, input } of parseCases) {
  const normalized = normalizeMermaidSource(input)
  try {
    await mermaid.parse(normalized)
    if (normalizeMermaidSource(normalized) !== normalized) {
      console.error(`FAIL ${group}/${name}: not idempotent`)
      failed += 1
      continue
    }
    console.log(`PASS ${group}/${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL ${group}/${name}`)
    console.error(normalized)
    console.error(error?.message || error)
  }
}

const total = normalizeCases.length + parseCases.length
if (failed > 0) {
  console.error(`\n${failed} of ${total} case(s) failed`)
  process.exit(1)
}
console.log(`\nAll ${total} cases passed`)
