import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const srcDir = path.resolve(import.meta.dirname, '../src')
/** src 下全部源文件，相对 src、用 / 分隔 */
const sources = readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
  .map((name) => name.split(path.sep).join('/'))
  .filter((name) => /\.tsx?$/.test(name))
const importsOf = (name: string) => [...readFileSync(path.join(srcDir, name), 'utf8').matchAll(/from '([^']+)'/g)].map((match) => match[1]!)
/** 一个文件经相对 import 能走到的全部本包文件（含自己） */
function reachableFrom(name: string, seen = new Set<string>()): Set<string> {
  if (seen.has(name)) return seen
  seen.add(name)
  for (const spec of importsOf(name).filter((each) => each.startsWith('.'))) {
    const target = path.posix.join(path.posix.dirname(name), spec).replace(/\.js$/, '')
    reachableFrom(sources.find((file) => file.replace(/\.tsx?$/, '') === target)!, seen)
  }
  return seen
}

describe('协作包的边界（分层规则由仓根 pnpm depcheck 管，这里只守两条使用方看得见的）', () => {
  it('Gitea 执行器只装这个包跑 collab-merge-check：命令行走到的文件不碰 react、react-router、fumadocs，也不碰站点层', () => {
    const reached = [...reachableFrom('cli/bin.ts')]
    expect(reached.filter((name) => name.startsWith('site/'))).toEqual([])
    const outside = reached.flatMap((name) => importsOf(name).filter((spec) => !spec.startsWith('.') && !spec.startsWith('node:')).map((spec) => `${name} → ${spec}`))
    expect(outside.filter((line) => /→ (react|react-dom|react-router|@fumadocs\/|fumadocs-)/.test(line))).toEqual([])
  })

  it('站点层不认识站点：不 import docsite-* 旧包、不用 @site 别名、不 import 推送通道包', () => {
    const offending = sources
      .filter((name) => name.startsWith('site/'))
      .flatMap((name) => importsOf(name).filter((spec) => spec.startsWith('@site/') || spec.startsWith('@godcreator/docsite-') || spec.startsWith('@godcreator/god-docsite')).map((spec) => `${name} → ${spec}`))
    expect(offending).toEqual([])
  })
})
