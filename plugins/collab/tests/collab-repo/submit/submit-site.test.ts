import { rmSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CollabRejected } from '../../../src/errors.js'
import { submitCollab } from '../../../src/collab-repo/submit/submit.js'
import { admin, bob, bobCode, executor, forMain, git, merges, origin, peopleEntries, peopleText, t2, task, threadFile, writeRecord, writeSite } from './submit-fixture.js'

/*
 * 只有负责人能改的内容，规则本体（哪些字段算、怎么核对）在合并检查包 lead-only 的测试里；
 * 这里只验它接进了提交路径：拦下的不推送、改动留在工作区，负责人的放行。六种场景一个用例跑完
 * （拦下的不落盘可以连着来；放行的提交完工作区就干净了，互不干扰），省五次夹具。
 */

describe('collab.submit 带上 site/ 的改动', () => {
  /** 假的类型检查：记下在哪个目录跑过，回给定的结论或抛出给定的错 */
  function fakeTypecheck(outcome: 'passed' | 'no-script' | Error) {
    const ran: string[] = []
    const typecheck = async (siteDir: string) => {
      ran.push(siteDir)
      if (outcome instanceof Error) throw outcome
      return outcome
    }
    return { typecheck, ran }
  }

  const page = {
    'content/meta.json': `${JSON.stringify({ title: '站', pages: ['notes'] })}\n`,
    'content/notes.mdx': '---\ntitle: 笔记\n---\n\n正文\n',
  }

  it('记录和页面一起提交，进同一个提交、同一个主题；提交前跑过站点的类型检查', async () => {
    writeRecord(bob.repo, task(t2, 'bob'))
    writeSite(bob.repo, page)
    const { typecheck, ran } = fakeTypecheck('passed')
    const result = await submitCollab(bob, merges(), typecheck)
    expect(result).toMatchObject({ siteFiles: 2, siteTypecheck: 'passed' })
    expect(ran).toEqual([bob.siteDir])
    expect(forMain()).toBe(result.commit)
    expect(git(bob.repo, 'log', '-1', '--format=%s')).toBe('bob 的协作记录与页面改动')
    expect(git(bob.repo, 'show', '--name-only', '--format=', 'HEAD').split('\n')).toEqual([`collab/records/${t2}.json`, 'site/content/meta.json', 'site/content/notes.mdx'])
  })

  it('只有负责人能改的内容接进了提交路径：成员拦下、不推送、改动留在工作区；负责人与例外放行；只改记录不跑类型检查', { timeout: 180_000 }, async () => {
    // 拦下的（不落盘，连着来）
    writeSite(bob.repo, { 'people.json': peopleText(peopleEntries.map((entry) => (entry.id === 'carol' ? { ...entry, codes: ['carolcode234'] } : entry))) })
    await expect(submitCollab(bob, merges(), fakeTypecheck('passed').typecheck)).rejects.toThrow(/^没有推送，改动留在工作区（没提交）：改了只有负责人能改的内容：site\/people\.json/)
    git(bob.repo, 'checkout', '-q', '--', 'site/people.json')
    writeSite(bob.repo, { 'package.json': '{ "scripts": { "dev": "vite" }, "dependencies": {} }\n' })
    await expect(submitCollab(bob, merges(), fakeTypecheck('passed').typecheck)).rejects.toThrow(
      '没有推送，改动留在工作区（没提交）：改了只有负责人能改的内容：site/package.json 的 scripts；这类改动交给负责人（协作仓的协作者）提交',
    )
    expect(() => git(origin, 'rev-parse', '--verify', '-q', 'refs/for/main')).toThrow()
    expect(git(bob.repo, 'rev-list', '--count', 'origin/main..HEAD')).toBe('0')
    git(bob.repo, 'checkout', '-q', '--', 'site/package.json')

    // 放行的（写盘提交，依次做）
    writeSite(bob.repo, { 'people.json': peopleText(peopleEntries.map((entry) => (entry.id === 'bob' ? { ...entry, codes: [bobCode, 'laptopcode99'] } : entry))) })
    expect(await submitCollab(bob, merges(), fakeTypecheck('passed').typecheck)).toMatchObject({ siteFiles: 1, pull: { number: 7 } })
    writeSite(bob.repo, { ...page, 'package.json': '{ "dependencies": { "three": "^0.186.0" } }\n', 'pnpm-lock.yaml': "lockfileVersion: '9.0'\n" })
    expect(await submitCollab(bob, merges(), fakeTypecheck('passed').typecheck)).toMatchObject({ siteFiles: 4, pull: { number: 7 } })
    writeSite(bob.repo, { 'package.json': '{ "scripts": { "dev": "vite" }, "dependencies": {} }\n' })
    expect(await submitCollab(bob, executor('merge', ['admin', 'bob']).repo, fakeTypecheck('passed').typecheck)).toMatchObject({ siteFiles: 1, pull: { number: 7 } })

    // 只改记录：不跑类型检查
    writeRecord(bob.repo, task(t2, 'bob'))
    const { typecheck, ran } = fakeTypecheck('passed')
    expect(await submitCollab(bob, merges(), typecheck)).toMatchObject({ siteFiles: 0, siteTypecheck: null })
    expect(ran).toEqual([])
  })

  it('别人在 main 上把 carol 移出了人员列表，我同时转来 carol 写的评论：合 main 之后站点有新问题，不推送，改动留在工作区', async () => {
    writeSite(admin, { 'people.json': peopleText(peopleEntries.filter((entry) => entry.id !== 'carol')) })
    git(admin, 'add', '.')
    git(admin, 'commit', '-q', '-m', 'admin 移出 carol')
    git(admin, 'push', '-q', 'origin', 'main')
    writeSite(bob.repo, { 'comments/2026-10-10-carol/index.mdx': threadFile('carol') })
    await expect(submitCollab(bob, merges(), fakeTypecheck('passed').typecheck)).rejects.toThrow(
      '把 main 合进来之后有新问题，没有推送，改动留在工作区（没提交）：\nsite/  2026-10-10-carol/index.mdx 的 author carol 不在 people.json 里',
    )
    expect(() => git(origin, 'rev-parse', '--verify', '-q', 'refs/for/main')).toThrow()
    expect(git(bob.repo, 'rev-list', '--count', 'origin/main..HEAD')).toBe('0')
    expect(git(bob.repo, 'status', '--porcelain')).toBe('?? site/comments/')
  })

  it('站点检查与类型检查不过：不提交、不推送，逐条写明', async () => {
    writeSite(bob.repo, { 'comments/2026-10-10-dave/index.mdx': threadFile('dave'), 'journal/2026-02-30.mdx': '# 不存在的一天\n' })
    const { typecheck, ran } = fakeTypecheck('passed')
    await expect(submitCollab(bob, merges(), typecheck)).rejects.toThrow(
      'site/ 的站点检查不过，没有提交：\nsite/  2026-10-10-dave/index.mdx 的 author dave 不在 people.json 里\nsite/  journal/2026-02-30.mdx：2026-02-30 不是真实存在的日期',
    )
    expect(ran).toEqual([])
    expect(git(bob.repo, 'rev-list', '--count', 'HEAD')).toBe('1')
    rmSync(path.join(bob.repo, 'site', 'comments', '2026-10-10-dave'), { recursive: true, force: true })
    rmSync(path.join(bob.repo, 'site', 'journal', '2026-02-30.mdx'))

    writeSite(bob.repo, page)
    await expect(submitCollab(bob, merges(), fakeTypecheck(new CollabRejected('在 site 里运行 pnpm run typecheck 失败（退出码 2）：\nNote.tsx(1,1): error TS2322')).typecheck)).rejects.toThrow(
      /pnpm run typecheck 失败/,
    )
    expect(git(bob.repo, 'rev-list', '--count', 'HEAD')).toBe('1')
  })
})
