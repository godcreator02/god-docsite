import { describe, expect, it } from 'vitest'
import { createRangeMapper, diffOfTexts, mapRangeThroughDiff } from '../src/site/browser/range-mapping.js'

describe('快照差异重定位（拆自旧机制 comment-ranges）', () => {
  it('两版一样时原样返回且不算改过', () => {
    const mapper = createRangeMapper()
    expect(mapper('同一份文字', '同一份文字', [2, 6])).toEqual({ start: 2, end: 6, changed: false })
  })

  it('前面插了字，后面的位置整体平移', () => {
    const mapper = createRangeMapper()
    expect(mapper('abcdef', 'xxabcdef', [2, 5])).toEqual({ start: 4, end: 7, changed: false })
  })

  it('被批的那段里面的字改了：首尾落在没改动的字里，changed 为 true', () => {
    const diffs = diffOfTexts('abcde', 'abXYe')
    expect(mapRangeThroughDiff(diffs, [1, 5])).toEqual({ start: 1, end: 5, changed: true })
  })

  it('首尾两个字都落在没改动的文字里才推算得出来', () => {
    const diffs = diffOfTexts('abc123xyz', 'abcZZxyz')
    expect(mapRangeThroughDiff(diffs, [2, 9])).toEqual({ start: 2, end: 8, changed: true })
    // 整段都在删掉的字里：推算不出
    expect(mapRangeThroughDiff(diffs, [3, 6])).toBeUndefined()
  })

  it('同一份快照的差异算一次就缓存，文字没变不重算', () => {
    const mapper = createRangeMapper()
    expect(mapper('abc', 'abcd', [0, 3])).toEqual({ start: 0, end: 3, changed: false })
    expect(mapper('abc', 'abcd', [1, 3])).toEqual({ start: 1, end: 3, changed: false })
  })
})
