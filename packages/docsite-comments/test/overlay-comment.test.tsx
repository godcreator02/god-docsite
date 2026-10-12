import { StrictMode, act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommentOverlay, type OverlayMarker, type UnplacedReport } from '../src/overlay/index.js'
import { installFakeHighlights, installFakeLayout, installFakeResizeObserver, nextAnimationFrame } from './overlay-test-utils.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let layout: ReturnType<typeof installFakeLayout>
let resizeObserver: ReturnType<typeof installFakeResizeObserver>
let root: Root | undefined
let container: HTMLDivElement

beforeEach(() => {
  layout = installFakeLayout()
  resizeObserver = installFakeResizeObserver()
  container = document.body.appendChild(document.createElement('div'))
})

afterEach(() => {
  root?.unmount()
  root = undefined
  container.remove()
  resizeObserver.uninstall()
  layout.uninstall()
})

function collectTextNodes(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text)
  return nodes
}

type HostProps = {
  markers: ReadonlyArray<OverlayMarker>
  resolveTarget: (id: string) => Range | Element | null
  activeId?: string | null
  onActivate?: (id: string | null) => void
  onUnplacedChange?: (report: UnplacedReport) => void
  renderCard?: (id: string) => React.ReactNode
}

function Host(props: HostProps) {
  const [bodyRoot, setBodyRoot] = useState<HTMLDivElement | null>(null)
  return (
    <div style={{ position: 'relative' }}>
      <div id="body" ref={setBodyRoot}>
        <p>
          开头一段，<em id="quote">被批的一句话</em>，后面还有一个<a href="#nowhere" id="body-link">正文链接</a>。
        </p>
        <div id="folded" hidden>
          收起内容里看不见的文字
        </div>
      </div>
      <CommentOverlay
        bodyRoot={bodyRoot}
        markers={props.markers}
        resolveTarget={props.resolveTarget}
        activeId={props.activeId}
        onActivate={props.onActivate}
        onUnplacedChange={props.onUnplacedChange}
        renderCard={props.renderCard}
      />
    </div>
  )
}

/** 挂载 Host：正文里 em#quote 的文字是被批目标（每次定位都新建 Range，模拟宿主行为） */
async function mountHost(props: HostProps) {
  const resolveTarget = vi.fn(props.resolveTarget)
  root = createRoot(container)
  act(() => {
    root!.render(
      <StrictMode>
        <Host {...props} resolveTarget={resolveTarget} />
      </StrictMode>,
    )
  })
  const bodyRoot = container.querySelector<HTMLDivElement>('#body')!
  const overlay = container.querySelector<HTMLDivElement>('[data-comment-overlay]')!
  // fonts.ready 的那次重测也收进 act，避免测试外的状态更新警告
  await act(async () => {
    await nextAnimationFrame()
  })
  return { resolveTarget, bodyRoot, overlay }
}

function quoteRange(): Range {
  const quote = document.querySelector<HTMLElement>('#quote')!
  const range = document.createRange()
  range.selectNodeContents(quote.firstChild!)
  layout.rangeRects.set(range, [{ top: 40, left: 20, width: 200, height: 24 }])
  return range
}

