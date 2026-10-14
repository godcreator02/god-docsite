import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { glossaryIndexOfFile, parseGlossary } from '../src/node/glossary-file.js'
import { remarkGlossary } from '../src/mdx/remark-glossary.js'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'god-docsite-glossary-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function writeGlossary(entries: unknown, modifiedAt: number) {
  const file = path.join(dir, 'glossary.json')
  writeFileSync(file, JSON.stringify(entries))
  utimesSync(file, modifiedAt, modifiedAt)
  return file
}

function termCount(source: string, file: string) {
  const tree = unified().use(remarkParse).use(remarkMdx).parse(source)
  remarkGlossary({ file })()(tree, { path: 'content/a.mdx' })
  return JSON.stringify(tree).split('"name":"Term"').length - 1
}

describe('术语表文件', () => {
  it('写错的项一次列出全部问题并点名文件', () => {
    expect(() => parseGlossary([{ term: '', def: 'x' }, { term: '身份码', def: '码', note: 1 }], 'g.json')).toThrow(
      /g\.json 第 1 项：term 要是非空字符串[\s\S]*第 2 项：认不出 note/,
    )
    expect(() => parseGlossary({}, 'g.json')).toThrow(/要是一个数组/)
  })

  it('不是 JSON 时报文件名', () => {
    const file = path.join(dir, 'glossary.json')
    writeFileSync(file, '[{')
    expect(() => glossaryIndexOfFile(file)).toThrow(/术语表 .*glossary\.json 不是 JSON/)
  })

  it('插件按文件读术语表，文件改了之后编译的页面用新表', () => {
    const file = writeGlossary([{ term: '身份码', def: '一台机器一个的码' }], 1_000)
    expect(termCount('提到身份码。', file)).toBe(1)
    expect(termCount('提到功能包。', file)).toBe(0)
    writeGlossary([{ term: '功能包', def: '按功能切的包' }], 2_000)
    expect(termCount('提到功能包。', file)).toBe(1)
  })
})
