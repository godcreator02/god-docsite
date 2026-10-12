import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installFakeLayout } from './test-utils.js'
import { measureAllPlacements, samePlacements } from '../src/placement.js'

let layout: ReturnType<typeof installFakeLayout>
let document_: Document

beforeEach(() => {
  document_ = globalThis.document
  layout = installFakeLayout()
})

afterEach(() => {
  layout.uninstall()
  document_.body.innerHTML = ''
})

function makeRange(): Range {
  const paragraph = document_.body.appendChild(document_.createElement('p'))
  paragraph.append('被批的文字')
  const range = document_.createRange()
  range.selectNodeContents(paragraph.firstChild!)
  return range
}

function makeElement(style = ''): HTMLElement {
  const element = document_.body.appendChild(document_.createElement('div'))
  if (style) element.setAttribute('style', style)
  return element
}

/** 覆盖层的矩形：页面坐标 (100, 200) 处，600 宽 */
const layerRect = { top: 100, left: 200, width: 600, height: 4000 } as DOMRect

/** 宽裕的视口约束：卡片放下不翻转（jsdom 默认视口 1024×768） */
const roomyConstraint = { cardHeight: 240, viewportWidth: 1024, viewportHeight: 768 }

describe('measureAllPlacements：文字目标', () => {
  it('多行文字按行出矩形，徽章锚在最后一行右端，坐标相对覆盖层', () => {
    const range = makeRange()
    layout.rangeRects.set(range, [
      { top: 150, left: 210, width: 300, height: 20 },
      { top: 175, left: 205, width: 120, height: 20 },
    ])
    const [placement] = measureAllPlacements([{ id: 't1', count: 2 }], () => range, layerRect, 320, document_.body, roomyConstraint)
    expect(placement).toMatchObject({ id: 't1', kind: 'text', count: 2 })
    if (placement.kind !== 'text') throw new Error('不是文字目标')
    expect(placement.rects).toEqual([
      { top: 50, left: 10, width: 300, height: 20 },
      { top: 75, left: 5, width: 120, height: 20 },
    ])
    // 最后一行右端 (5 + 120, 75)，卡片在整体下方 8px、左边与整体对齐
    expect(placement.badgeAnchor).toEqual({ top: 75, left: 125 })
    expect(placement.card).toEqual({ top: 95 + 8, left: 5 })
    expect(placement.range).toBe(range)
  })

  it('没有可见矩形（收起的折叠内容）判 hidden，不产出坐标', () => {
    const range = makeRange()
    layout.rangeRects.set(range, [])
    const [placement] = measureAllPlacements([{ id: 'h1', count: 1 }], () => range, layerRect, 320, document_.body, roomyConstraint)
    expect(placement).toEqual({ id: 'h1', kind: 'hidden', count: 1 })
  })

  it('定位函数返回 null 判 missing', () => {
    const [placement] = measureAllPlacements([{ id: 'm1', count: 1 }], () => null, layerRect, 320, document_.body, roomyConstraint)
    expect(placement).toEqual({ id: 'm1', kind: 'missing', count: 1 })
  })

  it('目标不在这个正文子树里（宿主传了别的正文的锚点）也判 missing', () => {
    const otherBody = document_.createElement('div')
    document_.documentElement.append(otherBody)
    try {
      const foreignElement = otherBody.appendChild(document_.createElement('figure'))
      layout.elementRects.set(foreignElement, { top: 300, left: 250, width: 400, height: 150 })
      const foreignRange = (() => {
        const paragraph = otherBody.appendChild(document_.createElement('p'))
        paragraph.append('别的正文里的文字')
        const range = document_.createRange()
        range.selectNodeContents(paragraph.firstChild!)
        return range
      })()
      layout.rangeRects.set(foreignRange, [{ top: 150, left: 210, width: 300, height: 20 }])
      const placements = measureAllPlacements(
        [
          { id: 'foreign-e', count: 1 },
          { id: 'foreign-t', count: 1 },
        ],
        (id) => (id === 'foreign-e' ? foreignElement : foreignRange),
        layerRect,
        320,
        document_.body,
        roomyConstraint,
      )
      expect(placements).toEqual([
        { id: 'foreign-e', kind: 'missing', count: 1 },
        { id: 'foreign-t', kind: 'missing', count: 1 },
      ])
    } finally {
      otherBody.remove()
    }
  })
})

