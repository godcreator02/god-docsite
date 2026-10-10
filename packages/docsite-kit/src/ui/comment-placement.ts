/** 一张评论卡片：wantedTop 是它批的原文离评论栏顶端的距离，height 是卡片自己的高度 */
export type CardToPlace = { id: string; wantedTop: number; height: number }

/**
 * 评论栏里每张卡片的位置：尽量和批的原文对齐，挨得太近就往下推，不叠在一起。
 * 选中的那张正好对齐原文，它上面的卡片往上让、下面的往下让
 */
export function placeCards(cards: readonly CardToPlace[], activeId: string | undefined, gap: number): Map<string, number> {
  const sorted = [...cards].sort((a, b) => a.wantedTop - b.wantedTop)
  const tops = new Map<string, number>()
  const activeIndex = sorted.findIndex((card) => card.id === activeId)
  const firstPushedDown = activeIndex === -1 ? 0 : activeIndex
  let bottom = -Infinity
  for (const card of sorted.slice(firstPushedDown)) {
    const top = Math.max(card.wantedTop, bottom + gap)
    tops.set(card.id, top)
    bottom = top + card.height
  }
  if (activeIndex > 0) {
    let top = tops.get(sorted[activeIndex]!.id)!
    for (const card of sorted.slice(0, activeIndex).reverse()) {
      top = Math.min(card.wantedTop, top - gap - card.height)
      tops.set(card.id, top)
    }
  }
  return tops
}
