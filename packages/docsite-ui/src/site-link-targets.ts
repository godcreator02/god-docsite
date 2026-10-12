/** 正文里一个链接指向哪：本页的标题、站外、站里的一个地址（带着评论串时是那串评论） */
export type SiteLinkTarget =
  | { kind: 'in-page' }
  | { kind: 'external'; opensNewTab: boolean }
  | { kind: 'site'; path: string; hash: string; commentThread: string | undefined }

/** 去一串评论批的那一页：地址带上 ?comment=<评论串>，那一页找好位置后打开它 */
export const linkedCommentParam = 'comment'

const schemePattern = /^[a-z][a-z\d+.-]*:/i
const anyOrigin = 'http://site.invalid'

/** 站里的地址统一写法：解码、去掉末尾的斜杠（根地址 / 除外），和页面树里页面的 url 一样 */
export function sitePathOf(pathname: string) {
  const decoded = decodeURI(pathname)
  return decoded.length > 1 ? decoded.replace(/\/+$/, '') : decoded
}

/** 相对地址按当前页面的地址解析；http、https 之外的协议（mailto 这类）也算站外，只是不开新标签页 */
export function siteLinkTargetOf(href: string, currentPath: string): SiteLinkTarget {
  if (href.startsWith('#')) return { kind: 'in-page' }
  if (schemePattern.test(href)) return { kind: 'external', opensNewTab: /^https?:/i.test(href) }
  const url = new URL(href, `${anyOrigin}${currentPath}`)
  return {
    kind: 'site',
    path: sitePathOf(url.pathname),
    hash: decodeURIComponent(url.hash.slice(1)),
    commentThread: url.searchParams.get(linkedCommentParam) ?? undefined,
  }
}
