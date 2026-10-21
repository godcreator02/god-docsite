import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { selfContainedProblemsOf, siteReferences } from '../src/node/references.js'
import { siteReferencesForRequests } from '../src/site/references.server.js'

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function writeFile(file: string, text: string): void {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
}

/** 假功能包：登记 component，./node 出口按 <站点>/<dir>/<id>.mdx 在不在回文件 */
function fakeReferencePackage(siteDir: string, name: string, component: string, dir: string): void {
  const packageDir = path.join(siteDir, 'node_modules', ...name.split('/'))
  writeFile(path.join(packageDir, 'package.json'), JSON.stringify({ name, version: '1.0.0', type: 'module', exports: { './node': './node.mjs' }, godDocsite: { references: { components: [component] } } }))
  writeFile(
    path.join(packageDir, 'node.mjs'),
    [
      "import { existsSync } from 'node:fs'",
      "import path from 'node:path'",
      `export const resolveReference = (id, place) => { const file = path.join(place.siteDir, ${JSON.stringify(dir)}, id + '.mdx'); return existsSync(file) ? [file] : undefined }`,
      `export const publishHint = (id) => '${dir}.publish { id: "' + id + '" }'`,
    ].join('\n'),
  )
}

function newSite(audience: 'personal' | 'shared', packages: Array<[string, string, string]>): string {
  const siteDir = mkdtempSync(path.join(tmpdir(), 'god-docsite-references-'))
  tempDirs.push(siteDir)
  writeFile(path.join(siteDir, 'package.json'), JSON.stringify({ name: 'site', dependencies: Object.fromEntries(packages.map(([name]) => [name, '1.0.0'])) }))
  writeFile(path.join(siteDir, 'docsite.json'), JSON.stringify({ kind: 'base', audience, format: 2 }))
  for (const [name, component, dir] of packages) fakeReferencePackage(siteDir, name, component, dir)
  return siteDir
}

const papersAndNotes: Array<[string, string, string]> = [
  ['@test/papers', 'Paper', 'papers'],
  ['@test/notes', 'Note', 'notes'],
]

