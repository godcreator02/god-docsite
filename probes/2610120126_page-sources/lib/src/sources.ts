import type { StaticSource, VirtualFile } from 'fumadocs-core/source'
import type { StructuredData } from 'fumadocs-core/mdx-plugins/remark-structure'
import { extractHtmlPage, type HtmlHeadingAnchor } from './html-text.ts'

/**
 * TSX 页面与 HTML 页面做成 fumadocs 的 StaticSource，与 MDX 集合合进同一个 loader 的页面树与搜索。
 * 文件清单由站点里的 import.meta.glob 给出（glob 参数要能静态分析，只能写在站点模块里，见各函数的 JSDoc）；
 * 这里把清单换成虚拟文件。两类来源的路径都去掉 contentDir 前缀（如 /content/guide/demo.page.tsx → guide/demo.tsx），
 * 与 fumadocs「去掉最后一个扩展名」的 slug 规则配合：guide/demo.page.tsx 的地址是 /guide/demo，
 * meta.json 的 pages 里写 guide/demo。
 */

/** TSX 页面文件导出的 meta：标题、描述与搜索内容都在内容定义处（页面文件里）明确提供 */
export type TsxPageMeta = {
  title: string
  description?: string
  /** 可选的额外搜索文本；TSX 正文要运行组件才知道，搜索只收这里显式给出的文字 */
  searchText?: string
  /** 可选的 Markdown 形式；缺省由标题与描述派生 */
  markdown?: string
}

/** TSX 页面与 HTML 页面在 page.data 里的形状；file 是 glob 给出的路径，如 /content/guide/demo.page.tsx */
export type FilePageData = {
  title: string
  description: string | undefined
  file: string
  structuredData: StructuredData
  /** 三格式统一的 Markdown 形式约定：MDX 走官方 getText('processed')，TSX/HTML 在这里 */
  markdown: string
  /** HTML 页面的目录锚点；TSX 页面为空数组 */
  headings: HtmlHeadingAnchor[]
}

export type FilePageSource = StaticSource<{ pageData: FilePageData; metaData: never }>

export const tsxPageSuffix = '.page.tsx'
export const htmlPageSuffix = '.html'

/** /content/guide/demo.page.tsx → guide/demo.tsx；.page 去掉后，slug 与 meta.json 里写的名字一致 */
function virtualPathOf(file: string, contentDir: string, suffix: string, extension: string) {
  const prefix = `${contentDir}/`
  if (!file.startsWith(prefix) || !file.endsWith(suffix)) throw new Error(`${file} 不在 ${contentDir} 下，或者不以 ${suffix} 结尾`)
  return `${file.slice(prefix.length, -suffix.length)}${extension}`
}

function checkedTsxMeta(file: string, meta: unknown): TsxPageMeta {
  const howToFix = `TSX 页面要导出 meta，如 export const meta = { title: '波形', description: '……' }`
  if (typeof meta !== 'object' || meta === null) throw new Error(`${file} 没有导出 meta：${howToFix}`)
  const { title, description, searchText, markdown } = meta as Record<string, unknown>
  if (typeof title !== 'string' || title === '') throw new Error(`${file} 的 meta.title 要是非空字符串：${howToFix}`)
  if (description !== undefined && typeof description !== 'string') throw new Error(`${file} 的 meta.description 要是字符串`)
  if (searchText !== undefined && typeof searchText !== 'string') throw new Error(`${file} 的 meta.searchText 要是字符串`)
  if (markdown !== undefined && typeof markdown !== 'string') throw new Error(`${file} 的 meta.markdown 要是字符串`)
  return { title, description, searchText, markdown }
}

function markdownOfTsxMeta(meta: TsxPageMeta) {
  return meta.markdown ?? `# ${meta.title}${meta.description ? `\n\n${meta.description}` : ''}\n`
}

/**
 * TSX 页面的来源。metaOf 是站点服务端模块里
 * import.meta.glob('/content/**\/*.page.tsx', { eager: true, import: 'meta' }) 的结果。
 * TSX 是打包器编译的互动组件：页面正文由路由按需加载页面模块的默认导出渲染，
 * 搜索只收 meta 里明确给出的文字
 */
export function tsxPageSource(metaOf: Record<string, unknown>, contentDir = '/content'): FilePageSource {
  const files: VirtualFile<{ pageData: FilePageData; metaData: never }>[] = Object.entries(metaOf).map(([file, meta]) => {
    const checked = checkedTsxMeta(file, meta)
    const searchTexts = [checked.description, checked.searchText].filter((text): text is string => text !== undefined)
    return {
      type: 'page',
      path: virtualPathOf(file, contentDir, tsxPageSuffix, '.tsx'),
      data: {
        title: checked.title,
        description: checked.description,
        file,
        structuredData: { headings: [], contents: searchTexts.map((content) => ({ heading: undefined, content })) },
        markdown: markdownOfTsxMeta(checked),
        headings: [],
      },
    }
  })
  return { files }
}

/**
 * HTML 页面的来源。sourceOf 是站点服务端模块里
 * import.meta.glob('/content/**\/*.html', { eager: true, query: '?raw', import: 'default' }) 的结果。
 * 标题、描述、搜索分段与 Markdown 形式都从 HTML 文本派生（extractHtmlPage）；
 * 正文展示由浏览器原样渲染 HTML 文件（如经 /api/content/ 送出），这里不做任何编译
 */
export function htmlPageSource(sourceOf: Record<string, string>, contentDir = '/content'): FilePageSource {
  const files: VirtualFile<{ pageData: FilePageData; metaData: never }>[] = Object.entries(sourceOf).map(([file, html]) => {
    const extracted = extractHtmlPage(file, html)
    return {
      type: 'page',
      path: virtualPathOf(file, contentDir, htmlPageSuffix, '.html'),
      data: {
        title: extracted.title,
        description: extracted.description,
        file,
        structuredData: { headings: extracted.headings.map(({ id, text }) => ({ id, content: text })), contents: extracted.contents },
        markdown: extracted.markdown,
        headings: extracted.headings,
      },
    }
  })
  return { files }
}
