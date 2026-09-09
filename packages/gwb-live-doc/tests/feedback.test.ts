import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { appendEntry, formatEntry, inboundPath, newPage, parseEntries, readInbound, today, writeFeedback } from '../src/feedback.js'

/**
 * 反馈条目的格式、追加、读回。格式的正本是 live-doc-cli 的站模板
 * `template/docs-site/content/feedback/inbound.mdx.tpl`——这几条钉的就是那份格式。
 */

let tmp: string
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-live-doc-fb-'))
})
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('formatEntry：一条一节，标题行带日期，来源单独一行', () => {
  it('模板定的那个形状', () => {
    expect(formatEntry({ date: '2026-09-09', title: '这条命令的回执缺个字段', from: 'block-note（某会话）', body: '正文第一段\n\n第二段' })).toBe(
      '## 2026-09-09 这条命令的回执缺个字段\n\n来源：block-note（某会话）\n\n正文第一段\n\n第二段\n',
    )
  })

  it('标题里的换行折平——`## ` 那一行只能是一行', () => {
    expect(formatEntry({ date: '2026-09-09', title: '上\n下', from: 'x', body: 'b' }).split('\n')[0]).toBe('## 2026-09-09 上 下')
  })
})

describe('today：本机时区的 yyyy-MM-dd', () => {
  it('不是 UTC——晚上八点写的条目不该落到明天', () => {
    expect(today(new Date(2026, 8, 9, 23, 30))).toBe('2026-09-09')
  })
})

describe('appendEntry：追加在末尾，新的在下', () => {
  it('页尾多余的空行不累积，条目之间恰好空一行', () => {
    const page = `${newPage()}\n\n\n`
    const once = appendEntry(page, { date: '2026-09-09', title: '甲', from: 'a', body: '一' })
    const twice = appendEntry(once, { date: '2026-09-10', title: '乙', from: 'b', body: '二' })
    expect(twice).not.toMatch(/\n{3}/)
    expect(twice.indexOf('## 2026-09-09 甲')).toBeLessThan(twice.indexOf('## 2026-09-10 乙'))
  })
})

describe('parseEntries：读回来的跟写进去的对得上', () => {
  it('一来一回不丢字段', () => {
    const entry = { date: '2026-09-09', title: '甲', from: 'block-note（某会话）', body: '一行\n\n又一行' }
    expect(parseEntries(appendEntry(newPage(), entry))).toEqual([entry])
  })

  it('页标题（#）与条目正文里的小节（###）都不当条目', () => {
    const page = `${newPage()}\n\n## 2026-09-09 甲\n\n来源：a\n\n### 里面的小节\n\n正文\n`
    expect(parseEntries(page).map((e) => e.title)).toEqual(['甲'])
    expect(parseEntries(page)[0]?.body).toBe('### 里面的小节\n\n正文')
  })

  it('围栏里的 `## ` 不算条目——正文里贴一段 markdown 是常事', () => {
    const page = '## 2026-09-09 甲\n\n来源：a\n\n```md\n## 这是正文里贴的\n```\n'
    const got = parseEntries(page)
    expect(got).toHaveLength(1)
    expect(got[0]?.body).toContain('## 这是正文里贴的')
  })

  it('没写来源的条目：from 是空串，正文原样留着', () => {
    expect(parseEntries('## 2026-09-09 甲\n\n正文\n')[0]).toEqual({ date: '2026-09-09', title: '甲', from: '', body: '正文' })
  })
})

describe('writeFeedback：追加落盘，页不在就先建', () => {
  it('页不在：建出来，只有这一条', () => {
    const site = path.join(tmp, 'docs-site')
    fs.mkdirSync(path.join(site, 'content'), { recursive: true })
    const got = writeFeedback(site, { date: '2026-09-09', title: '甲', from: 'a', body: '一' })
    expect(got).toMatchObject({ file: inboundPath(site), created: true, total: 1 })
    expect(fs.existsSync(inboundPath(site))).toBe(true)
    expect(readInbound(site)).toContain('**本页回答**')
  })

  it('页在：追加，已有条目一个不动', () => {
    const site = path.join(tmp, 'docs-site')
    fs.mkdirSync(path.dirname(inboundPath(site)), { recursive: true })
    fs.writeFileSync(inboundPath(site), '---\ntitle: 投来的反馈\n---\n\n# 投来的反馈\n\n## 2026-01-01 旧的\n\n来源：老会话\n\n旧正文\n')
    const got = writeFeedback(site, { date: '2026-09-09', title: '新的', from: 'a', body: '一' })
    expect(got.created).toBe(false)
    expect(got.total).toBe(2)
    const entries = parseEntries(readInbound(site) ?? '')
    expect(entries.map((e) => e.title)).toEqual(['旧的', '新的'])
    expect(entries[0]?.body).toBe('旧正文')
  })

  it('页还不在时 readInbound 回 undefined，不抛', () => {
    expect(readInbound(path.join(tmp, 'nope'))).toBeUndefined()
  })
})
