import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  advanceProgressiveSegmentLimit,
  computeScrollTopAfterPrepend,
  countDiagramFences,
  initialProgressiveHistoryLimit,
  initialProgressiveSegmentLimit,
  mergeProgressiveSegmentLimit,
  nextProgressiveHistoryLimit,
  shouldUseProgressiveHistoryRender,
  shouldUseProgressiveSegmentRender,
  sliceMessagesForProgressiveRender
} from './historyProgressiveRender'

describe('historyProgressiveRender', () => {
  it('shouldUseProgressiveHistoryRender respects threshold and diagram count', () => {
    assert.equal(shouldUseProgressiveHistoryRender(12, 0), false)
    assert.equal(shouldUseProgressiveHistoryRender(13, 0), true)
    assert.equal(shouldUseProgressiveHistoryRender(3, 10), true)
  })

  it('shouldUseProgressiveSegmentRender detects heavy diagram content', () => {
    assert.equal(shouldUseProgressiveSegmentRender(5, 3), false)
    assert.equal(shouldUseProgressiveSegmentRender(10, 3), true)
    assert.equal(shouldUseProgressiveSegmentRender(3, 8), true)
  })

  it('countDiagramFences counts async diagram fences', () => {
    const content =
      '```mermaid\npie\n```\n```vega-lite\n{}\n```\n```puml\n@startuml\n```'
    assert.equal(countDiagramFences(content), 3)
  })

  it('sliceMessagesForProgressiveRender keeps latest messages', () => {
    const all = [1, 2, 3, 4, 5, 6, 7]
    assert.deepEqual(sliceMessagesForProgressiveRender(all, null), all)
    assert.deepEqual(sliceMessagesForProgressiveRender(all, 3), [5, 6, 7])
  })

  it('nextProgressiveHistoryLimit stops at total', () => {
    assert.equal(nextProgressiveHistoryLimit(4, 20), 7)
    assert.equal(nextProgressiveHistoryLimit(18, 20), null)
  })

  it('advanceProgressiveSegmentLimit reaches total before completing', () => {
    assert.equal(advanceProgressiveSegmentLimit(3, 22), 4)
    assert.equal(advanceProgressiveSegmentLimit(21, 22), 22)
    assert.equal(advanceProgressiveSegmentLimit(22, 22), null)
  })

  it('mergeProgressiveSegmentLimit never regresses', () => {
    assert.equal(mergeProgressiveSegmentLimit(15, 30), 15)
    assert.equal(mergeProgressiveSegmentLimit(null, 30), 3)
    assert.equal(mergeProgressiveSegmentLimit(2, 30), 3)
  })

  it('initialProgressiveHistoryLimit caps at message count', () => {
    assert.equal(initialProgressiveHistoryLimit(3), 3)
    assert.equal(initialProgressiveHistoryLimit(30), 4)
  })

  it('initialProgressiveSegmentLimit caps at segment count', () => {
    assert.equal(initialProgressiveSegmentLimit(2), 2)
    assert.equal(initialProgressiveSegmentLimit(30), 3)
  })

  it('computeScrollTopAfterPrepend preserves viewport anchor', () => {
    assert.equal(computeScrollTopAfterPrepend(400, 2000, 2600), 1000)
    assert.equal(computeScrollTopAfterPrepend(400, 2000, 2000), 400)
  })
})
