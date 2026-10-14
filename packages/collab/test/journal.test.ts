import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { journalDatesOf, journalProblemsOf, journalSourcesOf } from '../src/node/journal-files.js'
import { isRealDate } from '../src/core/journal.js'
import { journalMentionsOf } from '../src/core/journal-mentions.js'
import { plainLinesOf } from '../src/core/plain-lines.js'
import { journalUrlOf } from '../src/core/layout.js'

function siteWith(files: Record<string, string>): string {
  const siteDir = mkdtempSync(path.join(tmpdir(), 'collab-site-'))
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(siteDir, file)), { recursive: true })
    writeFileSync(path.join(siteDir, file), content)
  }
  return siteDir
}

describe('日期与日志页的地址', () => {
  it('只认真实存在的 YYYY-MM-DD', () => {
    expect(isRealDate('2026-10-11')).toBe(true)
    expect(isRealDate('2028-02-29')).toBe(true)
    expect(isRealDate('2026-02-29')).toBe(false)
    expect(isRealDate('2026-13-01')).toBe(false)
    expect(isRealDate('2026-1-1')).toBe(false)
  })

  it('某一天的日志页在日历下面', () => {
    expect(journalUrlOf('2026-10-11')).toBe('/calendar/2026-10-11')
  })
})

describe('journal/ 里的文件', () => {
  it('只放 <真实日期>.mdx：别的文件名、不存在的日期、子文件夹逐个报出', () => {
    const siteDir = siteWith({ 'journal/2026-10-11.mdx': '', 'journal/notes.md': '', 'journal/2026-02-30.mdx': '', 'journal/pics/a.png': '' })
    expect(journalProblemsOf(siteDir).sort()).toEqual([
      'journal/2026-02-30.mdx：2026-02-30 不是真实存在的日期',
      'journal/notes.md：日志页的文件名要是 YYYY-MM-DD.mdx',
      'journal/pics：journal/ 里只放 <日期>.mdx，不放文件夹',
    ])
    expect(() => journalDatesOf(siteDir)).toThrow(/2026-02-30 不是真实存在的日期/)
  })

  it('没有 journal/ 就是还没有日志；有就按日期排，原文按日期取', () => {
    expect(journalDatesOf(siteWith({}))).toEqual([])
    const siteDir = siteWith({ 'journal/2026-10-11.mdx': '十一日\n', 'journal/2026-10-09.mdx': '九日\n' })
    expect(journalDatesOf(siteDir)).toEqual(['2026-10-09', '2026-10-11'])
    expect([...journalSourcesOf(siteDir)]).toEqual([
      ['2026-10-09', '九日\n'],
      ['2026-10-11', '十一日\n'],
    ])
  })
})

describe('日志里的进展', () => {
  const titles = new Map([
    ['20261001090000-aaaaaaa', '画采样板'],
    ['20261001090000-bbbbbbb', '调 PLL'],
  ])
  const titleOf = (id: string) => titles.get(id) ?? '已删除的记录'

  it('引用了这条记录的段落按日子列出，新的在前；段里的 RecordLink 换成标题，Markdown 记号去掉', () => {
    const sources = new Map([
      ['2026-10-09', '画完 <RecordLink id="20261001090000-aaaaaaa" /> 的第一版。\n\n别的事。\n'],
      ['2026-10-10', "import { X } from './x'\n\n**测完** <RecordLink id='20261001090000-aaaaaaa'/>，接着 <RecordLink id=\"20261001090000-bbbbbbb\" />，见[纹波页](/notes/ripple)。\n"],
    ])
    expect(journalMentionsOf('20261001090000-aaaaaaa', sources, titleOf)).toEqual([
      { date: '2026-10-10', text: '测完 画采样板，接着 调 PLL，见纹波页。' },
      { date: '2026-10-09', text: '画完 画采样板 的第一版。' },
    ])
  })

  it('引用了已经删掉的记录写「已删除的记录」；没有引用就是空的', () => {
    const sources = new Map([['2026-10-10', '收尾 <RecordLink id="20261001090000-ccccccc" /> 与 <RecordLink id="20261001090000-bbbbbbb" />\n']])
    expect(journalMentionsOf('20261001090000-bbbbbbb', sources, titleOf)).toEqual([{ date: '2026-10-10', text: '收尾 已删除的记录 与 调 PLL' }])
    expect(journalMentionsOf('20261001090000-aaaaaaa', sources, titleOf)).toEqual([])
  })
})

describe('日志里的进展按 MDX 语法树找', () => {
  const titleOf = (id: string) => (id === '20261001090000-aaaaaaa' ? '画采样板' : '已删除的记录')

  it('列表里的一项、组件里的段落、单独一行的 RecordLink 各算一段；代码块与花括号表达式里的不算', () => {
    const source = [
      '- 上午 <RecordLink id="20261001090000-aaaaaaa" /> 布线',
      '- 下午开会',
      '',
      '<Callout>',
      '注意 {1 + 1} 处 <RecordLink id="20261001090000-aaaaaaa" />',
      '</Callout>',
      '',
      '<RecordLink id="20261001090000-aaaaaaa" />',
      '',
      '```mdx',
      '<RecordLink id="20261001090000-aaaaaaa" />',
      '```',
      '',
    ].join('\n')
    expect(journalMentionsOf('20261001090000-aaaaaaa', new Map([['2026-10-12', source]]), titleOf)).toEqual([
      { date: '2026-10-12', text: '上午 画采样板 布线' },
      { date: '2026-10-12', text: '注意 处 画采样板' },
      { date: '2026-10-12', text: '画采样板' },
    ])
  })

  it('日志页不是合法的 MDX：报错点名那一天的文件', () => {
    expect(() => journalMentionsOf('20261001090000-aaaaaaa', new Map([['2026-10-12', '<RecordLink id="x"\n']]), titleOf)).toThrow(/journal\/2026-10-12\.mdx 不是合法的 MDX/)
  })
})

describe('Markdown 换成纯文字', () => {
  it('去掉标题、引用、列表、链接、强调、表格竖线与代码块围栏', () => {
    expect(plainLinesOf('# 标题\n\n> 引用\n- [x] **做完**\n1. [链接](/a) ![图](/b.png)\n```ts\n|a|b|\n|---|---|\n```\n')).toEqual(['标题', '引用', '做完', '链接 图', 'a|b'])
  })
})
