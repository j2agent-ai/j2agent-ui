/**
 * 运行：node j2agent-ui/scripts/verify-pie-normalize.mjs
 * 全面校验 pie 压缩语法的 normalize 结果。
 */
import { normalizeMermaidSource } from '../src/utils/diagramSourceNormalize.ts'

const cases = [
  {
    name: 'user-compressed-multiline',
    input: `pie showData
  title 当前各网元种类占比 "AP" : 756
  "AC" : 311 "SDN交换机" : 91
  "网关" : 71 "工业路由器" : 6 "通用设备" : 2`,
    expectedLines: [
      'pie showData',
      'title 当前各网元种类占比',
      '"AP" : 756',
      '"AC" : 311',
      '"SDN交换机" : 91',
      '"网关" : 71',
      '"工业路由器" : 6',
      '"通用设备" : 2',
    ],
  },
  {
    name: 'single-line-all',
    input:
      'pie showData title 当前各网元种类占比 "AP" : 756 "AC" : 311 "SDN交换机" : 91',
    expectedLines: [
      'pie showData',
      'title 当前各网元种类占比',
      '"AP" : 756',
      '"AC" : 311',
      '"SDN交换机" : 91',
    ],
  },
  {
    name: 'pie-line-slices-no-title',
    input: 'pie showData "AP" : 756 "AC" : 311',
    expectedLines: ['pie showData', '"AP" : 756', '"AC" : 311'],
  },
  {
    name: 'pie-line-title-without-keyword',
    input: 'pie showData 当前占比 "AP" : 756 "AC" : 311',
    expectedLines: ['pie showData', 'title 当前占比', '"AP" : 756', '"AC" : 311'],
  },
  {
    name: 'comma-separated-slices',
    input: `pie showData
  title 占比
  "AC" : 311, "SDN交换机" : 91, "网关" : 71`,
    expectedLines: [
      'pie showData',
      'title 占比',
      '"AC" : 311',
      '"SDN交换机" : 91',
      '"网关" : 71',
    ],
  },
  {
    name: 'unquoted-labels-compressed',
    input: `pie showData
  title 设备占比
  AP : 756 AC : 311 SDN交换机 : 91`,
    expectedLines: [
      'pie showData',
      'title 设备占比',
      '"AP" : 756',
      '"AC" : 311',
      '"SDN交换机" : 91',
    ],
  },
  {
    name: 'single-quotes',
    input: `pie showData
  'AC' : 311 '网关' : 71`,
    expectedLines: ['pie showData', '"AC" : 311', '"网关" : 71'],
  },
  {
    name: 'already-correct-unchanged-structure',
    input: `pie showData
  title 当前告警级别占比
  "严重" : 12
  "重要" : 14`,
    expectedLines: [
      'pie showData',
      'title 当前告警级别占比',
      '"严重" : 12',
      '"重要" : 14',
    ],
  },
  {
    name: 'pie-without-showData',
    input: 'pie title 占比 "A" : 1 "B" : 2',
    expectedLines: ['pie', 'title 占比', '"A" : 1', '"B" : 2'],
  },
  {
    name: 'fullwidth-colon',
    input: 'pie showData "AC" ： 311 "网关" ： 71',
    expectedLines: ['pie showData', '"AC" : 311', '"网关" : 71'],
  },
  {
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
    name: 'orphan-title-without-keyword',
    input: `pie showData
  当前各网元种类占比 "AP" : 756`,
    expectedLines: ['pie showData', 'title 当前各网元种类占比', '"AP" : 756'],
  },
  {
    name: 'semicolon-separated-slices',
    input: 'pie showData "AC" : 311; "网关" : 71; "AP" : 756',
    expectedLines: ['pie showData', '"AC" : 311', '"网关" : 71', '"AP" : 756'],
  },
]

let failed = 0
for (const { name, input, expectedLines } of cases) {
  const normalized = normalizeMermaidSource(input)
  const lines = normalized.split('\n').map((l) => l.trim())
  const ok = JSON.stringify(lines) === JSON.stringify(expectedLines)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) {
    failed++
    console.log('  expected:', expectedLines)
    console.log('  got:     ', lines)
    console.log('  raw:\n', normalized)
  }
}

if (failed > 0) {
  console.error(`\n${failed} case(s) failed`)
  process.exit(1)
}
console.log(`\nAll ${cases.length} cases passed`)
