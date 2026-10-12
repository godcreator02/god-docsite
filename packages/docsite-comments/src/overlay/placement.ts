/**
 * 集中测量：把宿主给的定位结果（Range 或 Element）换算成覆盖层坐标系里的落点。
 * 只读正文（getClientRects / getBoundingClientRect / getComputedStyle / checkVisibility），不修改正文。
 */

/** 覆盖层坐标系里的矩形：top/left 相对覆盖层左上角 */
export type Box = { top: number; left: number; width: number; height: number }

/** 卡片位置的视口约束输入：卡片实际高度与视口尺寸，由组件测量后传入 */
export type CardConstraint = { cardHeight: number; viewportWidth: number; viewportHeight: number }

/**
 * 一条评论标记在一轮测量后的落点。
 * hidden 是目标还在正文里但当前看不见（收起的 details、hidden 属性等）；
 * missing 是宿主的定位函数返回 null（原文找不到）或目标不在本正文子树里。两种都明确无定位，不渲染徽章。
 */
export type MarkerPlacement =
  | { id: string; kind: 'text'; count: number; rects: Box[]; badgeAnchor: { top: number; left: number }; card: { top: number; left: number }; range: Range }
  | { id: string; kind: 'element'; count: number; box: Box; badgeAnchor: { top: number; left: number }; card: { top: number; left: number }; inline: boolean; element: Element }
  | { id: string; kind: 'hidden'; count: number }
  | { id: string; kind: 'missing'; count: number }

export type OverlayMarkerInput = { id: string; count: number }

const cardGap = 8
/** 卡片与视口边缘至少留的空隙 */
const viewportPadding = 8
/** 卡片尚未渲染时的高度估计：渲染后按实测高度重算 */
export const defaultCardHeight = 240

function relativeBox(rect: DOMRect, base: DOMRect): Box {
  return { top: rect.top - base.top, left: rect.left - base.left, width: rect.width, height: rect.height }
}

/** 几个矩形合起来的外接矩形（多行文字的整体范围） */
function unionBox(boxes: Box[]): Box {
  const top = Math.min(...boxes.map((box) => box.top))
  const left = Math.min(...boxes.map((box) => box.left))
  const bottom = Math.max(...boxes.map((box) => box.top + box.height))
  const right = Math.max(...boxes.map((box) => box.left + box.width))
  return { top, left, width: right - left, height: bottom - top }
}

function clampCardLeft(left: number, layerWidth: number, cardWidth: number) {
  return Math.max(0, Math.min(left, layerWidth - cardWidth))
}

/** 目标真的在这个正文里吗：宿主把别的正文（或已摘下的节点）的锚点传进来时，明确按找不到处理 */
function targetWithinBody(target: Range | Element, bodyRoot: HTMLElement): boolean {
  if (target instanceof Range) return bodyRoot.contains(target.startContainer) && bodyRoot.contains(target.endContainer)
  return bodyRoot.contains(target)
}

/**
 * 元素当前看得见吗：布局盒为 0、没有 client 矩形（收起的 details 内容），
 * 或浏览器判它不显示，都算看不见。checkVisibility 不存在（jsdom、旧浏览器）就跳过这项。
 */
function elementIsVisible(element: Element, rect: DOMRect): boolean {
  if (rect.width <= 0 && rect.height <= 0) return false
  if (element.getClientRects().length === 0) return false
  if (!isBeingRendered(element)) return false
  return true
}

/** 浏览器判这个元素在被渲染吗：收起的 details 内容在 Chromium 里有布局矩形但被跳过渲染，只有这个 API 判得出来 */
function isBeingRendered(element: Element): boolean {
  if (typeof element.checkVisibility !== 'function') return true
  return element.checkVisibility()
}

/** Range 起点所属的元素：对它做渲染检查，覆盖「有矩形但没被渲染」的折叠内容 */
function rangeHolderElement(range: Range): Element | null {
  const node = range.startContainer
  return node instanceof Element ? node : node.parentElement
}

function measureMarker(id: string, count: number, target: Range | Element | null, layerRect: DOMRect, layerWidth: number, cardWidth: number): MarkerPlacement {
  if (target === null) return { id, count, kind: 'missing' }
  if (target instanceof Range) {
    const rawRects = [...target.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)
    if (rawRects.length === 0) return { id, count, kind: 'hidden' }
    const holder = rangeHolderElement(target)
    if (holder && !isBeingRendered(holder)) return { id, count, kind: 'hidden' }
    const rects = rawRects.map((rect) => relativeBox(rect, layerRect))
    const last = rects[rects.length - 1]
    const whole = unionBox(rects)
    return {
      id,
      count,
      kind: 'text',
      rects,
      badgeAnchor: { top: last.top, left: last.left + last.width },
      card: { top: whole.top + whole.height + cardGap, left: clampCardLeft(whole.left, layerWidth, cardWidth) },
      range: target,
    }
  }
  const rect = target.getBoundingClientRect()
  if (!elementIsVisible(target, rect)) return { id, count, kind: 'hidden' }
  const box = relativeBox(rect, layerRect)
  return {
    id,
    count,
    kind: 'element',
    box,
    badgeAnchor: { top: box.top, left: box.left + box.width },
    card: { top: box.top + box.height + cardGap, left: clampCardLeft(box.left, layerWidth, cardWidth) },
    inline: getComputedStyle(target).display.startsWith('inline'),
    element: target,
  }
}

