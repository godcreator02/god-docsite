/**
 * 宿主侧定位实现（fixture 演示用，不属于覆盖层模块）：
 * 按锚配置在正文里现场建 Range / 找元素。真实站点里这一层由评论包的持久化锚点映射提供，
 * 覆盖层只认 resolveTarget 这个输入边界。
 */
export type FixtureAnchor =
  | { markerId: string; count: number; kind: 'text'; scope: string; text: string; occurrence: number }
  | { markerId: string; count: number; kind: 'element'; scope: string; selector: string }
  | { markerId: string; count: number; kind: 'missing' }

/** 在 scope 里找第 occurrence 次出现的文字，建一个包住它的 Range；找不到返回 null */
export function findTextRange(scope: Element, text: string, occurrence: number): Range | null {
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
  let seen = 0
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = (node as Text).data
    let from = 0
    for (;;) {
      const at = data.indexOf(text, from)
      if (at < 0) break
      seen += 1
      if (seen === occurrence) {
        const range = document.createRange()
        range.setStart(node, at)
        range.setEnd(node, at + text.length)
        return range
      }
      from = at + text.length
    }
  }
  return null
}

export function makeResolveTarget(anchors: readonly FixtureAnchor[]) {
  return (id: string): Range | Element | null => {
    const anchor = anchors.find((candidate) => candidate.markerId === id)
    if (!anchor || anchor.kind === 'missing') return null
    const scope = document.querySelector<HTMLElement>(anchor.scope)
    if (!scope) return null
    if (anchor.kind === 'element') return scope.querySelector(anchor.selector)
    return findTextRange(scope, anchor.text, anchor.occurrence)
  }
}
