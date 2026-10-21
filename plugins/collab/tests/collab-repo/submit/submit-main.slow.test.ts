import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { recordFileOf } from '@godcreator/collab'
import { describe, expect, it } from 'vitest'
import { CollabRejected } from '../../../src/errors.js'
import { pullOfPushOutput, submitCollab } from '../../../src/collab-repo/submit/submit.js'
import { admin, bob, executor, forMain, git, merges, noWait, origin, passingSiteChecks, pullUrl, t1, t2, task, writeRecord } from './submit-fixture.js'

describe('collab.submit', () => {
  it('在 main 上提交，不建分支；只提交 collab/，推到 refs/for/main，等到执行器合并', async () => {
    writeRecord(bob.repo, task(t1, 'admin', 'done'))
    writeRecord(bob.repo, task(t2, 'bob'))
    writeFileSync(path.join(bob.repo, 'notes.txt'), '不是协作记录\n')
    git(bob.repo, 'add', 'notes.txt')

    const result = await submitCollab(bob, merges(), passingSiteChecks)
    expect(result).toMatchObject({ siteFiles: 0, siteTypecheck: null, pull: { number: 7, url: pullUrl } })
    expect(git(bob.repo, 'branch', '--show-current')).toBe('main')
    expect(git(bob.repo, 'branch', '--format=%(refname:short)')).toBe('main')
    expect(forMain()).toBe(result.commit)
    expect(git(bob.repo, 'show', '--name-only', '--format=', 'HEAD').split('\n')).toEqual([`collab/records/${t1}.json`, `collab/records/${t2}.json`])
    expect(git(bob.repo, 'status', '--porcelain')).toBe('A  notes.txt')
    expect(git(admin, 'merge-base', '--is-ancestor', result.commit!, 'main')).toBe('')
  })

  it('被执行器打回：本地 main 退回推送时的 origin/main，改动回到工作区，报出执行器的留言', async () => {
    writeRecord(bob.repo, task(t2, 'bob'))
    const before = git(bob.repo, 'rev-parse', 'HEAD')
    await expect(submitCollab(bob, executor('reject').repo, passingSiteChecks)).rejects.toThrow(/^没有合并：合并请求 #7 被关闭，改动退回工作区（没提交）。原因：\n没有合并（检查的是提交 abc）：\n改了只有负责人能改的内容/)
    expect(git(bob.repo, 'rev-parse', 'HEAD')).toBe(before)
    expect(git(bob.repo, 'status', '--porcelain')).toBe(`?? collab/records/${t2}.json`)
  })

  it('执行器到时限还没结论：插件关掉合并请求，改动回到工作区', async () => {
    writeRecord(bob.repo, task(t2, 'bob'))
    const silent = executor('silent')
    await expect(submitCollab(bob, silent.repo, passingSiteChecks, noWait)).rejects.toThrow(/执行器 0 秒内没有给结论，NAS 上的执行器可能没在运行：已关掉合并请求 #7/)
    expect(silent.closed).toEqual([7])
    expect(git(bob.repo, 'rev-list', '--count', 'origin/main..HEAD')).toBe('0')
    expect(git(bob.repo, 'status', '--porcelain')).toBe(`?? collab/records/${t2}.json`)
  })

  it('没有改动、也没有 main 里还没有的提交：拒绝', async () => {
    await expect(submitCollab(bob, merges(), passingSiteChecks)).rejects.toThrow(/没有要提交的/)
  })

  it('校验不过：不提交、不推送，原样列出问题', async () => {
    writeFileSync(path.join(bob.repo, 'collab', recordFileOf(t2)), JSON.stringify(task(t2, 'bob')))
    await expect(submitCollab(bob, merges(), passingSiteChecks)).rejects.toThrow(/collab\/ 校验不过，没有提交：\nrecords\/20260925110000-bbbbbbb\.json  不是规范写法/)
    expect(git(bob.repo, 'rev-list', '--count', 'HEAD')).toBe('1')
  })

  it('本地 main 落后 origin/main：先把 main 合进来再推，别人后来合进 main 的新记录、改动不算我删的、改的', async () => {
    writeRecord(admin, task(t1, 'admin', 'done'))
    writeRecord(admin, task('20260925120000-ccccccc', 'admin'))
    git(admin, 'add', '.')
    git(admin, 'commit', '-q', '-m', 'admin 做完 t1、新写一条')
    git(admin, 'push', '-q', 'origin', 'main')
    const mainBefore = git(admin, 'rev-parse', 'HEAD')

    writeRecord(bob.repo, task(t2, 'bob'))
    const result = await submitCollab(bob, merges(), passingSiteChecks)
    expect(git(origin, 'rev-list', '--parents', '-n', '1', 'refs/for/main').split(' ').slice(1)).toEqual([result.commit, mainBefore])
    // 推上去的最后一个是合并提交，标题照这次改了什么另给，不用合并提交的说明
    expect(readFileSync(path.join(origin, 'push-options'), 'utf8').trim().split('\n')).toEqual(['topic=bob', 'title=bob 的协作记录'])
  })

  it('落后 main 时删了分叉点上就有的记录：删记录不再拦，照样提交', async () => {
    git(admin, 'commit', '-q', '--allow-empty', '-m', 'main 往前走一步')
    git(admin, 'push', '-q', 'origin', 'main')
    rmSync(path.join(bob.repo, 'collab', recordFileOf(t1)))
    const result = await submitCollab(bob, merges(), passingSiteChecks)
    expect(git(bob.repo, 'show', '--name-status', '--format=', result.commit!)).toBe(`D\tcollab/records/${t1}.json`)
  })

  it('在别的分支上：拒绝', async () => {
    git(bob.repo, 'switch', '-q', '-c', 'bob/改页面')
    writeRecord(bob.repo, task(t2, 'bob'))
    await expect(submitCollab(bob, merges(), passingSiteChecks)).rejects.toThrow(CollabRejected)
    await expect(submitCollab(bob, merges(), passingSiteChecks)).rejects.toThrow(/当前在分支 bob\/改页面 上；协作仓只用 main 一条分支，提交审核只在 main 上做/)
  })

  it('从推送的输出里认出合并请求；认不出为 null', () => {
    expect(pullOfPushOutput(`remote: Visit the existing pull request:\nremote:   ${pullUrl}\nTo https://git.example.org/hybrid-mmc/collab.git`)).toEqual({ number: 7, url: pullUrl })
    expect(pullOfPushOutput('Everything up-to-date')).toBeNull()
  })
})
