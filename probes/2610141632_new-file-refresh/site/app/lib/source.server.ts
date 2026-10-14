import { loader } from 'fumadocs-core/source'
import { comments, docs } from '../../.source/server'

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: '/docs',
})

/** 评论集合没写 schema，frontmatter 字段直接在条目上；page 是被评论页面在 docs 集合里的路径 */
export function commentsForPage(pagePath: string) {
  return comments
    .map((entry) => entry as unknown as { info: { path: string }; page?: unknown; marker?: unknown })
    .filter((entry) => entry.page === pagePath)
    .map((entry) => ({ path: entry.info.path, marker: String(entry.marker) }))
}
