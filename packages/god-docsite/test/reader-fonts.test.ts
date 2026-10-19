import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readerFontsCssOf, readerFontsFileEnvName } from '../src/core/reader-fonts'
import { readerFontsCss } from '../src/site/reader-fonts.server'

describe('readerFontsCssOf：文件内容换成 :root 变量', () => {
  it('只写设了的项，名字后面接后备字体', () => {
    const css = readerFontsCssOf({ format: 1, body: 'Sarasa Mono SC', heading: null, mono: 'Sarasa Mono SC' }, 'f.json')
    expect(css).toBe(
      ':root { --font-sans: "Sarasa Mono SC", ui-sans-serif, system-ui, sans-serif; --font-mono: "Sarasa Mono SC", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }',
    )
  })

  it('只设标题时只出 --font-heading', () => {
    expect(readerFontsCssOf({ format: 1, body: null, heading: 'Noto Serif SC', mono: null }, 'f.json')).toBe(
      ':root { --font-heading: "Noto Serif SC", ui-sans-serif, system-ui, sans-serif; }',
    )
  })

  it('三项都没设回 null', () => {
    expect(readerFontsCssOf({ format: 1, body: null, heading: null, mono: null }, 'f.json')).toBeNull()
  })

  it.each([
    [[], '要是一个对象'],
    [{ format: 2, body: null, heading: null, mono: null }, 'format 要是 1，读到 2'],
    [{ format: 1, body: null, heading: null, mono: null, size: 14 }, '不认识的字段：size'],
    [{ format: 1, body: 3, heading: null, mono: null }, 'body 要是非空字符串或 null，读到 3'],
    [{ format: 1, body: null, heading: null }, 'mono 要是非空字符串或 null，读到 undefined'],
    [{ format: 1, body: '  ', heading: null, mono: null }, 'body 要是非空字符串或 null'],
    [{ format: 1, body: 'A"; } body { color: red', heading: null, mono: null }, 'body 里有不能放进 CSS 的字符'],
    [{ format: 1, body: null, heading: 'x</style><script>', mono: null }, 'heading 里有不能放进 CSS 的字符'],
    [{ format: 1, body: null, heading: null, mono: 'a\nb' }, 'mono 里有不能放进 CSS 的字符'],
  ])('格式不对报错：%j', (content, message) => {
    expect(() => readerFontsCssOf(content, 'f.json')).toThrow(message)
  })
})

describe('readerFontsCss：按环境变量读文件', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'reader-fonts-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('没有环境变量回 null；变量是空串报错', () => {
    expect(readerFontsCss({})).toBeNull()
    expect(() => readerFontsCss({ [readerFontsFileEnvName]: '' })).toThrow('环境变量 DOCSITE_READER_FONTS_FILE 是空的')
  })

  it('读文件；文件改了（修改时间或大小变了）就重读', () => {
    const file = path.join(dir, 'reader-fonts.json')
    const env = { [readerFontsFileEnvName]: file }
    writeFileSync(file, JSON.stringify({ format: 1, body: 'Sarasa Mono SC', heading: null, mono: null }))
    expect(readerFontsCss(env)).toContain('--font-sans: "Sarasa Mono SC"')
    writeFileSync(file, JSON.stringify({ format: 1, body: null, heading: null, mono: 'Cascadia Code' }))
    utimesSync(file, new Date(), new Date(Date.now() + 5000))
    expect(readerFontsCss(env)).toBe(':root { --font-mono: "Cascadia Code", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }')
  })

  it('文件不在、不是 JSON 都报错，写明文件路径', () => {
    const file = path.join(dir, 'missing.json')
    expect(() => readerFontsCss({ [readerFontsFileEnvName]: file })).toThrow(`阅读字体文件 ${file}（环境变量 DOCSITE_READER_FONTS_FILE）读不了`)
    const broken = path.join(dir, 'broken.json')
    writeFileSync(broken, '{"format":')
    expect(() => readerFontsCss({ [readerFontsFileEnvName]: broken })).toThrow(`阅读字体文件 ${broken} 不是 JSON`)
  })
})
