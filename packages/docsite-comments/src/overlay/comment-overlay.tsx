import { useEffect, useId, useInsertionEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createHighlightPainter, highlightsAvailable } from './highlight.js'
import { overlayCssFor } from './overlay-css.js'
import { defaultCardHeight, measureAllPlacements, samePlacements, type MarkerPlacement } from './placement.js'

/** 一条评论标记：宿主聚合后的数量（批同一个元素的几串由宿主并成一条传入；组件对同元素的目标还会再并一次） */
export type OverlayMarker = {
  id: string
  count: number
}

/** 明确无定位的评论：missing 是定位函数返回 null，hidden 是目标在正文里但当前看不见（收起、隐藏） */
export type UnplacedReport = { missing: readonly string[]; hidden: readonly string[] }

export type CommentOverlayProps = {
  /** 正文根：被批的内容都在它里面。组件只读它，不修改它；null 时覆盖层空着 */
  bodyRoot: HTMLElement | null
  markers: ReadonlyArray<OverlayMarker>
  /** 宿主提供的只读定位：评论 id → 它锚定的文字范围或元素；返回 null 表示找不到。每轮测量都会重新调用 */
  resolveTarget: (id: string) => Range | Element | null
  /** 当前激活的评论 id：传了（含 null）就是受控，不传时组件自己记 */
  activeId?: string | null
  /** 点徽章、点高亮文字时通知宿主；null 表示取消激活 */
  onActivate?: (id: string | null) => void
  /** 无定位的评论集合变化时通知宿主；要不要展开收起的内容由宿主决定，覆盖层不碰正文 */
  onUnplacedChange?: (report: UnplacedReport) => void
  /** 激活时弹出的卡片内容：宿主在这里渲染评论；不传则只高亮不弹卡片 */
  renderCard?: (id: string) => ReactNode
  /** 卡片宽度，默认 320 */
  cardWidth?: number
}

/**
 * 正文外的评论悬浮层。用法：宿主在一个 position: relative、包住正文、随正文长高的容器里，
 * 把它渲染成正文容器的兄弟节点（覆盖层 absolute inset:0、pointer-events:none，不拦正文的选择、链接与控件）。
 * 徽章、元素框、卡片都是覆盖层自己的 DOM；正文只被测量，不被标注（不插 span、不切文字节点、不写属性）。
 * 文字高亮走 CSS Custom Highlight API，注册名按实例隔离：一页可以挂多个覆盖层实例，互不覆盖、卸载只清自己的。
 * 窗口滚动与正文滚动容器都跟随：坐标在内容坐标系里，随内容一起滚。
 */
