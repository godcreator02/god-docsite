/** 内容目录里哪些文件是页面：MDX（下划线开头的是被页面 import 的正文，不算）、TSX 页面、HTML 页面。和站点 mdx 集合的 files、page-sources 的 glob 一致 */

export const tsxPageSuffix = '.page.tsx'
export const htmlPageSuffix = '.html'
const mdxPageSuffix = '.mdx'

/** 页面文件的页面名（meta.json 的 pages 里写的名字）：waveform.mdx、waveform.page.tsx、waveform.html 都是 waveform；不是页面回 null */
export function pageNameOf(fileName: string): string | null {
  if (fileName.endsWith(tsxPageSuffix)) return fileName.slice(0, -tsxPageSuffix.length)
  if (fileName.endsWith(htmlPageSuffix)) return fileName.slice(0, -htmlPageSuffix.length)
  if (fileName.endsWith(mdxPageSuffix) && !fileName.startsWith('_')) return fileName.slice(0, -mdxPageSuffix.length)
  return null
}