describe('siteReferences', () => {
  it('从内容页出发，顺着引用扫进条目的页面；走不到的不扫，代码块里的例子不算，frontmatter 与公式里的花括号不碍事', async () => {
    const siteDir = newSite('shared', papersAndNotes)
    const index = path.join(siteDir, 'content', 'index.mdx')
    writeFile(
      index,
      ['---', 'title: 首页 {不是表达式}', '---', '', '公式 $\\{a\\}$ 里有花括号。', '', '<Paper id="a" />', '', '见 <Note id="n1" /> 的笔记。', '', '```mdx', '<Paper id="in-code" />', '```', ''].join('\n'),
    )
    const note = path.join(siteDir, 'notes', 'n1.mdx')
    writeFile(note, '笔记里引用另一篇：<Paper id="b" />\n')
    writeFile(path.join(siteDir, 'papers', 'a.mdx'), '# 论文 a\n')
    writeFile(path.join(siteDir, 'papers', 'c.mdx'), '# 没人引用的论文 c\n')
    writeFile(path.join(siteDir, 'notes', 'n2.mdx'), '走不到的笔记：<Paper id="d" />\n')
    const result = await siteReferences({ siteDir, audience: 'shared', providedDirs: {} })
    expect(result.references).toEqual([
      { component: 'Paper', id: 'a', from: index },
      { component: 'Note', id: 'n1', from: index },
    ])
    expect(result.missing).toEqual([{ component: 'Paper', id: 'b', from: note }])
    expect(result.problems).toEqual([])
  })

  it('id 没写、写成表达式、文件解析不了，记进 problems', async () => {
    const siteDir = newSite('shared', papersAndNotes)
    const index = path.join(siteDir, 'content', 'index.mdx')
    writeFile(index, ['<Paper id={x} />', '', '<Note />', ''].join('\n'))
    const broken = path.join(siteDir, 'content', 'broken.mdx')
    writeFile(broken, '<Paper id="a"\n')
    const { problems } = await siteReferences({ siteDir, audience: 'shared', providedDirs: {} })
    expect(problems.map(({ from }) => from)).toEqual([`${broken}`, `${index}:1`, `${index}:3`])
    expect(problems[0]!.message).toMatch(/^解析不了/)
    expect(problems[1]!.message).toContain('写成了表达式')
    expect(problems[2]!.message).toContain('没写')
  })

  it('文件改了按修改时间与大小重新解析', async () => {
    const siteDir = newSite('shared', papersAndNotes)
    const index = path.join(siteDir, 'content', 'index.mdx')
    writeFile(index, '<Paper id="a" />\n')
    expect((await siteReferences({ siteDir, audience: 'shared', providedDirs: {} })).missing.map(({ id }) => id)).toEqual(['a'])
    writeFile(index, '<Paper id="bb" />\n')
    expect((await siteReferences({ siteDir, audience: 'shared', providedDirs: {} })).missing.map(({ id }) => id)).toEqual(['bb'])
  })

  it('两个功能包登记同一个组件名时报错写明是哪两个', async () => {
    const siteDir = newSite('shared', [
      ['@test/papers', 'Paper', 'papers'],
      ['@test/other', 'Paper', 'other'],
    ])
    writeFile(path.join(siteDir, 'content', 'index.mdx'), '正文\n')
    await expect(siteReferences({ siteDir, audience: 'shared', providedDirs: {} })).rejects.toThrow(/引用组件 Paper 被 @test\/other 与 @test\/papers 都登记了/)
  })

  it('登记了组件却没有 ./node 出口时报错', async () => {
    const siteDir = newSite('shared', papersAndNotes)
    writeFile(path.join(siteDir, 'node_modules', '@test', 'papers', 'package.json'), JSON.stringify({ name: '@test/papers', version: '1.0.0', godDocsite: { references: { components: ['Paper'] } } }))
    writeFile(path.join(siteDir, 'content', 'index.mdx'), '正文\n')
    await expect(siteReferences({ siteDir, audience: 'shared', providedDirs: {} })).rejects.toThrow(/@test\/papers 在 godDocsite.references 里登记了组件，但 package.json 的 exports 里没有 \.\/node 出口/)
  })
})

describe('selfContainedProblemsOf', () => {
  it('shared 站：缺的条目带上功能包给的补法，扫不出的引用也列上；个人站不查', async () => {
    const siteDir = newSite('shared', papersAndNotes)
    writeFile(path.join(siteDir, 'content', 'guide', 'index.mdx'), '<Paper id="b" />\n\n<Note id={x} />\n')
    expect(await selfContainedProblemsOf(siteDir)).toEqual([
      { file: 'content/guide/index.mdx', message: '引用了 <Paper id="b">，本站没有这一条：papers.publish { id: "b" }' },
      { file: 'content/guide/index.mdx:3', message: '<Note> 的 id 要写成字符串（id="…"），写成了表达式' },
    ])
    writeFile(path.join(siteDir, 'docsite.json'), JSON.stringify({ kind: 'base', audience: 'personal', format: 2 }))
    expect(await selfContainedProblemsOf(siteDir)).toEqual([])
  })

  it('没有功能包登记引用组件的站总是通过', async () => {
    const siteDir = newSite('shared', [])
    writeFile(path.join(siteDir, 'content', 'index.mdx'), '<Paper id="b" />\n')
    expect(await selfContainedProblemsOf(siteDir)).toEqual([])
  })
})

describe('siteReferencesForRequests', () => {
  it('同时来的调用共用一次扫描，扫完之后的调用重新扫', async () => {
    const siteDir = newSite('shared', papersAndNotes)
    writeFile(path.join(siteDir, 'content', 'index.mdx'), '<Paper id="a" />\n')
    let placeCalls = 0
    const references = siteReferencesForRequests(() => {
      placeCalls++
      return { siteDir, audience: 'shared', providedDirs: {} }
    })
    const [first, second] = await Promise.all([references(), references()])
    expect(second).toBe(first)
    expect(placeCalls).toBe(1)
    await references()
    expect(placeCalls).toBe(2)
  })
})
