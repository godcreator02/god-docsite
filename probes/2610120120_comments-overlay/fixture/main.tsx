import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { CommentOverlay, type OverlayMarker, type UnplacedReport } from '../src/index.js'
import { makeResolveTarget, type FixtureAnchor } from './anchors.js'
import { ScrollContainerBody, WindowScrollBody, useRootFontSize } from './body.js'
import './styles.css'

/** 两张尺寸不同的 SVG 图：换图后 figure 高度变化，覆盖层要跟着重测 */
function sampleImage(width: number, height: number, fill: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${fill}" rx="8"/><text x="20" y="${height / 2 + 8}" font-size="22" fill="#fff">示例图片 ${width}×${height}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const images = [sampleImage(520, 180, '#0e7490'), sampleImage(520, 320, '#7c2d12')]

const anchors: readonly FixtureAnchor[] = [
  { markerId: 'fixed-text', count: 2, kind: 'text', scope: '[data-body="window-scroll"]', text: '覆盖层只测量不修改正文', occurrence: 1 },
  { markerId: 'repeated-text', count: 1, kind: 'text', scope: '[data-body="window-scroll"]', text: '这句话重复出现', occurrence: 2 },
  { markerId: 'wrapped-text', count: 3, kind: 'text', scope: '[data-body="window-scroll"]', text: '从这一行开始，一直到这里为止都属于被批的范围', occurrence: 1 },
  { markerId: 'code-block', count: 1, kind: 'element', scope: '[data-body="window-scroll"]', selector: '#code-block' },
  { markerId: 'fig-a', count: 2, kind: 'element', scope: '[data-body="window-scroll"]', selector: '#sample-figure' },
  { markerId: 'fig-b', count: 1, kind: 'element', scope: '[data-body="window-scroll"]', selector: '#sample-figure' },
  { markerId: 'folded-text', count: 1, kind: 'text', scope: '[data-body="window-scroll"]', text: '折叠内容里被批的固定文字', occurrence: 1 },
  { markerId: 'widget-text', count: 1, kind: 'text', scope: '[data-body="window-scroll"]', text: '自定义折叠组件里被批的文字', occurrence: 1 },
  { markerId: 'gone', count: 1, kind: 'missing' },
  { markerId: 'scroller-top', count: 1, kind: 'text', scope: '[data-body="scroll-container"]', text: '滚动容器顶部目标', occurrence: 1 },
  { markerId: 'scroller-mid', count: 1, kind: 'text', scope: '[data-body="scroll-container"]', text: '滚动容器中部目标', occurrence: 1 },
  { markerId: 'scroller-bottom', count: 1, kind: 'text', scope: '[data-body="scroll-container"]', text: '滚动容器底部目标', occurrence: 1 },
]

/** 每个覆盖层实例只管自己正文里的标记：这是宿主的用法约定（组件也会把目标不在本正文里的判为找不到） */
const windowScrollMarkers: ReadonlyArray<OverlayMarker> = anchors.filter((anchor) => anchor.kind === 'missing' || anchor.scope === '[data-body="window-scroll"]').map(({ markerId, count }) => ({ id: markerId, count }))
const scrollerMarkers: ReadonlyArray<OverlayMarker> = anchors.filter((anchor) => anchor.kind !== 'missing' && anchor.scope === '[data-body="scroll-container"]').map(({ markerId, count }) => ({ id: markerId, count }))

/** 找不到时的说明文字：给人看的锚点名 */
const anchorLabels: Record<string, string> = {
  'fixed-text': '固定文字',
  'repeated-text': '重复文本（第 2 次）',
  'wrapped-text': '跨多行长段',
  'code-block': '代码块',
  'fig-a': '图片 figure（A）',
  'fig-b': '图片 figure（B，与 A 同元素并组）',
  'folded-text': 'details 里被批的文字',
  'widget-text': 'aria 折叠组件里被批的文字',
  gone: '定位不到（宿主返回 null）',
  'scroller-top': '滚动容器顶部',
  'scroller-mid': '滚动容器中部',
  'scroller-bottom': '滚动容器底部',
}

function App() {
  const [windowBody, setWindowBody] = useState<HTMLElement | null>(null)
  const [scrollerBody, setScrollerBody] = useState<HTMLElement | null>(null)
  const [fontScale, setFontScale] = useState(1)
  const [extraSentences, setExtraSentences] = useState(0)
  const [imageIndex, setImageIndex] = useState(0)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [widgetOpen, setWidgetOpen] = useState(false)
  const [windowUnplaced, setWindowUnplaced] = useState<UnplacedReport>({ missing: [], hidden: [] })
  const [scrollerUnplaced, setScrollerUnplaced] = useState<UnplacedReport>({ missing: [], hidden: [] })
  const [lastActivated, setLastActivated] = useState<string | null>(null)
  const [bodyCheck, setBodyCheck] = useState<string | null>(null)
  const bodySnapshots = useRef<Map<HTMLElement, string>>(new Map())

  useRootFontSize(fontScale)

  // markers / resolveTarget 用稳定引用：覆盖层的观察接线只在挂载时装一次
  const resolveTarget = useMemo(() => makeResolveTarget(anchors), [])
  // 两个覆盖层实例分开收报告，各自报自己正文里的状态；面板显示合并结果
  const onWindowUnplacedChange = useCallback((report: UnplacedReport) => setWindowUnplaced(report), [])
  const onScrollerUnplacedChange = useCallback((report: UnplacedReport) => setScrollerUnplaced(report), [])
  const onActivate = useCallback((id: string | null) => setLastActivated(id), [])
  const renderCard = useCallback(
    (id: string) => (
      <div className="demo-card">
        <strong>评论卡片：{anchorLabels[id] ?? id}</strong>
        <p>这条卡片由宿主经 renderCard 渲染，覆盖层只负责定位与弹出。卡片里的文字可以选中，链接可以点：</p>
        <p>
          <a href="#bottom-note">卡片里的链接</a>
        </p>
        <p className="demo-card-meta">marker id：{id}</p>
      </div>
    ),
    [],
  )

  // 挂载稳定后记一份正文快照，供「校验正文未被标注」对比
  useEffect(() => {
    const timer = setTimeout(() => {
      for (const body of [windowBody, scrollerBody]) if (body) bodySnapshots.current.set(body, body.outerHTML)
    }, 300)
    return () => clearTimeout(timer)
  }, [windowBody, scrollerBody])

  const checkBodies = () => {
    const lines: string[] = []
    for (const body of [windowBody, scrollerBody]) {
      if (!body) continue
      const label = body.dataset.body
      const polluted = [...body.querySelectorAll('[data-comment-overlay],[data-comment-overlay-badge],[data-comment-overlay-frame],[data-comment-overlay-card],[data-commented-element],[data-comment-ui]')]
      const changed = bodySnapshots.current.get(body) !== body.outerHTML
      lines.push(`${label}：标注类元素 ${polluted.length} 个；结构${changed ? '有变化（宿主控件或重排按钮自己改的也算）' : '与挂载后一致'}`)
    }
    setBodyCheck(lines.join('　|　') || '正文尚未挂载')
  }

  /** 宿主替读者展开收起的内容：这是宿主的交互，覆盖层只报「看不见」，不自己改正文 */
  const revealHidden = (id: string) => {
    if (id === 'folded-text') setDetailsOpen(true)
    if (id === 'widget-text') setWidgetOpen(true)
  }

  const mergedUnplaced: UnplacedReport = { missing: [...windowUnplaced.missing, ...scrollerUnplaced.missing], hidden: [...windowUnplaced.hidden, ...scrollerUnplaced.hidden] }

  return (
    <div className="page">
      <header className="toolbar">
        <strong>评论覆盖层 fixture（任务 O）</strong>
        <span className="toolbar-hint">最近激活：{lastActivated === null ? '（无）' : `${lastActivated} ${anchorLabels[lastActivated] ?? ''}`}</span>
        <div className="toolbar-group">
          <button type="button" onClick={() => setFontScale((scale) => (scale === 1 ? 1.25 : 1))}>
            字号 {fontScale === 1 ? '1rem → 1.25rem' : '1.25rem → 1rem'}
          </button>
          <button type="button" onClick={() => setExtraSentences((count) => count + 1)}>
            重排：往重复文本段加一句
          </button>
          <button type="button" onClick={() => setImageIndex((index) => (index + 1) % images.length)}>
            换图片（{imageIndex === 0 ? '520×180 → 520×320' : '520×320 → 520×180'}）
          </button>
          <button type="button" onClick={checkBodies}>
            校验正文未被标注
          </button>
        </div>
        {bodyCheck && <p className="toolbar-check">{bodyCheck}</p>}
      </header>

      <aside className="unplaced-panel">
        <strong>无定位的评论（覆盖层明确上报，不乱飘）</strong>
        {mergedUnplaced.missing.map((id) => (
          <p key={id} className="unplaced-item missing">
            原文找不到了：{anchorLabels[id] ?? id}
          </p>
        ))}
        {mergedUnplaced.hidden.map((id) => (
          <p key={id} className="unplaced-item hidden">
            看不见（收起中）：{anchorLabels[id] ?? id}
            {(id === 'folded-text' || id === 'widget-text') && (
              <button type="button" className="reveal" onClick={() => revealHidden(id)}>
                由宿主展开（自动展开是宿主的职责）
              </button>
            )}
          </p>
        ))}
        {mergedUnplaced.missing.length === 0 && mergedUnplaced.hidden.length === 0 && <p className="unplaced-item none">（当前没有无定位的评论）</p>}
      </aside>

      <main>
        <section className="demo-section">
          <h1>正文外评论悬浮层</h1>
          <p className="section-note">下面的正文是一个普通 article，覆盖层是它的兄弟节点。徽章、元素框、卡片都在正文容器外面。</p>
          <div className="overlay-host">
            <WindowScrollBody
              bodyRef={setWindowBody}
              extraSentences={extraSentences}
              imageSource={images[imageIndex]}
              detailsOpen={detailsOpen}
              onDetailsOpenChange={setDetailsOpen}
              widgetOpen={widgetOpen}
              onWidgetOpenChange={setWidgetOpen}
            />
            <CommentOverlay bodyRoot={windowBody} markers={windowScrollMarkers} resolveTarget={resolveTarget} onActivate={onActivate} onUnplacedChange={onWindowUnplacedChange} renderCard={renderCard} />
          </div>
        </section>

        <section className="demo-section">
          <h2>正文在滚动容器里</h2>
          <p className="section-note">容器高度固定、内部滚动。徽章坐标在内容坐标系里，滚动容器或滚动窗口时跟随内容。</p>
          <div className="overlay-host scroll-box">
            <ScrollContainerBody bodyRef={setScrollerBody} />
            <CommentOverlay bodyRoot={scrollerBody} markers={scrollerMarkers} resolveTarget={resolveTarget} onActivate={onActivate} onUnplacedChange={onScrollerUnplacedChange} renderCard={renderCard} />
          </div>
        </section>

        <p id="bottom-note" className="bottom-note">
          页脚：正文链接与卡片链接都指到这里，用来验证覆盖层不拦正文与卡片里的链接。
        </p>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