describe('CommentOverlay：正文不被标注修改', () => {
  it('挂载、激活、卸载后正文的结构与文字节点原样，正文里没有任何标注属性', async () => {
    const { bodyRoot, overlay } = await mountHost({ markers: [{ id: 't1', count: 2 }], resolveTarget: () => quoteRange() })
    const htmlBefore = bodyRoot.outerHTML
    const textsBefore = collectTextNodes(bodyRoot)

    const badge = overlay.querySelector<HTMLButtonElement>('[data-comment-overlay-badge]')!
    act(() => {
      badge.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(bodyRoot.outerHTML).toBe(htmlBefore)
    expect(collectTextNodes(bodyRoot)).toEqual(textsBefore)
    expect(bodyRoot.querySelectorAll('[data-comment-overlay], [data-comment-overlay-badge], [data-commented-element], [data-comment-ui], [contenteditable]')).toHaveLength(0)
    // 覆盖层是正文的兄弟，不在正文里面
    expect(bodyRoot.contains(overlay)).toBe(false)
    expect(overlay.parentElement).toBe(bodyRoot.parentElement)
  })

  it('正文里的文字节点没有被切开或包进新节点：引用逐一相同', async () => {
    const { bodyRoot } = await mountHost({ markers: [{ id: 't1', count: 1 }], resolveTarget: () => quoteRange() })
    const texts = collectTextNodes(bodyRoot)
    expect(texts.length).toBeGreaterThanOrEqual(3)
    const quote = document.querySelector<HTMLElement>('#quote')!
    expect(quote.firstChild).toBe(texts.find((text) => text.data.includes('被批的一句话')))
    expect(quote.childNodes).toHaveLength(1)
  })
})

describe('CommentOverlay：覆盖层结构与定位', () => {
  it('覆盖层不拦正文（pointer-events:none），徽章与卡片可交互', async () => {
    const { overlay } = await mountHost({ markers: [{ id: 't1', count: 2 }], resolveTarget: () => quoteRange(), renderCard: (id) => `卡片：${id}` })
    expect(overlay.style.pointerEvents).toBe('none')
    const badge = overlay.querySelector<HTMLButtonElement>('[data-comment-overlay-badge]')!
    expect(badge.style.pointerEvents).toBe('auto')
    act(() => {
      badge.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const card = overlay.querySelector<HTMLElement>('[data-comment-overlay-card]')!
    expect(card.style.pointerEvents).toBe('auto')
    expect(card.textContent).toContain('卡片：t1')
  })

  it('徽章按测量锚点定位（覆盖层坐标），数量显示在徽章上', async () => {
    const { overlay } = await mountHost({ markers: [{ id: 't1', count: 7 }], resolveTarget: () => quoteRange() })
    const badge = overlay.querySelector<HTMLButtonElement>('[data-comment-overlay-badge]')!
    // quoteRange 唯一一行矩形 (40, 20, 200×24)，覆盖层未注册几何（零位）→ 相对坐标相同
    expect(badge.style.top).toBe('40px')
    expect(badge.style.left).toBe('220px')
    expect(badge.textContent).toBe('7')
    expect(badge.getAttribute('aria-label')).toContain('7')
  })

  it('批同一元素的多条并成一个徽章，数量相加', async () => {
    let figure: HTMLElement | null = null
    const { overlay } = await mountHost({
      markers: [
        { id: 'fig-a', count: 2 },
        { id: 'fig-b', count: 3 },
      ],
      resolveTarget: (id) => (id.startsWith('fig') ? figure : quoteRange()),
    })
    figure = document.createElement('figure')
    layout.elementRects.set(figure, { top: 100, left: 10, width: 300, height: 120 })
    const bodyRoot = container.querySelector<HTMLDivElement>('#body')!
    await act(async () => {
      bodyRoot.append(figure)
      await nextAnimationFrame()
    })
    const badges = overlay.querySelectorAll('[data-comment-overlay-badge]')
    expect(badges).toHaveLength(1)
    expect(badges[0].textContent).toBe('5')
    expect(overlay.querySelectorAll('[data-comment-overlay-frame]')).toHaveLength(1)
  })
})

describe('CommentOverlay：激活交互', () => {
  it('点徽章激活、再点取消，onActivate 收到 id 与 null', async () => {
    const onActivate = vi.fn()
    const { overlay } = await mountHost({ markers: [{ id: 't1', count: 1 }], resolveTarget: () => quoteRange(), onActivate })
    const badge = overlay.querySelector<HTMLButtonElement>('[data-comment-overlay-badge]')!
    act(() => {
      badge.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onActivate).toHaveBeenCalledWith('t1')
    expect(badge.getAttribute('aria-pressed')).toBe('true')
    act(() => {
      badge.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onActivate).toHaveBeenLastCalledWith(null)
  })

  it('点正文里被高亮的文字激活；点正文链接不抢，点空白处取消', async () => {
    const onActivate = vi.fn()
    const { bodyRoot } = await mountHost({ markers: [{ id: 't1', count: 1 }], resolveTarget: () => quoteRange(), onActivate })
    const quote = document.querySelector<HTMLElement>('#quote')!
    act(() => {
      quote.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 50 }))
    })
    expect(onActivate).toHaveBeenCalledWith('t1')
    // 点正文自己的链接：不激活
    onActivate.mockClear()
    const link = document.querySelector<HTMLAnchorElement>('#body-link')!
    act(() => {
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 50 }))
    })
    expect(onActivate).not.toHaveBeenCalled()
    // 点没被批的普通文字：取消激活
    const plain = bodyRoot.firstElementChild!
    act(() => {
      plain.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 500, clientY: 400 }))
    })
    expect(onActivate).toHaveBeenLastCalledWith(null)
  })

  it('受控模式：activeId 由宿主传入时卡片跟随 props', async () => {
    const { overlay } = await mountHost({ markers: [{ id: 't1', count: 1 }], resolveTarget: () => quoteRange(), activeId: 't1', renderCard: (id) => `受控卡片：${id}` })
    const card = overlay.querySelector<HTMLElement>('[data-comment-overlay-card]')!
    expect(card.textContent).toBe('受控卡片：t1')
  })
})