/**
 * 卡片位置的视口约束：目标下方优先；下方放不下且上方够就翻到目标上方；两边都不够就贴视口底夹限。
 * 水平先在覆盖层宽度内夹过（measureMarker 的 clampCardLeft），再夹进视口。返回覆盖层坐标。
 */
function constrainCard(targetTop: number, targetBottom: number, preferredLeft: number, layerRect: DOMRect, cardWidth: number, constraint: CardConstraint): { top: number; left: number } {
  const targetViewportTop = layerRect.top + targetTop
  const targetViewportBottom = layerRect.top + targetBottom
  const belowTop = targetViewportBottom + cardGap
  let viewportTop: number
  if (belowTop + constraint.cardHeight <= constraint.viewportHeight - viewportPadding) {
    viewportTop = belowTop
  } else if (targetViewportTop - cardGap - constraint.cardHeight >= viewportPadding) {
    viewportTop = targetViewportTop - cardGap - constraint.cardHeight
  } else {
    viewportTop = Math.max(viewportPadding, constraint.viewportHeight - viewportPadding - constraint.cardHeight)
  }
  const maxViewportLeft = Math.max(viewportPadding, constraint.viewportWidth - viewportPadding - cardWidth)
  const viewportLeft = Math.max(viewportPadding, Math.min(layerRect.left + preferredLeft, maxViewportLeft))
  return { top: viewportTop - layerRect.top, left: viewportLeft - layerRect.left }
}

/**
 * 测全部标记。目标不在正文子树里的（宿主把别的正文的锚点传了进来）按找不到处理。
 * 批同一个可见元素的多条并成一条：保留第一条的 id（组长），数量相加；
 * hidden / missing 的不并，每条各自上报状态。
 */
export function measureAllPlacements(
  markers: ReadonlyArray<OverlayMarkerInput>,
  resolveTarget: (id: string) => Range | Element | null,
  layerRect: DOMRect,
  cardWidth: number,
  bodyRoot: HTMLElement,
  cardConstraint: CardConstraint,
): MarkerPlacement[] {
  const measured = markers.map((marker) => {
    const target = resolveTarget(marker.id)
    if (target !== null && !targetWithinBody(target, bodyRoot)) return { id: marker.id, count: marker.count, kind: 'missing' } as const
    return measureMarker(marker.id, marker.count, target, layerRect, layerRect.width, cardWidth)
  })
  const merged: MarkerPlacement[] = []
  const leaderByElement = new Map<Element, Extract<MarkerPlacement, { kind: 'element' }>>()
  for (const placement of measured) {
    if (placement.kind !== 'element') {
      merged.push(placement)
      continue
    }
    const leader = leaderByElement.get(placement.element)
    if (leader) {
      leader.count += placement.count
      continue
    }
    leaderByElement.set(placement.element, placement)
    merged.push(placement)
  }
  for (const placement of merged) {
    if (placement.kind === 'text') {
      const whole = unionBox(placement.rects)
      placement.card = constrainCard(whole.top, whole.top + whole.height, placement.card.left, layerRect, cardWidth, cardConstraint)
    } else if (placement.kind === 'element') {
      placement.card = constrainCard(placement.box.top, placement.box.top + placement.box.height, placement.card.left, layerRect, cardWidth, cardConstraint)
    }
  }
  return merged
}

/**
 * 两轮测量结果相同吗。相同就保留旧数组（引用不变，下游 effect 不重跑）。
 * Range 比较起止节点与偏移而不比引用：宿主每轮重建 Range 但几何没变时不必重画。
 */
export function samePlacements(a: ReadonlyArray<MarkerPlacement>, b: ReadonlyArray<MarkerPlacement>): boolean {
  if (a.length !== b.length) return false
  return a.every((placement, index) => {
    const other = b[index]
    if (placement.kind !== other.kind || placement.id !== other.id || placement.count !== other.count) return false
    if (placement.kind === 'text' && other.kind === 'text') {
      return (
        placement.range.startContainer === other.range.startContainer &&
        placement.range.endContainer === other.range.endContainer &&
        placement.range.startOffset === other.range.startOffset &&
        placement.range.endOffset === other.range.endOffset &&
        sameSpots(placement.badgeAnchor, other.badgeAnchor) &&
        sameSpots(placement.card, other.card) &&
        sameBoxes(placement.rects, other.rects)
      )
    }
    if (placement.kind === 'element' && other.kind === 'element') {
      return placement.element === other.element && placement.inline === other.inline && sameBoxes([placement.box], [other.box]) && sameSpots(placement.badgeAnchor, other.badgeAnchor) && sameSpots(placement.card, other.card)
    }
    return true
  })
}

function sameSpots(a: { top: number; left: number }, b: { top: number; left: number }) {
  return a.top === b.top && a.left === b.left
}

function sameBoxes(a: ReadonlyArray<Box>, b: ReadonlyArray<Box>) {
  return a.length === b.length && a.every((box, index) => box.top === b[index].top && box.left === b[index].left && box.width === b[index].width && box.height === b[index].height)
}
