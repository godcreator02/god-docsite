import { describe, expect, it } from 'vitest'
import { firstLine, remainingText, shortName, statusLabel } from '../src/client/site-rows.js'

describe('窗格「文档站」的显示', () => {
  const now = Date.UTC(2026, 9, 9, 4, 0, 0)
  const later = (seconds: number) => new Date(now + seconds * 1000).toISOString()

  it('一小时以上写到分，一小时以内写到秒，过了时刻写「正在停」', () => {
    expect(remainingText(later(11 * 3600 + 32 * 60 + 59), now)).toBe('11 小时 32 分')
    expect(remainingText(later(3600), now)).toBe('1 小时 00 分')
    expect(remainingText(later(3599), now)).toBe('59 分 59 秒')
    expect(remainingText(later(5), now)).toBe('0 分 05 秒')
    expect(remainingText(later(0), now)).toBe('正在停')
    expect(remainingText(later(-30), now)).toBe('正在停')
  })

  it('站目录只留最后两段，两种斜杠都认', () => {
    expect(shortName('D:\\unitfolders\\evew5-gwbapps\\gwb-block-note-redesign\\docs-site')).toBe('gwb-block-note-redesign/docs-site')
    expect(shortName('/home/a/repo/docs-site/')).toBe('repo/docs-site')
  })

  it('状态与报错', () => {
    expect(statusLabel('expired')).toBe('已到期')
    expect(firstLine('pnpm build 失败（退出码 1）。输出的最后几行：\nerror TS2322')).toBe('pnpm build 失败（退出码 1）。输出的最后几行：')
  })
})
