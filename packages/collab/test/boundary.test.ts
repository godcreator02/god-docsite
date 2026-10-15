import { describe, expect, it } from 'vitest'
import { importsOf, reachableFrom, sources } from './source-imports.js'

describe('协作包的边界（分层规则由仓根 pnpm test:deps 管，这里只守两条使用方看得见的）', () => {
  it('Gitea 执行器只装这个包跑 collab-merge-check：命令行走到的文件不碰 react、react-router、fumadocs，也不碰站点层', () => {
    const reached = [...reachableFrom('cli/bin.ts')]
    expect(reached.filter((name) => name.startsWith('site/'))).toEqual([])
    const outside = reached.flatMap((name) => importsOf(name).filter((spec) => !spec.startsWith('.') && !spec.startsWith('node:')).map((spec) => `${name} → ${spec}`))
    expect(outside.filter((line) => /→ (react|react-dom|react-router|@fumadocs\/|fumadocs-)/.test(line))).toEqual([])
  })

  it('浏览器侧的 ./site 入口（布局数据 collabLayoutData 也在里面）走不到 node/ 与 .server 文件', () => {
    const reached = [...reachableFrom('site/index.ts')]
    expect(reached.filter((name) => name.startsWith('node/') || /\.server\.tsx?$/.test(name))).toEqual([])
    expect(reached.flatMap((name) => importsOf(name).filter((spec) => spec.startsWith('node:') || spec.endsWith('/node')).map((spec) => `${name} → ${spec}`))).toEqual([])
  })

  it('构建期的 ./mdx 入口不碰 react 与站点层：source.config.ts 经站点的 mdx.ts 加载它', () => {
    const reached = [...reachableFrom('mdx/index.ts')]
    expect(reached.filter((name) => name.startsWith('site/') || name.startsWith('node/'))).toEqual([])
    const outside = reached.flatMap((name) => importsOf(name).filter((spec) => !spec.startsWith('.')).map((spec) => `${name} → ${spec}`))
    expect(outside.filter((line) => /→ (react|react-dom|react-router|lucide-react|@fumadocs\/|fumadocs-)/.test(line))).toEqual([])
  })

  it('站点层不认识站点：不 import docsite-* 旧包、不用 @site 别名、不 import 推送通道包', () => {
    const offending = sources
      .filter((name) => name.startsWith('site/'))
      .flatMap((name) => importsOf(name).filter((spec) => spec.startsWith('@site/') || spec.startsWith('@godcreator/docsite-') || spec.startsWith('@godcreator/god-docsite')).map((spec) => `${name} → ${spec}`))
    expect(offending).toEqual([])
  })
})
