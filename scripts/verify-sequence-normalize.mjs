/**
 * 运行：node j2agent-ui/scripts/verify-sequence-normalize.mjs
 * 校验 sequenceDiagram 挤扁语法的 normalize 结果可被 Mermaid 解析。
 */
import { normalizeMermaidSource } from '../src/utils/diagramSourceNormalize.ts'
import mermaid from 'mermaid'

mermaid.initialize({ startOnLoad: false })

const cases = [
  {
    name: 'crowded-get-seq',
    input: `sequenceDiagram
  participant ADV as ReactCompatibleAdvisor participant MEM as AppendOnlyWindowChatMemory
  participant REPO as ChatMemoryRepository participant TRIM as MessageWindowTrimmer ADV->>MEM: get conversationId MEM->>REPO: findByConversationId 全量
  REPO-->>MEM: all messages
  MEM->>MEM: filterReplayable MEM->>TRIM: trimToWindow max 100 TRIM-->>MEM: windowed list MEM-->>ADV: replayable window alt 首轮无 AssistantMessage ADV->>ADV: prepend 到 prompt instructions else ReAct 后续跳 ADV->>ADV: 仅用图内 instructions 不 prepend
  end`,
  },
  {
    name: 'end-in-message',
    input: `sequenceDiagram
  A->>B: send end signal
  B-->>A: ack`,
  },
  {
    name: 'alt-noop-end-message',
    input: `sequenceDiagram
  alt x
    A->>A: noop end
  end`,
  },
  {
    name: 'save-and-sync',
    input: `sequenceDiagram
  A->>B: save and sync
  B-->>A: ok`,
  },
]

let failed = 0
for (const { name, input } of cases) {
  const normalized = normalizeMermaidSource(input)
  try {
    await mermaid.parse(normalized)
    if (normalizeMermaidSource(normalized) !== normalized) {
      console.error(`FAIL ${name}: not idempotent`)
      failed += 1
      continue
    }
    console.log(`OK  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL ${name}`)
    console.error(normalized)
    console.error(error?.message || error)
  }
}

if (failed > 0) {
  process.exit(1)
}
console.log(`ALL_PASS (${cases.length})`)
