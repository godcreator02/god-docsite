import type { Source, VirtualFile } from 'fumadocs-core/source'
import type { StructuredData } from 'fumadocs-core/mdx-plugins/remark-structure'

/**
 * TSX 页面与 HTML 页面做成 fumadocs 的页面来源，和 MDX 一起传给项目里的 loader()，进同一棵页面树、同一个搜索。
 * 文件清单由项目的 import.meta.glob 列出（glob 的参数要能静态分析，只能写在项目里），这里只把清单换成 fumadocs 的虚拟文件。
 * 虚拟路径去掉 .page 与扩展名后的部分要和 meta.json 的 pages 里写的名字一致：fumadocs 按去掉扩展名的路径找页面
 */

/** TSX 页面文件导出的 meta */
export type TsxPageMeta = { title: string; description?: string }

/** TSX 页面与 HTML 页面在 page.data 里放的东西；file 是 glob 给的路径，如 /content/notes/waveform.page.tsx */
export type FilePageData = { title: string; description?: string; file: string; structuredData: StructuredData }

type FilePageSource = Source<{ pageData: FilePageData; metaData: never }>

export const tsxPageSuffix = '.page.tsx'
export const htmlPageSuffix = '.html'

/** /content/notes/waveform.page.tsx → notes/waveform.tsx（contentDir 为 /content） */
function virtualPathOf(file: string, contentDir: string, suffix: string, extension: string) {
  const prefix = `${contentDir}/`
  if (!file.startsWith(prefix) || !file.endsWith(suffix)) throw new Error(`${file} 不在 ${contentDir} 下，或者不以 ${suffix} 结尾`)
  return `${file.slice(prefix.length, -suffix.length)}${extension}`
}

function checkedTsxMeta(file: string, meta: unknown): TsxPageMeta {
  const howToFix = `TSX 页面要导出 meta，如 export const meta = { title: '波形', description: '……' }`
  if (typeof meta !== 'object' || meta === null) throw new Error(`${file} 没有导出 meta：${howToFix}`)
  const { title, description } = meta as Record<string, unknown>
  if (typeof title !== 'string' || title === '') throw new Error(`${file} 的 meta.title 要是非空字符串：${howToFix}`)
  if (description !== undefined && typeof description !== 'string') throw new Error(`${file} 的 meta.description 要是字符串`)
  return { title, description }
}

/**
 * TSX 页面的来源。metaOf 是项目里 import.meta.glob('/content/**\/*.page.tsx', { eager: true, import: 'meta' }) 的结果。
 * TSX 页面的正文要运行组件才知道，搜索只收标题与 description
 */
export function tsxPageSource(metaOf: Record<string, unknown>, contentDir = '/content'): FilePageSource {
  const files: VirtualFile<{ pageData: FilePageData; metaData: never }>[] = Object.entries(metaOf).map(([file, meta]) => {
    const { title, description } = checkedTsxMeta(file, meta)
    const contents = description ? [{ heading: undefined, content: description }] : []
    return { type: 'page', path: virtualPathOf(file, contentDir, tsxPageSuffix, '.tsx'), data: { title, description, file, structuredData: { headings: [], contents } } }
  })
  return { files }
}

const blockTagPattern = /<\/?(?:p|div|section|article|header|footer|main|li|ul|ol|table|tr|td|th|h[1-6]|br|pre|blockquote|figure|figcaption)\b[^>]*>/gi

function decodeEntities(text: string) {
  return text.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
}

/** HTML 正文换成几段纯文字：去掉 head、script、style，按块级标签分段 */
function paragraphsOfHtml(html: string): string[] {
  const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html
  return decodeEntities(
    body
      .replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(blockTagPattern, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '')
}

/**
 * HTML 页面的来源。sourceOf 是项目里 import.meta.glob('/content/**\/*.html', { eager: true, query: '?raw', import: 'default' }) 的结果。
 * 标题取 <title>，description 取 <meta name="description">，搜索收正文的纯文字
 */
export function htmlPageSource(sourceOf: Record<string, string>, contentDir = '/content'): FilePageSource {
  const files: VirtualFile<{ pageData: FilePageData; metaData: never }>[] = Object.entries(sourceOf).map(([file, html]) => {
    const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim()
    if (!title) throw new Error(`${file} 没有 <title>：HTML 页面的标题写在 <head> 的 <title> 里`)
    const description = /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i.exec(html)?.[1]
    const contents = paragraphsOfHtml(html).map((content) => ({ heading: undefined, content }))
    return { type: 'page', path: virtualPathOf(file, contentDir, htmlPageSuffix, '.html'), data: { title: decodeEntities(title), description, file, structuredData: { headings: [], contents } } }
  })
  return { files }
}

/**
 * 内容目录里的页面占了站点自己的路由地址时报错，一次列出全部。reservedFirstSlugs 是项目 routes.ts 里
 * 内容页以外的路由占用的第一段地址，如 ['api']
 */
export function assertNoReservedSlugs(pages: Array<{ slugs: string[]; path: string; data: object }>, reservedFirstSlugs: readonly string[], contentDir = '/content') {
  const clashes = pages.filter((page) => reservedFirstSlugs.includes(page.slugs[0] ?? ''))
  if (clashes.length > 0) {
    // TSX 与 HTML 页面的 path 是虚拟路径（去掉了 .page），报错写它们真实的文件
    const fileOf = (page: (typeof clashes)[number]) => ('file' in page.data && typeof page.data.file === 'string' ? page.data.file : `${contentDir}/${page.path}`)
    throw new Error(`${clashes.map(fileOf).join('、')}：地址第一段 ${reservedFirstSlugs.join('、')} 留给站点自己的路由，换个名字`)
  }
}

/** 网页取 content/ 里文件的地址前缀；项目 routes.ts 里要有 route('api/content/*', …) 交给服务端函数 contentFileResponse */
export const contentFileUrlPrefix = '/api/content/'

/** glob 给的路径（/content/design/topology.html）在网页上的地址（/api/content/design/topology.html） */
export function contentFileUrlOf(file: string, contentDir = '/content') {
  if (!file.startsWith(`${contentDir}/`)) throw new Error(`${file} 不在 ${contentDir} 下`)
  return `${contentFileUrlPrefix}${file.slice(contentDir.length + 1)}`
}
