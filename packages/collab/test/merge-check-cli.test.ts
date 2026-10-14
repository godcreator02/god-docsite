import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { runMergeCheckCli } from '../src/cli.js'
import { bobTaskId, commit, repo, write, writeTask } from './repo.js'

describe('命令行 collab-merge-check', () => {
  it('能合并时退出码 0', async () => {
    writeTask(bobTaskId, 'bob', '写跨时钟域测试')
    commit('bob 加任务')
    const result = await runMergeCheckCli(['--base', 'main', '--head', 'topic', '--author', 'bob', '--leads', 'alice'], repo)
    expect(result.exitCode).toBe(0)
  })

  it('不能合并时退出码 1，逐条列出问题', async () => {
    writeTask(bobTaskId, 'bob', '写跨时钟域测试')
    write('site/package.json', '{ "scripts": { "dev": "vite" }, "dependencies": { "react": "^19.3.0" } }\n')
    commit('改了 scripts')
    const result = await runMergeCheckCli(['--base', 'main', '--head', 'topic', '--author', 'bob', '--leads', 'alice'], repo)
    expect(result.exitCode).toBe(1)
    expect(result.output).toContain('site/package.json 的 scripts')
  })

  it('--author 在 --leads 里时，只有负责人能改的内容放行', async () => {
    write('site/package.json', '{ "scripts": { "dev": "vite" }, "dependencies": { "react": "^19.3.0" } }\n')
    commit('甲改了 scripts')
    const result = await runMergeCheckCli(['--base', 'main', '--head', 'topic', '--author', 'alice', '--leads', 'carol,alice'], repo)
    expect(result.exitCode).toBe(0)
  })

  it.each([
    [['--head', 'topic']],
    [['--base', 'main', '--head', 'topic', '--collab', 'docs/collab']],
    [['--base', 'main']],
    [['--base', 'main', '--head']],
    [['--base', 'main', '--head', 'topic', '--as', 'bob']],
    [['--base', 'main', '--head', 'topic', 'extra']],
    [['--base', 'main', '--head', 'topic', '--author', 'bob']],
    [['--base', 'main', '--head', 'topic', '--author', 'bob', '--leads', 'alice,']],
  ])('参数不对时退出码 2：%j', async (args) => {
    const result = await runMergeCheckCli(args, repo)
    expect(result.exitCode).toBe(2)
    expect(result.output).toContain('用法')
  })

  it('检查自己出错（不在 git 仓里运行）也是退出码 2，打印原话，和「不能合并」的退出码 1 分开', async () => {
    const notARepo = mkdtempSync(path.join(tmpdir(), 'collab-merge-not-a-repo-'))
    try {
      const result = await runMergeCheckCli(['--base', 'main', '--head', 'topic', '--author', 'bob', '--leads', 'alice'], notARepo)
      expect(result.exitCode).toBe(2)
      expect(result.output).toMatch(/合并检查自己出错了：git rev-parse --show-toplevel 失败[\s\S]*not a git repository/)
    } finally {
      rmSync(notARepo, { recursive: true, force: true })
    }
  })

  it('head 指向不存在的版本（merge-tree 退出码 1、没列冲突文件）：也算检查自己出错，退出码 2、带上 git 的原话，不列成「不能合并」', async () => {
    const result = await runMergeCheckCli(['--base', 'main', '--head', 'no-such-branch', '--author', 'bob', '--leads', 'alice'], repo)
    expect(result.exitCode).toBe(2)
    expect(result.output).toMatch(/合并检查自己出错了：git merge-tree main no-such-branch 失败：merge-tree: no-such-branch - not something we can merge/)
  })
})
