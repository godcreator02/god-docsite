import { readFileSync, statSync } from 'node:fs'
import { readerFontsCssOf, readerFontsFileEnvName } from '../core/reader-fonts.js'

/** 按修改时间与大小缓存：每次请求都 stat 一次，文件没变就不重读 */
let cachedFile: { file: string; mtimeMs: number; size: number; css: string | null } | undefined

/**
 * 根路由的 loader 调它：没有环境变量 DOCSITE_READER_FONTS_FILE 回 null（手动 pnpm dev、发布版、测试站都是这样）；
 * 有就读那个文件，回要写进 <head> 的 CSS，三项都没设也回 null。文件读不了、格式不对直接报错
 */
export function readerFontsCss(env: NodeJS.ProcessEnv = process.env): string | null {
  const file = env[readerFontsFileEnvName]
  if (file === undefined) return null
  if (file === '') throw new Error(`环境变量 ${readerFontsFileEnvName} 是空的：要么不给，要么给阅读字体文件的绝对路径`)
  let stat: { mtimeMs: number; size: number }
  let text: string
  try {
    stat = statSync(file)
    if (cachedFile !== undefined && cachedFile.file === file && cachedFile.mtimeMs === stat.mtimeMs && cachedFile.size === stat.size) return cachedFile.css
    text = readFileSync(file, 'utf8')
  } catch (error) {
    throw new Error(`阅读字体文件 ${file}（环境变量 ${readerFontsFileEnvName}）读不了：${error instanceof Error ? error.message : String(error)}`)
  }
  let content: unknown
  try {
    content = JSON.parse(text)
  } catch (error) {
    throw new Error(`阅读字体文件 ${file} 不是 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
  const css = readerFontsCssOf(content, file)
  cachedFile = { file, mtimeMs: stat.mtimeMs, size: stat.size, css }
  return css
}
