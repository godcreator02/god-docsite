import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mdxProblemsIn } from '../src/server/mdx-problems.js'

let siteDir: string

beforeEach(async () => {
  siteDir = await mkdtemp(path.join(tmpdir(), 'mdx-problems-'))
})

afterEach(async () => {
  await rm(siteDir, { recursive: true, force: true })
})

async function writeSiteFile(relative: string, text: string) {
  const file = path.join(siteDir, relative)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, text)
}

describe('提交前编译站点里的 MDX', () => {
  it('frontmatter、公式、组件都编得过：没有问题', async () => {
    await writeSiteFile('content/a.mdx', '---\ntitle: 有 {花括号} 的标题\n---\n\n功率 $P = \\frac{V^2}{R}$\n\n<Callout>提示</Callout>\n')
    await writeSiteFile('content/notes.md', '# 纯 Markdown {不是表达式}\n')
    expect(await mdxProblemsIn(siteDir, ['content', 'comments'])).toEqual([])
  })

  it('MDX 语法错、公式写错：每个文件一句，行号和文件里的对得上', async () => {
    await writeSiteFile('content/broken.mdx', '---\ntitle: 坏的\n---\n\n<Callout>没有关上\n')
    await writeSiteFile('comments/t1/index.mdx', '公式 $\\frac{a}{$\n')
    const problems = await mdxProblemsIn(siteDir, ['content', 'comments'])
    expect(problems).toHaveLength(2)
    expect(problems[0]).toMatch(/^content\/broken\.mdx 第 5 行/)
    expect(problems[1]).toMatch(/^comments\/t1\/index\.mdx 第 1 行第 \d+ 列：公式排不出来：KaTeX parse error/)
  })
})
