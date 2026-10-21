/**
 * 阅读字体：读者在 gwb 设置里选的三项字体，gwb-docsite 放进托管方上下文（推送频道 host）交给站点，站点按它在 <head> 里写 CSS
 */

/** 三项字体：每项是字体族名，没设是 null */
export interface ReaderFonts {
  body: string | null
  heading: string | null
  mono: string | null
}

export type ReaderFontSlot = keyof ReaderFonts

/** 每一项写成哪个 CSS 变量，后面接哪串后备字体：选的字体里没有的字（英文字体里的中文、emoji），浏览器逐字往后找 */
const cssOfSlot: Record<ReaderFontSlot, { variable: string; fallback: string }> = {
  body: { variable: '--font-sans', fallback: 'ui-sans-serif, system-ui, sans-serif' },
  heading: { variable: '--font-heading', fallback: 'ui-sans-serif, system-ui, sans-serif' },
  mono: { variable: '--font-mono', fallback: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
}

export const readerFontSlots = Object.keys(cssOfSlot) as ReaderFontSlot[]

/** 字体名要放进 <style> 里的 CSS 字符串：能跳出字符串、跳出规则或跳出 <style> 的字符一律不收 */
const unsafeFontNameCharacters = /["'\\;{}<>\p{Cc}]/u

/** 一个字体名能不能交给站点：gwb-docsite 推之前、站点收到时用同一条规则 */
export function isReaderFontName(name: string): boolean {
  return name.trim() !== '' && !unsafeFontNameCharacters.test(name)
}

/** 三项字体换成要写进 <head> 的 CSS，三项都没设回 null。字体名在收下上下文时已经核对过 */
export function readerFontsCssOf(fonts: ReaderFonts): string | null {
  const declarations = readerFontSlots.flatMap((slot) => {
    const name = fonts[slot]
    if (name === null) return []
    const { variable, fallback } = cssOfSlot[slot]
    return [`${variable}: "${name}", ${fallback};`]
  })
  return declarations.length === 0 ? null : `:root { ${declarations.join(' ')} }`
}