describe('measureAllPlacements：元素目标', () => {
  it('块级元素出外框与右上角徽章锚点', () => {
    const element = makeElement()
    layout.elementRects.set(element, { top: 300, left: 250, width: 400, height: 150 })
    const [placement] = measureAllPlacements([{ id: 'e1', count: 1 }], () => element, layerRect, 320, document_.body, roomyConstraint)
    if (placement.kind !== 'element') throw new Error('不是元素目标')
    expect(placement.box).toEqual({ top: 200, left: 50, width: 400, height: 150 })
    expect(placement.badgeAnchor).toEqual({ top: 200, left: 450 })
    expect(placement.card).toEqual({ top: 350 + 8, left: 50 })
    expect(placement.inline).toBe(false)
  })

  it('行内元素按行内摆放记录 inline', () => {
    const element = makeElement('display: inline')
    layout.elementRects.set(element, { top: 300, left: 250, width: 80, height: 20 })
    const [placement] = measureAllPlacements([{ id: 'e2', count: 1 }], () => element, layerRect, 320, document_.body, roomyConstraint)
    if (placement.kind !== 'element') throw new Error('不是元素目标')
    expect(placement.inline).toBe(true)
  })

  it('零尺寸或没有 client 矩形的元素判 hidden', () => {
    const collapsed = makeElement()
    layout.elementRects.set(collapsed, { top: 0, left: 0, width: 0, height: 0 })
    const [hidden] = measureAllPlacements([{ id: 'e3', count: 1 }], () => collapsed, layerRect, 320, document_.body, roomyConstraint)
    expect(hidden).toEqual({ id: 'e3', kind: 'hidden', count: 1 })
  })

  it('批同一个可见元素的多条并成一条：保留第一条的 id，数量相加', () => {
    const figure = makeElement()
    layout.elementRects.set(figure, { top: 300, left: 250, width: 400, height: 150 })
    const placements = measureAllPlacements(
      [
        { id: 'fig-a', count: 3 },
        { id: 'fig-b', count: 2 },
      ],
      () => figure,
      layerRect,
      320,
      document_.body,
      roomyConstraint,
    )
    expect(placements).toHaveLength(1)
    expect(placements[0]).toMatchObject({ id: 'fig-a', kind: 'element', count: 5 })
  })

  it('同一个不可见元素的多条不并：每条各自上报 hidden', () => {
    const figure = makeElement()
    layout.elementRects.set(figure, { top: 0, left: 0, width: 0, height: 0 })
    const placements = measureAllPlacements(
      [
        { id: 'fig-a', count: 3 },
        { id: 'fig-b', count: 2 },
      ],
      () => figure,
      layerRect,
      320,
      document_.body,
      roomyConstraint,
    )
    expect(placements).toEqual([
      { id: 'fig-a', kind: 'hidden', count: 3 },
      { id: 'fig-b', kind: 'hidden', count: 2 },
    ])
  })
})

