import type { TOCItemType } from 'fumadocs-core/toc'

/** 进本页目录的标题：和 MDX 页面一样从二级标题起，到三级 */
const tocHeadingSelector = 'h2, h3'

/** 页面里已经用掉的 id 之外，按标题文字起一个：空白换成 -，重名的加 -2、-3 */
function freeIdOf(text: string, taken: Set<string>) {
  const base = text.trim().toLowerCase().replace(/\s+/g, '-') || 'section'
  let id = base
  for (let suffix = 2; taken.has(id); suffix++) id = `${base}-${suffix}`
  taken.add(id)
  return id
}

/**
 * 正文里的二、三级标题：没有 id 的按文字给一个，回标题元素和本页目录的条目。
 * takenIds 是外层页面已经用掉的 id（HTML 页面的标题在 iframe 里，定位点放在外层页面）
 */
export function bodyHeadingsOf(root: ParentNode, takenIds: Set<string>): { headings: HTMLElement[]; toc: TOCItemType[] } {
  const headings = [...root.querySelectorAll<HTMLElement>(tocHeadingSelector)].filter((heading) => heading.textContent?.trim())
  for (const heading of headings) {
    if (heading.id) takenIds.add(heading.id)
    else heading.id = freeIdOf(heading.textContent!, takenIds)
  }
  const toc = headings.map((heading) => ({ title: heading.textContent!.trim(), url: `#${heading.id}`, depth: heading.tagName === 'H2' ? 2 : 3 }))
  return { headings, toc }
}

/** 两份目录条目一样就不用再交给页面（避免每次正文变动都重新渲染目录） */
export function sameToc(a: readonly TOCItemType[], b: readonly TOCItemType[]) {
  return a.length === b.length && a.every((item, index) => item.url === b[index]!.url && item.title === b[index]!.title && item.depth === b[index]!.depth)
}
