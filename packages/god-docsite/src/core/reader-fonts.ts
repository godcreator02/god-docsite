/**
 * 阅读字体文件：gwb-docsite 把读者在 gwb 设置里选的三项字体写成这个文件，启动开发服务时用环境变量交出路径，站点每次请求读它。
 * 外部契约：环境变量名、`format` 与三个字段由 gwb-docsite 与站点共同遵守，改了要升 format
 */

/** gwb-docsite 启动开发服务时给的环境变量：阅读字体文件的绝对路径。没有这个变量就用站点默认字体 */
export const readerFontsFileEnvName = 'DOCSITE_READER_FONTS_FILE'

/** 文件格式的版本号 */
export const readerFontsFormat = 1

/** 文件内容：每项是字体族名，没设是 null */
export interface ReaderFontsFile {
  format: typeof readerFontsFormat
  body: string | null
  heading: string | null
  mono: string | null
}

type ReaderFontSlot = 'body' | 'heading' | 'mono'

/** 每一项写成哪个 CSS 变量，后面接哪串后备字体：选的字体里没有的字（英文字体里的中文、emoji），浏览器逐字往后找 */
const cssOfSlot: Record<ReaderFontSlot, { variable: string; fallback: string }> = {
  body: { variable: '--font-sans', fallback: 'ui-sans-serif, system-ui, sans-serif' },
  heading: { variable: '--font-heading', fallback: 'ui-sans-serif, system-ui, sans-serif' },
  mono: { variable: '--font-mono', fallback: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
}

const readerFontSlots = Object.keys(cssOfSlot) as ReaderFontSlot[]

/** 字体名要放进 <style> 里的 CSS 字符串：能跳出字符串、跳出规则或跳出 <style> 的字符一律不收 */
const unsafeFontNameCharacters = /["'\\;{}<>\p{Cc}]/u

/** 一个字体名能不能写进阅读字体文件：gwb-docsite 写文件前、站点读文件时用同一条规则 */
export function isReaderFontName(name: string): boolean {
  return name.trim() !== '' && !unsafeFontNameCharacters.test(name)
}

/**
 * 阅读字体文件的内容换成要写进 <head> 的 CSS，三项都没设回 null。
 * 文件由 gwb-docsite 写，格式不对就是它的问题：直接报错写明哪一项，不悄悄改用默认字体
 */
export function readerFontsCssOf(content: unknown, file: string): string | null {
  const where = `阅读字体文件 ${file}`
  if (typeof content !== 'object' || content === null || Array.isArray(content)) throw new Error(`${where} 要是一个对象`)
  const record = content as Record<string, unknown>
  if (record['format'] !== readerFontsFormat) throw new Error(`${where} 的 format 要是 ${readerFontsFormat}，读到 ${JSON.stringify(record['format'])}`)
  const unknownKeys = Object.keys(record).filter((key) => key !== 'format' && !(readerFontSlots as string[]).includes(key))
  if (unknownKeys.length > 0) throw new Error(`${where} 有不认识的字段：${unknownKeys.join('、')}`)
  const declarations: string[] = []
  for (const slot of readerFontSlots) {
    const name = record[slot]
    if (name === null) continue
    if (typeof name !== 'string' || name.trim() === '') throw new Error(`${where} 的 ${slot} 要是非空字符串或 null，读到 ${JSON.stringify(name)}`)
    if (!isReaderFontName(name)) throw new Error(`${where} 的 ${slot} 里有不能放进 CSS 的字符：${JSON.stringify(name)}`)
    const { variable, fallback } = cssOfSlot[slot]
    declarations.push(`${variable}: "${name}", ${fallback};`)
  }
  return declarations.length === 0 ? null : `:root { ${declarations.join(' ')} }`
}