describe('CommentOverlay：无定位上报与重测', () => {
  it('定位不到与看不见的目标不渲染徽章，经 onUnplacedChange 上报', async () => {
    const onUnplacedChange = vi.fn()
    const { overlay } = await mountHost({
      markers: [
        { id: 'gone', count: 1 },
        { id: 'folded', count: 1 },
        { id: 't1', count: 1 },
      ],
      resolveTarget: (id) => {
        if (id === 'gone') return null
        if (id === 'folded') {
          const folded = document.querySelector<HTMLElement>('#folded')!
          const range = document.createRange()
          range.selectNodeContents(folded)
          layout.rangeRects.set(range, [])
          return range
        }
        return quoteRange()
      },
      onUnplacedChange,
    })
    expect(overlay.querySelectorAll('[data-comment-overlay-badge]')).toHaveLength(1)
    const reports = onUnplacedChange.mock.calls.map(([report]) => report)
    expect(reports.at(-1)).toEqual({ missing: ['gone'], hidden: ['folded'] })
  })

  it('正文变化时重新定位（MutationObserver → 重测）', async () => {
    const { resolveTarget, bodyRoot } = await mountHost({ markers: [{ id: 't1', count: 1 }], resolveTarget: () => quoteRange() })
    const callsAfterMount = resolveTarget.mock.calls.length
    await act(async () => {
      bodyRoot.querySelector('p')!.append('又加了一句。')
      await nextAnimationFrame()
    })
    expect(resolveTarget.mock.calls.length).toBeGreaterThan(callsAfterMount)
  })
})

describe('CommentOverlay：卸载清理', () => {
  it('卸载后清掉本实例的 CSS Custom Highlight 注册', async () => {
    const highlights = installFakeHighlights()
    try {
      const { overlay } = await mountHost({ markers: [{ id: 't1', count: 1 }], resolveTarget: () => quoteRange() })
      const keys = [...highlights.store.keys()]
      expect(keys).toHaveLength(1)
      expect(keys[0]).toMatch(/^docsite-comments-overlay-/)
      expect(overlay).toBeTruthy()
      root!.unmount()
      root = undefined
      expect(highlights.store.size).toBe(0)
    } finally {
      highlights.uninstall()
    }
  })

  it('卸载后正文点击不再触发激活，正文结构仍原样', async () => {
    const onActivate = vi.fn()
    const { bodyRoot } = await mountHost({ markers: [{ id: 't1', count: 1 }], resolveTarget: () => quoteRange(), onActivate })
    const htmlBefore = bodyRoot.outerHTML
    // 把正文移出 React 树再卸载：正文保住，监听器该随 effect 清理一起消失
    document.body.append(bodyRoot)
    root!.unmount()
    root = undefined
    const quote = bodyRoot.querySelector<HTMLElement>('#quote')!
    act(() => {
      quote.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 50 }))
    })
    expect(onActivate).not.toHaveBeenCalled()
    expect(bodyRoot.outerHTML).toBe(htmlBefore)
    // 移出 React 树的正文要删掉：留在 document.body 里会污染后续用例的 #quote 查询
    bodyRoot.remove()
  })
})

