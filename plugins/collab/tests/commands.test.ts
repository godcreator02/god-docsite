import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CollabRejected } from '../src/errors.js'
import { requireMainBranch } from '../src/collab-repo/submit/submit.js'
import { repoOfArgs } from '../src/commands.js'

describe('命令参数', () => {
  const absolute = path.resolve('/projects/hybrid-mmc')

  it('收 { repo }，repo 是绝对路径', () => {
    expect(repoOfArgs({ repo: absolute })).toBe(absolute)
  })

  const rejected: Array<[string, unknown, RegExp]> = [
    ['没有参数', undefined, /参数要是 \{ repo \}/],
    ['数组', [absolute], /参数要是 \{ repo \}/],
    ['相对路径', { repo: 'hybrid-mmc' }, /绝对路径/],
    ['缺 repo', {}, /绝对路径/],
    ['认不出的参数', { repo: absolute, force: true }, /认不出的参数 force/],
  ]
  for (const [name, args, message] of rejected) {
    it(`拒绝：${name}`, () => {
      expect(() => repoOfArgs(args)).toThrow(CollabRejected)
      expect(() => repoOfArgs(args)).toThrow(message)
    })
  }
})

describe('分支', () => {
  it('提交审核只在 main 上做，别的分支和分离的 HEAD 都拒绝', () => {
    expect(() => requireMainBranch('main', '提交审核')).not.toThrow()
    expect(() => requireMainBranch('bob-test/改页面', '提交审核')).toThrow(/当前在分支 bob-test\/改页面 上；协作仓只用 main 一条分支，提交审核只在 main 上做/)
    expect(() => requireMainBranch('', '提交审核')).toThrow(/分离的 HEAD/)
  })
})
