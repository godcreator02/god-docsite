import { describe, expect, it } from 'vitest'
import { parseHostContext } from '@godcreator/god-docsite'
import { fontFamiliesOf, readerFontsFrom } from '../src/reader-fonts.js'

describe('fontFamiliesOf：pwsh 交回的字体名整理成清单', () => {
  it('去掉空行、WPF 的组合字体与放不进 CSS 的名字，去重并排序', () => {
    const output = 'Sarasa Mono SC\r\nGlobal User Interface\r\n\r\nArial\r\nArial\r\nBad"Font\r\nCascadia Code\r\n'
    expect(fontFamiliesOf(output)).toEqual(['Arial', 'Cascadia Code', 'Sarasa Mono SC'])
  })
})

describe('readerFontsFrom：三项设置拼成托管方上下文的 readerFonts', () => {
  it('没设的是 null；拼出来的站点收得下', () => {
    const values: Record<string, unknown> = { 'font-body': 'Sarasa Mono SC', 'font-mono': 'Sarasa Mono SC' }
    const readerFonts = readerFontsFrom((key) => values[key])
    expect(readerFonts).toEqual({ body: 'Sarasa Mono SC', heading: null, mono: 'Sarasa Mono SC' })
    expect(parseHostContext({ format: 1, identityCode: 'mycode000001', readerFonts }).readerFonts).toEqual(readerFonts)
  })

  it('设置里不是字体名就报错，写明哪一项', () => {
    expect(() => readerFontsFrom((key) => (key === 'font-heading' ? 3 : undefined))).toThrow('设置 font-heading 要是一个字体名，读到 3')
    expect(() => readerFontsFrom((key) => (key === 'font-body' ? '' : undefined))).toThrow('设置 font-body 要是一个字体名')
  })
})
