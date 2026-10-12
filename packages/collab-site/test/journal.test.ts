import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { journalDatesOf, journalProblemsOf, journalSourcesOf } from '../src/journal-files.js'
import { journalMentionsOf } from '../src/journal.js'
import { plainLinesOf } from '../src/plain-lines.js'
import { isRealDate, journalUrlOf } from '../src/site-data.js'
import { collabSiteMdxProblems, collabSiteProblems } from '../src/site-check.js'

function siteWith(files: Record<string, string>): string {
  const siteDir = mkdtempSync(path.join(tmpdir(), 'collab-site-'))
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(siteDir, file)), { recursive: true })
    writeFileSync(path.join(siteDir, file), content)
  }
  return siteDir
}

/**
 * 站点检查用站点自己装的基础包编译 MDX：站点的 node_modules 链到功能包装的基础包在 pnpm 仓库里的那一层，
 * 基础包和它的依赖都在那一层里。vitest 按链接的路径找依赖、不换成真实路径，只链基础包一个找不到它的依赖
 */
function installedSiteWith(files: Record<string, string>): string {
  const siteDir = siteWith(files)
  const installedKit = realpathSync(path.resolve(import.meta.dirname, '../node_modules/@godcreator/docsite-kit'))
  symlinkSync(path.resolve(installedKit, '../..'), path.join(siteDir, 'node_modules'), 'junction')
  return siteDir
}

const people = `${JSON.stringify([{ id: 'bob', name: '鲍勃' }])}\n`

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

  it('站点检查：基础包查的人员列表与评论，加上日志页的文件名', async () => {
    expect(await collabSiteProblems(siteWith({ 'people.json': people, 'journal/2026-10-11.mdx': '' }))).toEqual([])
    const problems = await collabSiteProblems(siteWith({ 'people.json': people, 'journal/oops.mdx': '', 'comments/2026-10-11-a/index.mdx': '---\nauthor: dave\ncreatedAt: 2026-10-11T09:00:00.000Z\nstatus: open\n---\n\n问一下\n' }))
    expect(problems).toEqual(['2026-10-11-a/index.mdx 的 author dave 不在 people.json 里', 'journal/oops.mdx：日志页的文件名要是 YYYY-MM-DD.mdx'])
  })

  it('提交前的编译检查：内容页、评论、日志页里编不过的 MDX 与写错的公式报出文件', async () => {
    const siteDir = installedSiteWith({ 'journal/2026-10-11.mdx': '电压 $\\frac{1}{$ 伏\n', 'content/index.mdx': '<Unclosed>\n', 'comments/2026-10-11-a/index.mdx': '---\nauthor: bob\n---\n\n好\n' })
    const problems = await collabSiteMdxProblems(siteDir)
    expect(problems).toHaveLength(2)
    expect(problems.some((problem) => problem.includes('journal') && problem.includes('2026-10-11.mdx'))).toBe(true)
    expect(problems.some((problem) => problem.includes('content') && problem.includes('index.mdx'))).toBe(true)
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

describe('Markdown 换成纯文字', () => {
  it('去掉标题、引用、列表、链接、强调、表格竖线与代码块围栏', () => {
    expect(plainLinesOf('# 标题\n\n> 引用\n- [x] **做完**\n1. [链接](/a) ![图](/b.png)\n```ts\n|a|b|\n|---|---|\n```\n')).toEqual(['标题', '引用', '做完', '链接 图', 'a|b'])
  })
})
