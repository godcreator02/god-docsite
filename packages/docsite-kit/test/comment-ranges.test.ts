import { describe, expect, it } from 'vitest'
import { createRangeMapper, type CommentRange } from '../src/comment-ranges.js'

const mapRange = createRangeMapper()

/** 快照里第 n 处 quote 的位置 */
function rangeOf(text: string, quote: string, occurrence = 1): CommentRange {
  let start = -1
  for (let count = 0; count < occurrence; count++) start = text.indexOf(quote, start + 1)
  if (start === -1) throw new Error(`没有第 ${occurrence} 处「${quote}」`)
  return [start, start + quote.length]
}

function mappedText(snapshot: string, current: string, range: CommentRange) {
  const mapped = mapRange(snapshot, current, range)
  return mapped && { text: current.slice(mapped.start, mapped.end), start: mapped.start, changed: mapped.changed }
}

const table = '| 名字 | 说明 |\n| 页面 | 写一页 |\n| 页面 | 写一页 |\n| 评论 | 批一段 |\n'

describe('按差异把快照里的位置推算到现在', () => {
  it('页面没改：原样返回', () => {
    expect(mapRange('甲乙丙', '甲乙丙', [1, 2])).toEqual({ start: 1, end: 2, changed: false })
  })

  it('前面插了、删了几段：位置跟着挪，没改的原文不算改过', () => {
    const snapshot = '第一段说明。\n第二段讲原文怎么找。\n第三段。'
    const range = rangeOf(snapshot, '原文怎么找')
    expect(mappedText(snapshot, `新加的一段开场白。\n${snapshot}`, range)).toMatchObject({ text: '原文怎么找', changed: false })
    expect(mappedText(snapshot, snapshot.replace('第一段说明。\n', ''), range)).toMatchObject({ text: '原文怎么找', start: 4, changed: false })
  })

  it('原文出现好几次、连前后文都一样时，认出批的是哪一处', () => {
    const range = rangeOf(table, '| 页面 | 写一页 |', 2)
    const current = `开头加一句。\n${table}`
    const mapped = mappedText(table, current, range)
    expect(mapped).toMatchObject({ text: '| 页面 | 写一页 |', changed: false })
    expect(mapped!.start).toBe(rangeOf(current, '| 页面 | 写一页 |', 2)[0])
  })

  it('重复的两行删掉一行：批的那一行还在就跟过去；批的那行被删了就找不到，不挂到另一行上', () => {
    const second = rangeOf(table, '| 页面 | 写一页 |\n', 2)
    const first = rangeOf(table, '| 页面 | 写一页 |\n', 1)
    const oneRowLeft = table.replace('| 页面 | 写一页 |\n', '')
    // 两行一模一样，删掉哪一行在文字上分不出来：差异算法认为删的是其中一行，另一行留着
    const survivors = [mappedText(table, oneRowLeft, first), mappedText(table, oneRowLeft, second)].filter(Boolean)
    expect(survivors).toHaveLength(1)
    expect(survivors[0]).toMatchObject({ text: '| 页面 | 写一页 |\n', changed: false })
  })

  it('被批的那段里改了几个字：首尾还对得上，挂在改后的那段上并标改过', () => {
    const snapshot = '前文。四级标题用来给一小节里的几段起名字。后文。'
    const range = rangeOf(snapshot, '四级标题用来给一小节里的几段起名字')
    expect(mappedText(snapshot, snapshot.replace('一小节里的几段', '一节里的几段'), range)).toMatchObject({ text: '四级标题用来给一节里的几段起名字', changed: true })
  })

  it('被批的那段整个重写、或者开头被改掉：找不到', () => {
    const snapshot = '前文。四级标题用来给一小节里的几段起名字。后文。'
    const range = rangeOf(snapshot, '四级标题用来给一小节里的几段起名字')
    expect(mapRange(snapshot, '前文。小节标题只用到三级为止，不再往下分。后文。', range)).toBeUndefined()
    expect(mapRange(snapshot, snapshot.replace('四级标题', '标题'), range)).toBeUndefined()
  })

  it('被批的那段挪到了别处：当作找不到', () => {
    const snapshot = '第一节讲布局，左边是侧栏。\n第二节讲评论。\n第三节讲搜索。'
    const range = rangeOf(snapshot, '第一节讲布局，左边是侧栏。')
    expect(mapRange(snapshot, '第二节讲评论。\n第三节讲搜索。\n第一节讲布局，左边是侧栏。', range)).toBeUndefined()
  })
})
