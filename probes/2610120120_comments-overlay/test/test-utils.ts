import { vi } from 'vitest'

/**
 * jsdom 没有布局：给 Range / Element 的几何原型方法装假实现，按注册表返回固定矩形。
 * 未注册的元素返回零尺寸（正好用来构造 hidden 场景）。
 */
export type FakeRect = { top: number; left: number; width: number; height: number }

export function toDomRect(rect: FakeRect): DOMRect {
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  } as DOMRect
}

export type FakeLayout = ReturnType<typeof installFakeLayout>

export function installFakeLayout() {
  const elementRects = new Map<Element, FakeRect>()
  const rangeRects = new Map<Range, FakeRect[]>()
  const elementBoundingClientRect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return toDomRect(elementRects.get(this) ?? { top: 0, left: 0, width: 0, height: 0 })
  })
  const elementClientRects = vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
    const rect = elementRects.get(this)
    const list = rect ? [toDomRect(rect)] : []
    return list as unknown as DOMRectList
  })
  // jsdom 的 Range.prototype 上没有 getClientRects（真实浏览器才有几何）：先补一个占位再 spy，卸载时删掉
  const rangeHadClientRects = Object.prototype.hasOwnProperty.call(Range.prototype, 'getClientRects')
  if (!rangeHadClientRects) {
    ;(Range.prototype as { getClientRects?: () => DOMRectList }).getClientRects = () => [] as unknown as DOMRectList
  }
  const rangeClientRects = vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(function (this: Range) {
    return (rangeRects.get(this) ?? []).map(toDomRect) as unknown as DOMRectList
  })
  return {
    elementRects,
    rangeRects,
    uninstall() {
      elementBoundingClientRect.mockRestore()
      elementClientRects.mockRestore()
      rangeClientRects.mockRestore()
      if (!rangeHadClientRects) delete (Range.prototype as { getClientRects?: () => DOMRectList }).getClientRects
    },
  }
}

/** jsdom 没有 ResizeObserver：装一个只记录 observe/disconnect 的假实现 */
export function installFakeResizeObserver() {
  const observed: Element[] = []
  const fake = class {
    observe(element: Element) {
      observed.push(element)
    }
    unobserve() {}
    disconnect() {}
  }
  const original = globalThis.ResizeObserver
  globalThis.ResizeObserver = fake as unknown as typeof ResizeObserver
  return {
    observed,
    uninstall() {
      globalThis.ResizeObserver = original
    },
  }
}

/**
 * 装一个 Map 版 CSS.highlights 与记录 ranges 的 fake Highlight，让高亮路径可测。
 * jsdom 30 已带原生 Highlight API（值是 Set 形态，不好断言），这里用 defineProperty 强制盖掉，
 * 保证组件拿到的是可断言的 fake。
 */
export function installFakeHighlights() {
  const store = new Map<string, { ranges: Range[] }>()
  const originalCss = globalThis.CSS
  const originalHighlight = globalThis.Highlight
  const define = (target: object, key: string, value: unknown) => {
    Object.defineProperty(target, key, { value, writable: true, configurable: true })
  }
  define(globalThis, 'CSS', { highlights: store })
  define(globalThis, 'Highlight', class Highlight {
    ranges: Range[]
    // 与原生构造器一致收 rest 参数：调用方按 new Highlight(...ranges) 传
    constructor(...ranges: Range[]) {
      this.ranges = ranges
    }
  })
  return {
    store,
    uninstall() {
      if (originalCss === undefined) delete (globalThis as Record<string, unknown>).CSS
      else define(globalThis, 'CSS', originalCss)
      if (originalHighlight === undefined) delete (globalThis as Record<string, unknown>).Highlight
      else define(globalThis, 'Highlight', originalHighlight)
    },
  }
}

export function nextAnimationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}
