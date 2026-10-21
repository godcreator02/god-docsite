import { isReaderFontName, readerFontSlots, type ReaderFonts } from './reader-fonts.js'

/**
 * 托管方上下文：托管站点的 gwb-docsite 把自己知道的事合成一份，推进站点推送通道的这个频道；站点每次请求读频道里现在的值。
 * 外部契约：频道名、format 与字段由 gwb-docsite 与站点共同遵守，字段的意思变了要升 format
 */
export const hostChannel = 'host'

export const hostContextFormat = 1

export interface HostContext {
  format: typeof hostContextFormat
  /** 本 home 的身份码：站点按它在 people.json 里认人 */
  identityCode: string
  /** 插件提供的本机目录，名字到绝对路径；只推给 audience 为 personal 的站，shared 站收到的没有这一项 */
  dirs?: Readonly<Record<string, string>>
  readerFonts: ReaderFonts
}

const hostContextKeys = ['format', 'identityCode', 'dirs', 'readerFonts']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readerFontsOf(value: unknown): ReaderFonts {
  if (!isRecord(value)) throw new Error(`托管方上下文的 readerFonts 要是 { body, heading, mono }，收到 ${JSON.stringify(value)}`)
  const unknownKeys = Object.keys(value).filter((key) => !(readerFontSlots as string[]).includes(key))
  if (unknownKeys.length > 0) throw new Error(`托管方上下文的 readerFonts 有不认识的字段：${unknownKeys.join('、')}`)
  const fonts: ReaderFonts = { body: null, heading: null, mono: null }
  for (const slot of readerFontSlots) {
    const name = value[slot]
    if (name === null) continue
    if (typeof name !== 'string' || !isReaderFontName(name)) throw new Error(`托管方上下文的 readerFonts.${slot} 要是 null 或能放进 CSS 的字体名，收到 ${JSON.stringify(name)}`)
    fonts[slot] = name
  }
  return fonts
}

function dirsOf(value: unknown): Record<string, string> {
  if (!isRecord(value) || !Object.values(value).every((dir) => typeof dir === 'string' && dir !== '')) {
    throw new Error(`托管方上下文的 dirs 要是「名字: 绝对路径」的对象，收到 ${JSON.stringify(value)}`)
  }
  return value as Record<string, string>
}

/** 核对推进频道 host 的值：推送时就核对，写错了推送被拒、报错写明哪一项 */
export function parseHostContext(value: unknown): HostContext {
  if (!isRecord(value)) throw new Error(`托管方上下文要是一个对象，收到 ${JSON.stringify(value)}`)
  const unknownKeys = Object.keys(value).filter((key) => !hostContextKeys.includes(key))
  if (unknownKeys.length > 0) throw new Error(`托管方上下文有不认识的字段：${unknownKeys.join('、')}`)
  if (value['format'] !== hostContextFormat) throw new Error(`托管方上下文的 format 要是 ${hostContextFormat}，收到 ${JSON.stringify(value['format'])}：gwb-docsite 与站点的平台包版本对不上`)
  const identityCode = value['identityCode']
  if (typeof identityCode !== 'string' || identityCode === '') throw new Error(`托管方上下文的 identityCode 要是非空字符串，收到 ${JSON.stringify(identityCode)}`)
  return {
    format: hostContextFormat,
    identityCode,
    ...(value['dirs'] === undefined ? {} : { dirs: dirsOf(value['dirs']) }),
    readerFonts: readerFontsOf(value['readerFonts']),
  }
}