describe('CommentOverlay：多实例', () => {
  function TwoOverlays(props: { resolveEach: (index: number) => (id: string) => Range | Element | null }) {
    const [bodyA, setBodyA] = useState<HTMLDivElement | null>(null)
    const [bodyB, setBodyB] = useState<HTMLDivElement | null>(null)
    const markers = [{ id: 't1', count: 1 }]
    return (
      <>
        <div style={{ position: 'relative' }}>
          <div id="body-a" ref={setBodyA}>
            <p>
              <em id="quote-a">实例甲的被批文字</em>
            </p>
          </div>
          <CommentOverlay bodyRoot={bodyA} markers={markers} resolveTarget={props.resolveEach(0)} />
        </div>
        <div style={{ position: 'relative' }}>
          <div id="body-b" ref={setBodyB}>
            <p>
              <em id="quote-b">实例乙的被批文字</em>
            </p>
          </div>
          <CommentOverlay bodyRoot={bodyB} markers={markers} resolveTarget={props.resolveEach(1)} />
        </div>
      </>
    )
  }

  /** 两个实例各自的文字目标（每次定位新建 Range，带假矩形） */
  function makeQuoteRange(quoteSelector: string, top: number): Range {
    const quote = document.querySelector<HTMLElement>(quoteSelector)!
    const range = document.createRange()
    range.selectNodeContents(quote.firstChild!)
    layout.rangeRects.set(range, [{ top, left: 20, width: 200, height: 24 }])
    return range
  }

  it('同一棵树里的两个实例各持自己的高亮注册名，卸载一起清干净', async () => {
    const highlights = installFakeHighlights()
    try {
      root = createRoot(container)
      await act(async () => {
        root!.render(
          <StrictMode>
            <TwoOverlays resolveEach={(index) => (index === 0 ? () => makeQuoteRange('#quote-a', 40) : () => makeQuoteRange('#quote-b', 80))} />
          </StrictMode>,
        )
        await nextAnimationFrame()
      })
      const overlays = container.querySelectorAll('[data-comment-overlay]')
      expect(overlays).toHaveLength(2)
      const keys = [...highlights.store.keys()]
      expect(keys).toHaveLength(2)
      expect(new Set(keys).size).toBe(2)
      // 两个注册名里的 range 各自指向自己实例的正文
      const texts = keys.map((key) => (highlights.store.get(key) as { ranges: Range[] }).ranges[0].toString())
      expect(texts.some((text) => text.includes('实例甲'))).toBe(true)
      expect(texts.some((text) => text.includes('实例乙'))).toBe(true)
      root!.unmount()
      root = undefined
      expect(highlights.store.size).toBe(0)
    } finally {
      highlights.uninstall()
    }
  })

  it('两个实例互不干扰地各自激活（受控），乙的注册名在甲卸载后仍在', async () => {
    const highlights = installFakeHighlights()
    let rootB: Root | undefined
    try {
      const hostA = container.appendChild(document.createElement('div'))
      const hostB = container.appendChild(document.createElement('div'))
      const rootA = createRoot(hostA)
      root = rootA
      rootB = createRoot(hostB)
      const Single = ({ quoteId, top }: { quoteId: string; top: number }) => {
        const [bodyRoot, setBodyRoot] = useState<HTMLDivElement | null>(null)
        return (
          <div style={{ position: 'relative' }}>
            <div ref={setBodyRoot}>
              <p>
                <em id={quoteId}>{quoteId} 的被批文字</em>
              </p>
            </div>
            <CommentOverlay bodyRoot={bodyRoot} markers={[{ id: 't1', count: 1 }]} resolveTarget={() => makeQuoteRange(`#${quoteId}`, top)} />
          </div>
        )
      }
      await act(async () => {
        rootA.render(
          <StrictMode>
            <Single quoteId="quote-a" top={40} />
          </StrictMode>,
        )
        await nextAnimationFrame()
      })
      await act(async () => {
        rootB?.render(
          <StrictMode>
            <Single quoteId="quote-b" top={80} />
          </StrictMode>,
        )
        await nextAnimationFrame()
      })
      const keys = [...highlights.store.keys()]
      expect(keys).toHaveLength(2)
      const [keyA] = keys
      // 卸载甲：只剩乙的注册名
      await act(async () => {
        rootA.unmount()
        await nextAnimationFrame()
      })
      root = undefined
      const remaining = [...highlights.store.keys()]
      expect(remaining).toHaveLength(1)
      expect(remaining[0]).not.toBe(keyA)
      // 乙的高亮 range 仍指向自己的正文
      const survivor = highlights.store.get(remaining[0]) as { ranges: Range[] }
      expect(survivor.ranges[0].toString()).toContain('quote-b')
    } finally {
      rootB?.unmount()
      highlights.uninstall()
    }
  })
})

