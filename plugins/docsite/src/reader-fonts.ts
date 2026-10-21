import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { isReaderFontName, type ReaderFonts } from '@godcreator/god-docsite'

const execFileAsync = promisify(execFile)

/** 阅读字体三项设置：键、在托管方上下文 readerFonts 里的字段、设置界面上的标题与说明 */
export const readerFontSettings = [
  { key: 'font-body', slot: 'body', title: '正文字体', description: '托管的站点正文用的字体，从本机装了的字体里选；选「默认」用站点默认字体。改了马上推给在运行的站，页面不用刷新' },
  { key: 'font-heading', slot: 'heading', title: '标题字体', description: '托管的站点标题（页面标题与正文各级标题）用的字体；选「默认」跟正文字体一样。改了马上推给在运行的站，页面不用刷新' },
  { key: 'font-mono', slot: 'mono', title: '代码字体', description: '托管的站点代码与讲解组件里等宽文字用的字体；选「默认」用站点默认的等宽字体。改了马上推给在运行的站，页面不用刷新' },
] as const

/** WPF 自己的组合字体（Global User Interface、Global Monospace 等）：不是真的字体，Chrome 不认 */
const wpfCompositeFontPrefix = 'Global '

/** 每个字体族一行 en-us 的名字；字重不拆成单独的族，用户目录与随应用装的字体都在。为什么选 WPF 见 probes/2610192151_local-font-family-names */
const listFontFamiliesCommand =
  "[Console]::OutputEncoding = [Text.Encoding]::UTF8; Add-Type -AssemblyName PresentationCore; [System.Windows.Media.Fonts]::SystemFontFamilies | % { $_.FamilyNames[[System.Windows.Markup.XmlLanguage]::GetLanguage('en-us')] }"

/** pwsh 交回的一行一个名字整理成下拉框的清单：去掉空行、组合字体与放不进 CSS 的名字，去重、按名字排序 */
export function fontFamiliesOf(output: string): string[] {
  const names = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((name) => name !== '' && !name.startsWith(wpfCompositeFontPrefix) && isReaderFontName(name))
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'en'))
}

/** 设置项的选项：每次现列，装了新字体马上能选到。只做了 Windows */
export async function listInstalledFontFamilies(): Promise<string[]> {
  if (process.platform !== 'win32') throw new Error(`列本机字体只做了 Windows（用 WPF 的系统字体列表），这台是 ${process.platform}`)
  try {
    const { stdout } = await execFileAsync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', listFontFamiliesCommand], { encoding: 'utf8', windowsHide: true, timeout: 30_000 })
    return fontFamiliesOf(stdout)
  } catch (error) {
    throw new Error(`列本机字体失败（用 pwsh 7 运行 WPF 的系统字体列表）：${error instanceof Error ? error.message : String(error)}`)
  }
}

/** 三项设置的当前值拼成托管方上下文的 readerFonts：没设是 null；设置里不是字体名说明设置被手改坏了，报错 */
export function readerFontsFrom(settingOf: (key: string) => unknown): ReaderFonts {
  const fonts: ReaderFonts = { body: null, heading: null, mono: null }
  for (const { key, slot } of readerFontSettings) {
    const value = settingOf(key)
    if (value === undefined) continue
    if (typeof value !== 'string' || !isReaderFontName(value)) throw new Error(`设置 ${key} 要是一个字体名，读到 ${JSON.stringify(value)}`)
    fonts[slot] = value
  }
  return fonts
}
