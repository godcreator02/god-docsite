const FOLDER_GROUP = /^\(.+\)$/

/**
 * 评论串的 page 换成站内地址：功能包页面的 page 本来就是地址（/ 开头），原样返回；
 * 内容页的 page 是页面在 docs 集合里的路径（如 plan/index.mdx），照 fumadocs getSlugs 的规则换成地址（站点 loader 的 baseUrl 是 /）
 */
export function pageAddressOf(page: string): string {
  if (page.startsWith('/')) return page
  const segments = page.split('/').filter((segment) => segment.length > 0)
  const file = segments.pop()
  if (file === undefined) throw new Error(`评论串的 page 是空的：${JSON.stringify(page)}`)
  const name = file.replace(/\.[^.]+$/, '')
  const slugs = segments.filter((segment) => !FOLDER_GROUP.test(segment))
  if (name !== 'index') slugs.push(name)
  return `/${slugs.map((slug) => encodeURI(slug)).join('/')}`
}
