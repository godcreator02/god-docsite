import { readerFontsCssOf } from '../core/reader-fonts.js'
import { siteHostContext } from './host-context.server.js'

/**
 * 根路由的 loader 调它：托管方上下文里读者选的字体换成要写进 <head> 的 CSS。
 * 没推过上下文（手动 pnpm dev、发布版、测试站）或三项都没设回 null，用站点默认字体
 */
export function readerFontsCss(): string | null {
  const context = siteHostContext()
  return context === null ? null : readerFontsCssOf(context.readerFonts)
}
