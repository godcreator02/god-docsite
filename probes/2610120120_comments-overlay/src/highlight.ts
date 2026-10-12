/**
 * CSS Custom Highlight 的注册与清理。每个覆盖层实例持有自己的画笔（注册名带实例 id），
 * 一页多实例互不覆盖，卸载只清自己的注册名。
 * ::highlight() 的规则随实例注入的样式表来（overlayCssFor），注册名与规则用同一个 key。
 */
export type HighlightPainter = {
  paint: (ranges: ReadonlyArray<Range>, activeRange: Range | undefined) => void
  clear: () => void
}

/** CSS Custom Highlight API 可用吗（jsdom 与旧浏览器没有，跳过高亮而不是报错） */
export function highlightsAvailable(): boolean {
  return typeof CSS !== 'undefined' && CSS.highlights != null && typeof Highlight === 'function'
}

/** key 用实例的 useId 清洗而来；一个实例一个画笔，只碰自己的两个注册名 */
export function createHighlightPainter(key: string): HighlightPainter {
  const quoteHighlight = `docsite-comments-overlay-${key}`
  const activeQuoteHighlight = `${quoteHighlight}-active`
  return {
    paint(ranges, activeRange) {
      CSS.highlights.set(quoteHighlight, new Highlight(...ranges))
      if (activeRange) CSS.highlights.set(activeQuoteHighlight, new Highlight(activeRange))
      else CSS.highlights.delete(activeQuoteHighlight)
    },
    clear() {
      // 环境拆装（如测试里 fake 先卸）会让 CSS.highlights 中途消失：清理前查一下，注册名在才删
      if (!highlightsAvailable()) return
      CSS.highlights.delete(quoteHighlight)
      CSS.highlights.delete(activeQuoteHighlight)
    },
  }
}