describe('卡片位置的视口约束', () => {
  it('目标下方放不下且上方够：卡片翻到目标上方', () => {
    const range = makeRange()
    // 目标视口位置 640..660（相对覆盖层 540..560），卡片高 240：下方 668+240 超出 768-8，上方 640-8-240=392 够
    layout.rangeRects.set(range, [{ top: 640, left: 210, width: 300, height: 20 }])
    const [placement] = measureAllPlacements([{ id: 't1', count: 1 }], () => range, layerRect, 320, document_.body, roomyConstraint)
    if (placement.kind !== 'text') throw new Error('不是文字目标')
    expect(placement.card.top).toBe(640 - 8 - 240 - 100)
  })

  it('上下都放不下（目标又高又贴底）：卡片贴视口底夹限', () => {
    const element = makeElement()
    // 目标视口位置 100..700：下方 708+240 超出，上方 100-8-240 为负，都放不下
    layout.elementRects.set(element, { top: 100, left: 250, width: 400, height: 600 })
    const [placement] = measureAllPlacements([{ id: 'e1', count: 1 }], () => element, layerRect, 320, document_.body, roomyConstraint)
    if (placement.kind !== 'element') throw new Error('不是元素目标')
    expect(placement.card.top).toBe(768 - 8 - 240 - 100)
  })

  it('窄屏：卡片水平位置夹进视口（即使覆盖层比视口宽）', () => {
    const element = makeElement()
    layout.elementRects.set(element, { top: 150, left: 250, width: 400, height: 60 })
    // 视口宽 360、覆盖层左缘在视口 200 处：覆盖层内夹过的 left 50 落到视口 250，超出 360-8-320
    const [placement] = measureAllPlacements([{ id: 'e1', count: 1 }], () => element, layerRect, 320, document_.body, { cardHeight: 240, viewportWidth: 360, viewportHeight: 768 })
    if (placement.kind !== 'element') throw new Error('不是元素目标')
    expect(placement.card.left).toBe(360 - 8 - 320 - 200)
  })

  it('视口变矮（滚动到贴底）后重测：卡片从下方翻到上方', () => {
    const range = makeRange()
    // 目标视口位置 300..320（相对覆盖层 200..220）
    layout.rangeRects.set(range, [{ top: 300, left: 210, width: 300, height: 20 }])
    const tallViewport = { cardHeight: 240, viewportWidth: 1024, viewportHeight: 900 }
    const [before] = measureAllPlacements([{ id: 't1', count: 1 }], () => range, layerRect, 320, document_.body, tallViewport)
    const shortViewport = { cardHeight: 240, viewportWidth: 1024, viewportHeight: 500 }
    const [after] = measureAllPlacements([{ id: 't1', count: 1 }], () => range, layerRect, 320, document_.body, shortViewport)
    if (before.kind !== 'text' || after.kind !== 'text') throw new Error('不是文字目标')
    expect(before.card.top).toBe(320 + 8 - 100)
    expect(after.card.top).toBe(300 - 8 - 240 - 100)
  })
})

describe('samePlacements', () => {
  it('几何与范围相同（Range 对象不同、起止相同）视为相同，保留旧数组', () => {
    const paragraph = document_.body.appendChild(document_.createElement('p'))
    paragraph.append('同一段被批的文字')
    const build = () => {
      const range = document_.createRange()
      range.selectNodeContents(paragraph.firstChild!)
      layout.rangeRects.set(range, [{ top: 150, left: 210, width: 300, height: 20 }])
      return measureAllPlacements([{ id: 't1', count: 1 }], () => range, layerRect, 320, document_.body, roomyConstraint)
    }
    const first = build()
    const second = build()
    expect(first).not.toBe(second)
    expect(samePlacements(first, second)).toBe(true)
  })

  it('坐标或数量变化视为不同', () => {
    const element = makeElement()
    layout.elementRects.set(element, { top: 300, left: 250, width: 400, height: 150 })
    const first = measureAllPlacements([{ id: 'e1', count: 1 }], () => element, layerRect, 320, document_.body, roomyConstraint)
    layout.elementRects.set(element, { top: 310, left: 250, width: 400, height: 150 })
    const moved = measureAllPlacements([{ id: 'e1', count: 1 }], () => element, layerRect, 320, document_.body, roomyConstraint)
    const recounted = measureAllPlacements([{ id: 'e1', count: 4 }], () => element, layerRect, 320, document_.body, roomyConstraint)
    expect(samePlacements(first, moved)).toBe(false)
    expect(samePlacements(first, recounted)).toBe(false)
  })
})
