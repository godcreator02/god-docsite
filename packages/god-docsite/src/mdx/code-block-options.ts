import { parseCodeBlockAttributes } from 'fumadocs-core/mdx-plugins/codeblock-utils'
import { rehypeCodeDefaultOptions, type RehypeCodeOptions } from 'fumadocs-core/mdx-plugins/rehype-code'

const parseFumadocsMeta = rehypeCodeDefaultOptions.parseMetaString
if (parseFumadocsMeta === undefined) throw new Error('fumadocs-core 的 rehypeCodeDefaultOptions 没有 parseMetaString，代码块默认带行号接不上：核对 fumadocs-core 的版本')

/**
 * 站点每个 MDX 集合交给 fumadocs 代码高亮（rehypeCode）的选项：代码块默认带行号，开头写 `noLineNumbers` 的不带，
 * 写 `lineNumbers=N` 的从 N 起编号；其余标记照 fumadocs 默认的解析。
 * fumadocs 自己把 `lineNumbers` 带任何值都当成要行号，所以关掉只能另起 `noLineNumbers` 这个词
 */
export const siteRehypeCodeOptions: RehypeCodeOptions = {
  ...rehypeCodeDefaultOptions,
  parseMetaString(metaString, node, tree) {
    const { attributes, rest } = parseCodeBlockAttributes(metaString, ['noLineNumbers'])
    const codeBlockProps = parseFumadocsMeta(rest, node, tree)
    if ('noLineNumbers' in attributes) return codeBlockProps
    return { 'data-line-numbers': true, ...codeBlockProps }
  },
}