describe('CommentOverlay：卡片位置的视口约束', () => {
  const originalInnerHeight = window.innerHeight
  const originalInnerWidth = window.innerWidth

  afterEach(() => {
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, configurable: true })
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, configurable: true })
  })

  it('卡片实测高度返回测量：贴底目标按实测高度翻到上方', async () => {
    Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true })
    // 覆盖层在视口顶部（layerRect 未注册零位）：目标视口位置 320..344，下方放不下高卡片，翻到上方
    const resolveTarget = () => {
      const range = document.createRange()
      const quote = document.querySelector<HTMLElement>('#quote')!
      range.selectNodeContents(quote.firstChild!)
      layout.rangeRects.set(range, [{ top: 320, left: 20, width: 200, height: 24 }])
      return range
    }
    // 激活挂载：卡片渲染（jsdom 实测高度为 0，先按下方放）；翻转/夹限的判定本身由 placement 纯函数测试覆盖
    const { overlay, bodyRoot } = await mountHost({ markers: [{ id: 't1', count: 1 }], resolveTarget, activeId: 't1', renderCard: (id) => `卡片：${id}` })
    const card = overlay.querySelector<HTMLElement>('[data-comment-overlay-card]')!
    expect(card).not.toBeNull()
    // 卡片实测高度（stub 200）变化后补测一轮：上方 = 320-8-200 = 112
    Object.defineProperty(card, 'offsetHeight', { value: 200, configurable: true })
    await act(async () => {
      bodyRoot.querySelector('p')!.append(' ')
      await nextAnimationFrame()
    })
    expect(card.style.top).toBe('112px')
  })

  it('窄屏：卡片水平夹进视口', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 300, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
    const resolveTarget = () => {
      const range = document.createRange()
      const quote = document.querySelector<HTMLElement>('#quote')!
      range.selectNodeContents(quote.firstChild!)
      layout.rangeRects.set(range, [{ top: 40, left: 20, width: 200, height: 24 }])
      return range
    }
    const { overlay } = await mountHost({ markers: [{ id: 't1', count: 1 }], resolveTarget, activeId: 't1', renderCard: () => '卡片' })
    const card = overlay.querySelector<HTMLElement>('[data-comment-overlay-card]')!
    // 卡片宽 320 > 视口 300-16：viewportLeft 夹到 8（覆盖层左缘在视口 0）
    expect(card.style.left).toBe('8px')
  })
})
