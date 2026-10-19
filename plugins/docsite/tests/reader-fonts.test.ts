import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readerFontsCssOf } from '@godcreator/god-docsite'
import { fontFamiliesOf, readerFontsFrom, writeReaderFontsFile } from '../src/reader-fonts.js'

describe('fontFamiliesOf：pwsh 交回的字体名整理成清单', () => {
  it('去掉空行、WPF 的组合字体与放不进 CSS 的名字，去重并排序', () => {
    const output = 'Sarasa Mono SC\r\nGlobal User Interface\r\n\r\nArial\r\nArial\r\nBad"Font\r\nCascadia Code\r\n'
    expect(fontFamiliesOf(output)).toEqual(['Arial', 'Cascadia Code', 'Sarasa Mono SC'])
  })
})

describe('readerFontsFrom：三项设置拼成文件内容', () => {
  it('没设的是 null', () => {
    const values: Record<string, unknown> = { 'font-body': 'Sarasa Mono SC', 'font-mono': 'Sarasa Mono SC' }
    expect(readerFontsFrom((key) => values[key])).toEqual({ format: 1, body: 'Sarasa Mono SC', heading: null, mono: 'Sarasa Mono SC' })
  })

  it('设置里不是字体名就报错，写明哪一项', () => {
    expect(() => readerFontsFrom((key) => (key === 'font-heading' ? 3 : undefined))).toThrow('设置 font-heading 要是一个字体名，读到 3')
    expect(() => readerFontsFrom((key) => (key === 'font-body' ? '' : undefined))).toThrow('设置 font-body 要是一个字体名')
  })
})

describe('writeReaderFontsFile：原子写入', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'gwb-docsite-reader-fonts-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('目录不在就建，写完不留临时文件，站点按同一份格式读得出来', async () => {
    const file = path.join(dir, 'data', 'reader-fonts.json')
    await writeReaderFontsFile(file, { format: 1, body: 'Sarasa Mono SC', heading: null, mono: null })
    await writeReaderFontsFile(file, { format: 1, body: null, heading: null, mono: 'Cascadia Code' })
    expect(readdirSync(path.dirname(file))).toEqual(['reader-fonts.json'])
    const written: unknown = JSON.parse(readFileSync(file, 'utf8'))
    expect(written).toEqual({ format: 1, body: null, heading: null, mono: 'Cascadia Code' })
    expect(readerFontsCssOf(written, file)).toContain('--font-mono: "Cascadia Code"')
  })
})
