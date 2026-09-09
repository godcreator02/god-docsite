import { describe, expect, it } from 'vitest'
import type { CheckReport } from '@godcreator02/live-doc-cli'
import { collapse, parseCheckJson } from '../src/stale.js'

/**
 * 待重写页的口径，与从 stdout 里捞机读报告那一步。喂一份 JSON 看输出，不起进程。
 */

function doc(over: Partial<CheckReport['docs'][number]> = {}): CheckReport['docs'][number] {
  return { doc: 'content/docs/a.mdx', red: 0, items: [], orphans: [], components: [], outputs: [], ...over }
}

function item(over: Partial<CheckReport['docs'][number]['items'][number]> = {}): CheckReport['docs'][number]['items'][number] {
  return { target: '../src/a.ts:2-3', kind: 'span', status: 'fresh', line: 12, lines: [2, 3], draft: false, ...over }
}

function report(over: Partial<CheckReport> = {}): CheckReport {
  return { ok: true, red: 0, docs: [], strays: [], trajectory: [], ...over }
}

describe('collapse：待重写页 = 钉漂了的，或生成物不新鲜的', () => {
  it('changed 与 missing 进 pins，fresh 与 unconfirmed 不进', () => {
    const got = collapse(
      report({
        docs: [
          doc({
            red: 1,
            items: [
              item({ status: 'fresh' }),
              item({ target: '../src/b.ts:1-4', status: 'unconfirmed' }),
              item({ target: '../src/c.ts:5-6', status: 'changed', diff: '- a\n+ b' }),
              item({ target: '../src/d.ts', kind: 'file', status: 'missing', reason: 'file-missing' }),
            ],
          }),
        ],
      }),
    )
    expect(got.pages).toHaveLength(1)
    expect(got.pages[0]?.pins.map((p) => [p.target, p.status])).toEqual([
      ['../src/c.ts:5-6', 'changed'],
      ['../src/d.ts', 'missing'],
    ])
    expect(got.pages[0]?.pins[0]?.diff).toBe('- a\n+ b')
    expect(got.pages[0]?.pins[1]?.reason).toBe('file-missing')
  })

  it('钉全绿但生成物不新鲜的页照样是待重写页——新不新鲜照报告里的 fresh，不自己解释四态', () => {
    const got = collapse(
      report({
        red: 1,
        ok: false,
        docs: [
          doc({
            red: 1,
            items: [item()],
            outputs: [
              { to: '../README.md', status: 'stale', fresh: false },
              { to: '../x.md', status: 'fresh', fresh: true },
            ],
          }),
        ],
      }),
    )
    expect(got.pages).toHaveLength(1)
    // 新鲜的落点不列——列了就得让人一条条筛
    expect(got.pages[0]?.outputs).toEqual([{ to: '../README.md', status: 'stale', fresh: false }])
  })

  it('只有孤儿记录 / 名册外组件的页进 others，不进 pages——那两种不用重写正文', () => {
    const got = collapse(
      report({
        red: 2,
        ok: false,
        docs: [doc({ red: 2, orphans: ['../src/gone.ts:1-2'], components: [{ name: 'Callout', line: 7 }] })],
      }),
    )
    expect(got.pages).toEqual([])
    expect(got.others).toEqual([{ doc: 'content/docs/a.mdx', orphans: ['../src/gone.ts:1-2'], components: [{ name: 'Callout', line: 7 }] }])
  })

  it('全绿的站：两张表都空，红是 0', () => {
    const got = collapse(report({ docs: [doc({ items: [item()] }), doc({ doc: 'content/docs/b.mdx' })] }))
    expect(got).toMatchObject({ ok: true, red: 0, docs: 2, pages: [], others: [] })
  })

  it('失踪文档与病卡原样带出来——它们也红，但不属于任何一页', () => {
    const got = collapse(
      report({
        ok: false,
        red: 2,
        strays: ['docs/old.md'],
        trajectory: [{ path: 'content/trajectory/x.mdx', field: 'born-at', value: '一月一号', reason: '不是日期' }],
      }),
    )
    expect(got.strays).toEqual(['docs/old.md'])
    expect(got.trajectory[0]?.field).toBe('born-at')
  })
})

describe('parseCheckJson：从 stdout 里捞那一行机读报告', () => {
  it('前后有别的话也捞得出来', () => {
    const line = JSON.stringify(report({ red: 3, ok: false }))
    expect(parseCheckJson(`一句告警\n${line}\n`)?.red).toBe(3)
  })

  it('捞不出来回 undefined：空的、不是 JSON、是 JSON 但不是报告', () => {
    expect(parseCheckJson('')).toBeUndefined()
    expect(parseCheckJson('{ 不是 json')).toBeUndefined()
    expect(parseCheckJson('{"ok":true}')).toBeUndefined()
    // 少字段就不认：那说明对面那份 cli 太老
    expect(parseCheckJson(JSON.stringify({ ok: true, red: 0, docs: [], strays: [] }))).toBeUndefined()
  })

  it('多行 JSON 取最后一份——一趟里只有最后那份是这次的报告', () => {
    const first = JSON.stringify(report({ red: 1 }))
    const second = JSON.stringify(report({ red: 9 }))
    expect(parseCheckJson(`${first}\n${second}`)?.red).toBe(9)
  })
})
