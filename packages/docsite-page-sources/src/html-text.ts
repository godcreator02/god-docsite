import type { StructuredData } from 'fumadocs-core/mdx-plugins/remark-structure'

/**
 * HTML 页面正文的静态提取：标题、描述、目录锚点、搜索分段与 Markdown 形式都在这里从 HTML 文本派生。
 * 只做文本层面的提取，不解析成组件、不在运行时编译——展示仍由浏览器原样渲染 HTML 文件本身。
 */

/** HTML 页一个带锚点的标题：id 是内容里标题自带的 id（<h2 id="…">），目录、搜索跳转与页面定位点共用它；
 *  没写 id 的标题不产生锚点——要目录与搜索锚点，就在 HTML 里给标题写 id */
export type HtmlHeadingAnchor = { id: string; text: string; level: number }

/** 搜引用的分段：heading 是 HtmlHeadingAnchor 的 id，undefined 表示跟在页首、不属于任何标题 */
export type HtmlSearchSection = { heading: string | undefined; content: string }

export type HtmlPageExtract = {
  title: string
  description: string | undefined
  headings: HtmlHeadingAnchor[]
  contents: HtmlSearchSection[]
  markdown: string
}

const blockTagPattern = /<\/?(?:p|div|section|article|header|footer|main|aside|li|ul|ol|table|tr|td|th|thead|tbody|h[1-6]|br|pre|blockquote|figure|figcaption|dt|dd|dl|hr)\b[^>]*>/gi
const namedEntities: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™',
  hellip: '…', mdash: '—', ndash: '–', lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201C', rdquo: '\u201D', middot: '·', bull: '•',
}

function codePointOf(whole: string, value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : whole
}

export function decodeHtmlEntities(text: string) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (whole, hex: string) => codePointOf(whole, Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (whole, dec: string) => codePointOf(whole, Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => namedEntities[name.toLowerCase()] ?? whole)
}

/** 剥掉内联标签并把实体解码成纯文本 */
function textOfHtmlFragment(fragment: string) {
  return decodeHtmlEntities(fragment.replace(/<[^>]+>/g, ''))
}

/** 标题哨兵：把 <h1>-<h6> 换成一行不可见的标记，携带它在全部标题里的序号 */
const headingSentinelOf = (index: number) => `\u0000h${index}\u0000`

function titleFromHead(file: string, html: string) {
  const overridden = /<meta\s+name=["']fumadocs:title["']\s+content=["']([^"']*)["']/i.exec(html)?.[1]
  const fromTitleTag = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
  const raw = overridden ?? fromTitleTag
  const title = raw === undefined ? undefined : decodeHtmlEntities(raw).replace(/\s+/g, ' ').trim()
  if (!title) {
    throw new Error(
      `${file} 没有 <title>：HTML 页面的标题写在 <head> 的 <title> 里，要显示不同的名字再用 <meta name="fumadocs:title" content="…"> 覆盖`,
    )
  }
  return title
}

function descriptionFromHead(html: string) {
  const raw = /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i.exec(html)?.[1]
  return raw === undefined ? undefined : decodeHtmlEntities(raw).trim()
}

/** 行内元素换成 Markdown 形式，段落文本里链接与图片的地址在 Markdown 输出里保留 */
function inlineToMarkdown(fragment: string) {
  return decodeHtmlEntities(
    fragment
      .replace(/<a\s[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, text: string) => `[${text.replace(/<[^>]+>/g, '')}](${href})`)
      .replace(/<img\s[^>]*src=["']([^"']*)["'][^>]*>/gi, (whole, src: string) => {
        const alt = /alt=["']([^"']*)["']/i.exec(whole)?.[1] ?? ''
        return `![${alt}](${src})`
      })
      .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, text: string) => '`' + text.replace(/<[^>]+>/g, '') + '`'),
  )
}

/**
 * 提取一页 HTML。body 里的 script、style、template、注释不进任何输出；
 * 段落按块级标签切分，归属到它前面最近的标题。
 */
export function extractHtmlPage(file: string, html: string): HtmlPageExtract {
  const title = titleFromHead(file, html)
  const description = descriptionFromHead(html)

  const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html
    .replace(/<head\b[\s\S]*?<\/head>/gi, '')
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*>/gi, '')
  const cleaned = body
    .replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  /** 全部标题（含无 id 的）：id 为空串表示这页内容定义处没给锚点，不进 headings，段落归属落到上一个有 id 的标题 */
  const allHeadings: Array<HtmlHeadingAnchor & { hasAnchor: boolean }> = []
  const withSentinels = cleaned.replace(
    /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (whole, levelText: string, attrs: string, inner: string) => {
      const text = textOfHtmlFragment(inner).replace(/\s+/g, ' ').trim()
      if (text === '') return ''
      const id = /(?:^|\s)id=["']([^"']+)["']/i.exec(attrs)?.[1]
      allHeadings.push({ id: id ?? '', text, level: Number(levelText), hasAnchor: id !== undefined })
      return headingSentinelOf(allHeadings.length - 1)
    },
  )

  const blocks = inlineToMarkdown(withSentinels)
    .replace(blockTagPattern, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '')

  const contents: HtmlSearchSection[] = []
  const markdownLines: string[] = [`# ${title}`, '']
  if (description) markdownLines.push(description, '')
  let currentHeading: string | undefined
  for (const line of blocks) {
    const sentinel = /^\u0000h(\d+)\u0000$/.exec(line)
    if (sentinel) {
      const heading = allHeadings[Number(sentinel[1])]!
      if (heading.hasAnchor) currentHeading = heading.id
      markdownLines.push(`${'#'.repeat(heading.level)} ${heading.text}`, '')
      continue
    }
    contents.push({ heading: currentHeading, content: line })
    markdownLines.push(line, '')
  }

  return {
    title,
    description,
    headings: allHeadings.filter(({ hasAnchor }) => hasAnchor).map(({ id, text, level }) => ({ id, text, level })),
    contents,
    markdown: markdownLines.join('\n').trimEnd() + '\n',
  }
}