export function CommentOverlay(props: CommentOverlayProps) {
  const { bodyRoot, markers, resolveTarget, renderCard, cardWidth = 320 } = props
  const layerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [placements, setPlacements] = useState<MarkerPlacement[]>([])
  const [internalActiveId, setInternalActiveId] = useState<string | null>(null)
  const activeId = props.activeId !== undefined ? props.activeId : internalActiveId

  // 本实例的高亮注册名与样式：useId 在 SSR 与客户端一致，清洗成 CSS 标识符安全的字符
  const instanceKey = useId().replace(/[^a-zA-Z0-9_-]/g, '') || 'x'
  const painter = useMemo(() => createHighlightPainter(instanceKey), [instanceKey])

  // 回调放 ref：宿主传内联函数不会让观察接线反复拆装（测量输入 markers/resolveTarget 仍走依赖，行为变化会重测）
  const onActivateRef = useRef(props.onActivate)
  onActivateRef.current = props.onActivate
  const onUnplacedChangeRef = useRef(props.onUnplacedChange)
  onUnplacedChangeRef.current = props.onUnplacedChange

  useInsertionEffect(() => {
    const style = document.createElement('style')
    style.textContent = overlayCssFor(instanceKey)
    document.head.append(style)
    return () => style.remove()
  }, [instanceKey])

  const lastReportRef = useRef<UnplacedReport | null>(null)
  /** 上一轮测量采用的卡片高度：卡片渲染后实测高度与它差得多就重新测一轮 */
  const cardHeightUsedRef = useRef<number>(defaultCardHeight)
  const scheduleMeasureRef = useRef<() => void>(undefined)

  // 集中测量与调度：一套 ResizeObserver + MutationObserver + 资源 load 监听，全部经 rAF 合并成一轮测量。
  // 只观察正文根，覆盖层是它的兄弟节点，自己的 DOM 变化不会触发自己。
  useEffect(() => {
    if (!bodyRoot) {
      setPlacements([])
      return
    }
    let frame = 0
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined
    const measure = () => {
      const layer = layerRef.current
      if (!layer) return
      const layerRect = layer.getBoundingClientRect()
      // 卡片位置的视口约束用实测高度：卡片还没渲染时用上轮的（首轮是估计值），渲染后按实测重算
      const cardHeight = cardRef.current?.offsetHeight ?? cardHeightUsedRef.current ?? defaultCardHeight
      cardHeightUsedRef.current = cardHeight
      const next = measureAllPlacements(markers, resolveTarget, layerRect, cardWidth, bodyRoot, { cardHeight, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight })
      setPlacements((current) => (samePlacements(current, next) ? current : next))
      const report: UnplacedReport = {
        missing: next.filter((placement) => placement.kind === 'missing').map((placement) => placement.id),
        hidden: next.filter((placement) => placement.kind === 'hidden').map((placement) => placement.id),
      }
      const last = lastReportRef.current
      if (!last || last.missing.join() !== report.missing.join() || last.hidden.join() !== report.hidden.join()) {
        lastReportRef.current = report
        onUnplacedChangeRef.current?.(report)
      }
    }
    // cancelAnimationFrame 已合并重复排队；不能再设「测量中」标志：页面不可见时 rAF 不执行，
    // 标志会永久卡住，之后所有重测都被吞掉（切换标签页回来就再也不更新）
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame)
      if (fallbackTimer !== undefined) clearTimeout(fallbackTimer)
      // rAF 帧同步优先；宿主节流 rAF（visibilityState 仍是 visible 的嵌入视图）时由 setTimeout 兜底接管。
      // 谁先到谁跑并撤销另一个，同一轮调度只测一次
      const runMeasure = () => {
        cancelAnimationFrame(frame)
        frame = 0
        if (fallbackTimer !== undefined) clearTimeout(fallbackTimer)
        fallbackTimer = undefined
        measure()
      }
      frame = requestAnimationFrame(runMeasure)
      fallbackTimer = setTimeout(runMeasure, 150)
    }
    scheduleMeasureRef.current = scheduleMeasure
    const resizeObserver = new ResizeObserver(scheduleMeasure)
    resizeObserver.observe(bodyRoot)
    const mutationObserver = new MutationObserver(scheduleMeasure)
    // attributes 全听：折叠动画、宿主组件改 class/style 也会移动正文
    mutationObserver.observe(bodyRoot, { childList: true, subtree: true, characterData: true, attributes: true })
    bodyRoot.addEventListener('load', scheduleMeasure, true)
    // 坐标是内容系的，理论上滚动不用重测；真实浏览器存在一次性竞态（scroll restoration、锚定）会让一次测量过期，
    // 滚动重测是最可靠的自愈，rAF 合并下每帧最多一次。滚动也改变卡片与视口的关系（翻转/夹限），要跟着重算
    window.addEventListener('scroll', scheduleMeasure, true)
    // 视口宽度变化不一定改变正文尺寸（max-width 正文），但会改变居中正文与覆盖层的相对位置
    window.addEventListener('resize', scheduleMeasure)
    // 页面回到可见时 rAF 恢复执行，把不可见期间错过的变化补上
    const measureWhenVisible = () => {
      if (!document.hidden) scheduleMeasure()
    }
    document.addEventListener('visibilitychange', measureWhenVisible)
    measure()
    scheduleMeasure()
    void document.fonts?.ready.then(scheduleMeasure)
    return () => {
      scheduleMeasureRef.current = undefined
      cancelAnimationFrame(frame)
      if (fallbackTimer !== undefined) clearTimeout(fallbackTimer)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      bodyRoot.removeEventListener('load', scheduleMeasure, true)
      window.removeEventListener('scroll', scheduleMeasure, true)
      window.removeEventListener('resize', scheduleMeasure)
      document.removeEventListener('visibilitychange', measureWhenVisible)
    }
  }, [bodyRoot, markers, resolveTarget, cardWidth])

  // 文字高亮（浏览器有 CSS Custom Highlight API 才画；几何没变时 placements 引用不变，这里不会重跑）
  useEffect(() => {
    if (!highlightsAvailable()) return
    const textPlacements = placements.filter((placement): placement is Extract<MarkerPlacement, { kind: 'text' }> => placement.kind === 'text')
    const active = textPlacements.find((placement) => placement.id === activeId)
    painter.paint(textPlacements.map((placement) => placement.range), active?.range)
    return () => painter.clear()
  }, [placements, activeId, painter])

  const activate = (id: string | null) => {
    setInternalActiveId(id)
    onActivateRef.current?.(id)
  }

  // 点正文里的高亮文字打开对应评论；命中正文自己的交互元素（链接、控件）时不抢。
  // 覆盖层 pointer-events:none，点击落在正文上，这里不做 preventDefault，正文行为照旧。
  useEffect(() => {
    if (!bodyRoot) return
    const onBodyClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      if (event.target.closest('[data-comment-overlay]')) return
      if (event.target.closest('a, button, input, textarea, select, summary, label, [contenteditable]:not([contenteditable="false"])')) return
      const layer = layerRef.current
      if (!layer) return
      const layerLeft = layer.getBoundingClientRect().left
      const layerTop = layer.getBoundingClientRect().top
      for (const placement of placements) {
        if (placement.kind !== 'text') continue
        for (const rect of placement.rects) {
          const hit =
            event.clientX >= rect.left + layerLeft &&
            event.clientX <= rect.left + layerLeft + rect.width &&
            event.clientY >= rect.top + layerTop &&
            event.clientY <= rect.top + layerTop + rect.height
          if (hit) {
            activate(placement.id === activeId ? null : placement.id)
            return
          }
        }
      }
      if (activeId !== null) activate(null)
    }
    bodyRoot.addEventListener('click', onBodyClick)
    return () => bodyRoot.removeEventListener('click', onBodyClick)
  }, [bodyRoot, placements, activeId])

  // 卡片实测高度与上一轮测量用的不一样（首帧用估计值、卡片内容变化）就补测一轮，翻转/夹限跟着实际尺寸走
  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return
    if (Math.abs(card.offsetHeight - cardHeightUsedRef.current) > 1) scheduleMeasureRef.current?.()
  })

  const activePlacement = activeId === null ? undefined : placements.find(
    (placement): placement is Extract<MarkerPlacement, { kind: 'text' | 'element' }> => placement.id === activeId && (placement.kind === 'text' || placement.kind === 'element'),
  )

  return (
    <div ref={layerRef} data-comment-overlay="" style={layerStyle}>
      {placements.map((placement) =>
        placement.kind === 'element' ? (
          <div
            key={placement.id}
            data-comment-overlay-frame={placement.id}
            style={{
              ...elementFrameStyle,
              ...placement.box,
              borderColor: placement.id === activeId ? 'var(--comment-overlay-accent, #d97706)' : elementFrameStyle.borderColor,
              borderWidth: placement.id === activeId ? 2 : 1,
            }}
          />
        ) : null,
      )}
      {placements.map((placement) => {
        if (placement.kind !== 'text' && placement.kind !== 'element') return null
        const isActive = placement.id === activeId
        return (
          <button
            key={placement.id}
            type="button"
            data-comment-overlay-badge=""
            aria-label={`打开评论（共 ${placement.count} 条）：${placement.id}`}
            aria-pressed={isActive}
            onClick={() => activate(isActive ? null : placement.id)}
            style={{
              ...badgeStyle,
              top: placement.badgeAnchor.top,
              left: placement.badgeAnchor.left,
              transform: placement.kind === 'element' && !placement.inline ? 'translate(-100%, -50%)' : 'translate(6px, -50%)',
              backgroundColor: isActive ? 'var(--comment-overlay-accent, #d97706)' : badgeStyle.backgroundColor,
              color: isActive ? '#fff' : badgeStyle.color,
            }}
          >
            {placement.count}
          </button>
        )
      })}
      {activePlacement && renderCard && activeId !== null && (
        <div
          ref={cardRef}
          data-comment-overlay-card=""
          style={{ ...cardStyle, top: activePlacement.card.top, left: activePlacement.card.left, width: cardWidth }}
          onClick={(event) => event.stopPropagation()}
        >
          {renderCard(activeId)}
        </div>
      )}
    </div>
  )
}

const layerStyle: CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' }

const elementFrameStyle: CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  borderStyle: 'solid',
  borderColor: 'color-mix(in srgb, var(--comment-overlay-accent, #d97706) 55%, transparent)',
  borderWidth: 1,
  borderRadius: 6,
}

const badgeStyle: CSSProperties = {
  position: 'absolute',
  pointerEvents: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 20,
  height: 20,
  padding: '0 6px',
  borderRadius: 9999,
  border: '1px solid color-mix(in srgb, var(--comment-overlay-accent, #d97706) 45%, transparent)',
  backgroundColor: 'color-mix(in srgb, var(--comment-overlay-accent, #d97706) 14%, #fff)',
  color: '#92400e',
  font: '600 12px/1 ui-sans-serif, system-ui, sans-serif',
  fontVariantNumeric: 'tabular-nums',
  boxShadow: '0 1px 3px rgb(0 0 0 / 0.25)',
}

const cardStyle: CSSProperties = {
  position: 'absolute',
  pointerEvents: 'auto',
  backgroundColor: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 12,
  boxShadow: '0 8px 24px rgb(0 0 0 / 0.18)',
  color: '#111827',
  font: '14px/1.6 ui-sans-serif, system-ui, sans-serif',
}
