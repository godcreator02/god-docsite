import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { encodeRecordFile, recordFileOf, type CollabRecord, type TaskRecord } from '@godcreator/collab-model/task-model'
import { beforeEach, describe, expect, it } from 'vitest'
import { CollabRejected } from '../../../src/errors.js'
import { openProject, type RemoteProject } from '../../../src/project/project.js'
import { collabProblems } from '../../../src/collab-repo/submit/submit-checks.js'

import type { GiteaRepo } from '../../../src/gitea-api/gitea.js'
import { pullOfPushOutput, submitCollab, type VerdictWait } from '../../../src/collab-repo/submit/submit.js'
import { autoSyncCollab } from '../../../src/collab-repo/sync/sync.js'
import type { InstallDependencies, SiteControl } from '../../../src/site-process/dependencies.js'

/** origin 是本机的裸仓，联网的 git 调用不需要认证 */
const gitea = { owner: 'hybrid-mmc', repo: 'collab', ownerUrl: 'https://git.example.org/hybrid-mmc' }
const bobCode = 'bobcode2345'
const openLocal = async (repo: string): Promise<RemoteProject> => ({ ...(await openProject(repo, bobCode)), remote: { env: {} }, gitea })

/**
 * 每个测试一套：origin 是本地裸仓（开着推送选项，才收得下 `-o topic=`），admin 与 bob 各克隆一份。
 * 推到裸仓的 refs/for/main 只是一个普通的引用；裸仓的 post-receive 钩子像 Gitea 那样回一行合并请求的地址，
 * 执行器的结论由假的 Gitea 接口给
 */
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

const pullUrl = 'https://git.example.org/hybrid-mmc/collab/pulls/7'

/**
 * 假的执行器：merge 时把 refs/for/main 按「合并提交」方式合进 main；reject 时打回，留言写原因；silent 一直不给结论。
 * projectLeads 是协作仓的协作者，推送前本机检查「只有负责人能改的内容」时读它
 */
function executor(outcome: 'merge' | 'reject' | 'silent', projectLeads: string[] = ['admin']) {
  const closed: number[] = []
  const unused = (what: string) => async (): Promise<never> => {
    throw new Error(`提交审核不${what}`)
  }
  const repo: GiteaRepo = {
    hasMain: unused('读 main 分支'),
    callerIsAdmin: unused('读仓的权限'),
    collaborators: async () => projectLeads,
    addAdminCollaborator: unused('加协作者'),
    removeCollaborator: unused('删协作者'),
    mainProtection: unused('读分支保护'),
    openPulls: async () => [],
    pullReviews: unused('读审阅'),
    openIssues: unused('列 issue'),
    issue: unused('读 issue'),
    lastCommenter: unused('读 issue 的评论'),
    pullState: async () => {
      if (outcome === 'silent') return { open: true, merged: false }
      if (outcome === 'merge') {
        git(admin, 'pull', '-q', '--ff-only')
        git(admin, 'fetch', '-q', 'origin', 'refs/for/main')
        git(admin, 'merge', '-q', '--no-ff', '--no-edit', 'FETCH_HEAD')
        git(admin, 'push', '-q', 'origin', 'main')
      }
      return { open: false, merged: outcome === 'merge' }
    },
    lastComment: async () => '没有合并（检查的是提交 abc）：\n改了只有负责人能改的内容：site/package.json 的 scripts；这类改动交给负责人（协作仓的协作者）提交',
    close: async (number) => {
      closed.push(number)
    },
  }
  return { repo, closed }
}

const noWait: VerdictWait = { timeoutMilliseconds: 0, pollMilliseconds: 0 }
const merges = () => executor('merge').repo

type PersonEntry = { id: string; name: string; codes?: string[]; gitea: string }
const peopleEntries: PersonEntry[] = [
  { id: 'admin', name: '管理员', codes: ['admincode234'], gitea: 'admin' },
  { id: 'bob', name: '成员', codes: [bobCode], gitea: 'bob' },
  { id: 'carol', name: '成员', gitea: 'carol' },
]
/** 和 gwb-docsite 写回人员列表时一样：一项一行 */
const peopleText = (entries: PersonEntry[]) => `[\n${entries.map((entry) => `  ${JSON.stringify(entry)}`).join(',\n')}\n]\n`

const task = (id: string, author: string, status: TaskRecord['status'] = 'todo'): TaskRecord => ({ id, type: 'task', author, status, title: `${author} 的任务` })
const t1 = '20260925100000-aaaaaaa'
const t2 = '20260925110000-bbbbbbb'

function writeRecord(repo: string, record: CollabRecord) {
  const file = path.join(repo, 'collab', recordFileOf(record.id))
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, encodeRecordFile(record))
}

function writeSite(repo: string, files: Record<string, string>) {
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(repo, 'site', relative)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, content)
  }
}

/** 站点 comments/ 里一串评论的发起文件 */
const threadFile = (author: string) => `---\nauthor: ${author}\ncreatedAt: 2026-10-10T09:00:00.000Z\nstatus: open\n---\n\n${author} 的评论\n`

/**
 * 站点检查用站点自己装的基础包编译 MDX：site/node_modules 链到插件装的基础包在 pnpm 仓库里的那一层（基础包和它的依赖都在那一层），
 * 和真的协作仓一样不进 git
 */
function installKitInto(repo: string) {
  const installedKit = realpathSync(path.resolve(import.meta.dirname, '../../../node_modules/@godcreator/docsite-kit'))
  mkdirSync(path.join(repo, 'site'), { recursive: true })
  symlinkSync(path.resolve(installedKit, '../..'), path.join(repo, 'site', 'node_modules'), 'junction')
  appendFileSync(path.join(repo, '.git', 'info', 'exclude'), 'node_modules/\n')
}

function cloneAs(root: string, origin: string, person: string): string {
  const repo = path.join(root, person)
  git(root, 'clone', '-q', origin, repo)
  git(repo, 'config', 'user.name', person)
  git(repo, 'config', 'user.email', `${person}@local`)
  git(repo, 'config', 'core.autocrlf', 'false')
  installKitInto(repo)
  return repo
}

let origin: string
let admin: string
let bob: RemoteProject

beforeEach(async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'gwb-collab-'))
  origin = path.join(root, 'origin.git')
  git(root, 'init', '-q', '--bare', '-b', 'main', origin)
  git(origin, 'config', 'receive.advertisePushOptions', 'true')
  writeFileSync(
    path.join(origin, 'hooks', 'post-receive'),
    `#!/bin/sh\n[ "\${GIT_PUSH_OPTION_COUNT:-0}" != 0 ] && printf '%s\\n' "$GIT_PUSH_OPTION_0" "$GIT_PUSH_OPTION_1" > push-options\necho "Visit the existing pull request:"\necho "  ${pullUrl}"\n`,
    { mode: 0o755 },
  )
  admin = cloneAs(root, origin, 'admin')
  writeSite(admin, { 'people.json': peopleText(peopleEntries), 'package.json': '{ "dependencies": {} }\n' })
  writeRecord(admin, task(t1, 'admin'))
  git(admin, 'add', '.')
  git(admin, 'commit', '-q', '-m', '起点')
  git(admin, 'push', '-q', 'origin', 'main')
  bob = await openLocal(cloneAs(root, origin, 'bob'))
})

const forMain = () => git(origin, 'rev-parse', 'refs/for/main')

describe('提交前校验', () => {
  it('刚克隆、没有改动：没有问题', async () => {
    expect(await collabProblems(bob)).toEqual([])
  })

  it('只报这次改动带来的格式问题；替别人写记录、改别人的记录不算问题', async () => {
    writeRecord(bob.repo, task(t1, 'admin', 'done'))
    writeFileSync(path.join(bob.repo, 'collab', recordFileOf(t2)), JSON.stringify(task(t2, 'admin')))
    const problems = await collabProblems(bob)
    expect(problems.map((problem) => problem.file)).toEqual([`records/${t2}.json`])
    expect(problems[0]?.message).toMatch(/^不是规范写法/)
  })

  it('分出来的那个提交上就有的问题不算：同步进来的 main 上的问题不是我的', async () => {
    writeFileSync(path.join(admin, 'collab', 'stray.txt'), '多出来的文件\n')
    git(admin, 'add', '.')
    git(admin, 'commit', '-q', '-m', 'main 上多了一个文件')
    git(admin, 'push', '-q', 'origin', 'main')
    git(bob.repo, 'pull', '-q', '--ff-only')
    expect(await collabProblems(bob)).toEqual([])
  })
})

describe('collab.submit', () => {
  it('在 main 上提交，不建分支；只提交 collab/，推到 refs/for/main，等到执行器合并', async () => {
    writeRecord(bob.repo, task(t1, 'admin', 'done'))
    writeRecord(bob.repo, task(t2, 'bob'))
    writeFileSync(path.join(bob.repo, 'notes.txt'), '不是协作记录\n')
    git(bob.repo, 'add', 'notes.txt')

    const result = await submitCollab(bob, merges())
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
    await expect(submitCollab(bob, executor('reject').repo)).rejects.toThrow(/^没有合并：合并请求 #7 被关闭，改动退回工作区（没提交）。原因：\n没有合并（检查的是提交 abc）：\n改了只有负责人能改的内容/)
    expect(git(bob.repo, 'rev-parse', 'HEAD')).toBe(before)
    expect(git(bob.repo, 'status', '--porcelain')).toBe(`?? collab/records/${t2}.json`)
  })

  it('执行器到时限还没结论：插件关掉合并请求，改动回到工作区', async () => {
    writeRecord(bob.repo, task(t2, 'bob'))
    const silent = executor('silent')
    await expect(submitCollab(bob, silent.repo, undefined, noWait)).rejects.toThrow(/执行器 0 秒内没有给结论，NAS 上的执行器可能没在运行：已关掉合并请求 #7/)
    expect(silent.closed).toEqual([7])
    expect(git(bob.repo, 'rev-list', '--count', 'origin/main..HEAD')).toBe('0')
    expect(git(bob.repo, 'status', '--porcelain')).toBe(`?? collab/records/${t2}.json`)
  })

  it('没有改动、也没有 main 里还没有的提交：拒绝', async () => {
    await expect(submitCollab(bob, merges())).rejects.toThrow(/没有要提交的/)
  })

  it('校验不过：不提交、不推送，原样列出问题', async () => {
    writeFileSync(path.join(bob.repo, 'collab', recordFileOf(t2)), JSON.stringify(task(t2, 'bob')))
    await expect(submitCollab(bob, merges())).rejects.toThrow(/collab\/ 校验不过，没有提交：\nrecords\/20260925110000-bbbbbbb\.json  不是规范写法/)
    expect(git(bob.repo, 'rev-list', '--count', 'HEAD')).toBe('1')
  })

  it('main 上原本就有的格式问题不挡提交', async () => {
    writeFileSync(path.join(admin, 'collab', 'stray.txt'), '多出来的文件\n')
    git(admin, 'add', '.')
    git(admin, 'commit', '-q', '-m', 'main 上多了一个文件')
    git(admin, 'push', '-q', 'origin', 'main')
    git(bob.repo, 'pull', '-q', '--ff-only')
    writeRecord(bob.repo, task(t2, 'bob'))
    expect(await submitCollab(bob, merges())).toMatchObject({ pull: { number: 7 } })
  })

  it('本地 main 落后 origin/main：先把 main 合进来再推，别人后来合进 main 的新记录、改动不算我删的、改的', async () => {
    writeRecord(admin, task(t1, 'admin', 'done'))
    writeRecord(admin, task('20260925120000-ccccccc', 'admin'))
    git(admin, 'add', '.')
    git(admin, 'commit', '-q', '-m', 'admin 做完 t1、新写一条')
    git(admin, 'push', '-q', 'origin', 'main')
    const mainBefore = git(admin, 'rev-parse', 'HEAD')

    writeRecord(bob.repo, task(t2, 'bob'))
    const result = await submitCollab(bob, merges())
    expect(git(origin, 'rev-list', '--parents', '-n', '1', 'refs/for/main').split(' ').slice(1)).toEqual([result.commit, mainBefore])
    // 推上去的最后一个是合并提交，标题照这次改了什么另给，不用合并提交的说明
    expect(readFileSync(path.join(origin, 'push-options'), 'utf8').trim().split('\n')).toEqual(['topic=bob', 'title=bob 的协作记录'])
  })

  it('落后 main 时删了分叉点上就有的记录：删记录不再拦，照样提交', async () => {
    git(admin, 'commit', '-q', '--allow-empty', '-m', 'main 往前走一步')
    git(admin, 'push', '-q', 'origin', 'main')
    rmSync(path.join(bob.repo, 'collab', recordFileOf(t1)))
    const result = await submitCollab(bob, merges())
    expect(git(bob.repo, 'show', '--name-status', '--format=', result.commit!)).toBe(`D\tcollab/records/${t1}.json`)
  })

  it('在别的分支上：拒绝', async () => {
    git(bob.repo, 'switch', '-q', '-c', 'bob/改页面')
    writeRecord(bob.repo, task(t2, 'bob'))
    await expect(submitCollab(bob, merges())).rejects.toThrow(CollabRejected)
    await expect(submitCollab(bob, merges())).rejects.toThrow(/当前在分支 bob\/改页面 上；协作仓只用 main 一条分支，提交审核只在 main 上做/)
  })

  it('从推送的输出里认出合并请求；认不出为 null', () => {
    expect(pullOfPushOutput(`remote: Visit the existing pull request:\nremote:   ${pullUrl}\nTo https://git.example.org/hybrid-mmc/collab.git`)).toEqual({ number: 7, url: pullUrl })
    expect(pullOfPushOutput('Everything up-to-date')).toBeNull()
  })
})

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

  it('只改页面：提交说明写页面改动；站点没写类型检查脚本时照样提交', async () => {
    writeSite(bob.repo, page)
    const result = await submitCollab(bob, merges(), fakeTypecheck('no-script').typecheck)
    expect(result).toMatchObject({ siteFiles: 2, siteTypecheck: 'no-script' })
    expect(git(bob.repo, 'log', '-1', '--format=%s')).toBe('bob 的页面改动')
  })

  it('成员把自己这台电脑的身份码加进 site/people.json 里自己那一项：放行', async () => {
    writeSite(bob.repo, { 'people.json': peopleText(peopleEntries.map((entry) => (entry.id === 'bob' ? { ...entry, codes: [bobCode, 'laptopcode99'] } : entry))) })
    expect(await submitCollab(bob, merges(), fakeTypecheck('passed').typecheck)).toMatchObject({ siteFiles: 1, pull: { number: 7 } })
  })

  it('成员改了别人那一项：本机就拦下，不推送，改动留在工作区', async () => {
    writeSite(bob.repo, { 'people.json': peopleText(peopleEntries.map((entry) => (entry.id === 'carol' ? { ...entry, codes: ['carolcode234'] } : entry))) })
    await expect(submitCollab(bob, merges(), fakeTypecheck('passed').typecheck)).rejects.toThrow(/^没有推送，改动留在工作区（没提交）：改了只有负责人能改的内容：site\/people\.json/)
    expect(() => git(origin, 'rev-parse', '--verify', '-q', 'refs/for/main')).toThrow()
  })

  it('成员加一个库：依赖与锁文件一起提交，放行', async () => {
    writeSite(bob.repo, { ...page, 'package.json': '{ "dependencies": { "three": "^0.186.0" } }\n', 'pnpm-lock.yaml': "lockfileVersion: '9.0'\n" })
    const result = await submitCollab(bob, merges(), fakeTypecheck('passed').typecheck)
    expect(result).toMatchObject({ siteFiles: 4, pull: { number: 7 } })
  })

  it('成员改了 scripts：本机就拦下，不推送，改动留在工作区', async () => {
    writeSite(bob.repo, { 'package.json': '{ "scripts": { "dev": "vite" }, "dependencies": {} }\n' })
    await expect(submitCollab(bob, merges(), fakeTypecheck('passed').typecheck)).rejects.toThrow(
      '没有推送，改动留在工作区（没提交）：改了只有负责人能改的内容：site/package.json 的 scripts；这类改动交给负责人（协作仓的协作者）提交',
    )
    expect(() => git(origin, 'rev-parse', '--verify', '-q', 'refs/for/main')).toThrow()
    expect(git(bob.repo, 'rev-list', '--count', 'origin/main..HEAD')).toBe('0')
    // git() 去掉了首尾空白，「 M」行首的空格不在了
    expect(git(bob.repo, 'status', '--porcelain')).toBe('M site/package.json')
  })

  it('负责人看 Gitea 上协作仓的协作者，不看 people.json：bob 是协作者时改 scripts 照样推送', async () => {
    writeSite(bob.repo, { 'package.json': '{ "scripts": { "dev": "vite" }, "dependencies": {} }\n' })
    const result = await submitCollab(bob, executor('merge', ['admin', 'bob']).repo, fakeTypecheck('passed').typecheck)
    expect(result).toMatchObject({ siteFiles: 1, pull: { number: 7 } })
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

  it('只改记录：不跑类型检查', async () => {
    writeRecord(bob.repo, task(t2, 'bob'))
    const { typecheck, ran } = fakeTypecheck('passed')
    expect(await submitCollab(bob, merges(), typecheck)).toMatchObject({ siteFiles: 0, siteTypecheck: null })
    expect(ran).toEqual([])
  })

  it('站点检查不过（评论作者不在人员列表里、日志页的文件名不对）：不提交、不推送、不跑类型检查，逐条写明', async () => {
    writeSite(bob.repo, { 'comments/2026-10-10-dave/index.mdx': threadFile('dave'), 'journal/2026-02-30.mdx': '# 不存在的一天\n' })
    const { typecheck, ran } = fakeTypecheck('passed')
    await expect(submitCollab(bob, merges(), typecheck)).rejects.toThrow(
      'site/ 的站点检查不过，没有提交：\nsite/  2026-10-10-dave/index.mdx 的 author dave 不在 people.json 里\nsite/  journal/2026-02-30.mdx：2026-02-30 不是真实存在的日期',
    )
    expect(ran).toEqual([])
    expect(git(bob.repo, 'rev-list', '--count', 'HEAD')).toBe('1')
  })

  it('类型检查没通过：不提交，报出检查的原话', async () => {
    writeSite(bob.repo, page)
    await expect(submitCollab(bob, merges(), fakeTypecheck(new CollabRejected('在 site 里运行 pnpm run typecheck 失败（退出码 2）：\nNote.tsx(1,1): error TS2322')).typecheck)).rejects.toThrow(
      /pnpm run typecheck 失败/,
    )
    expect(git(bob.repo, 'rev-list', '--count', 'HEAD')).toBe('1')
  })
})

describe('提交审核与自动同步配合', () => {
  function adminPushes(record: CollabRecord, message: string) {
    git(admin, 'pull', '-q', '--ff-only')
    writeRecord(admin, record)
    git(admin, 'add', '.')
    git(admin, 'commit', '-q', '-m', message)
    git(admin, 'push', '-q', 'origin', 'main')
  }

  const notRunning: SiteControl = { whileStopped: async (_project, work) => ({ result: await work(false), relaunched: false }), recheck: async () => {} }
  const noInstall: InstallDependencies = async () => {
    throw new Error('不该装依赖')
  }

  /** 和检查一样：先取回，再自动同步 */
  async function checkSyncs() {
    git(bob.repo, 'fetch', '-q', 'origin')
    return autoSyncCollab(bob, notRunning, noInstall)
  }

  it('提交审核时同一条的同一个字段两边改得不一样：不推送，列出冲突的文件，自动同步不动；改好之后再提交审核完成这次合并', async () => {
    const t3 = (status: TaskRecord['status']): TaskRecord => ({ id: '20260925130000-ddddddd', type: 'task', author: 'admin', status, title: '核算纹波' })
    adminPushes(t3('todo'), '任务 t3')
    expect((await checkSyncs()).outcome).toBe('merged')
    writeRecord(bob.repo, t3('done'))
    adminPushes(t3('doing'), 't3 进行中')

    await expect(submitCollab(bob, merges())).rejects.toThrow(/有冲突，没有推送；冲突标记留在这些文件里[^\n]*\ncollab\/records\/20260925130000-ddddddd\.json\n/)
    expect(readFileSync(path.join(bob.repo, 'collab', recordFileOf(t3('done').id)), 'utf8')).toMatch(/^<<<<<<< /m)
    expect(() => git(origin, 'rev-parse', '--verify', '-q', 'refs/for/main')).toThrow()
    expect(await checkSyncs()).toEqual({ outcome: 'skipped', reason: '提交审核时把 main 合进来出了冲突，还没改好：让 AI 改好冲突、再提交审核' })

    writeRecord(bob.repo, t3('done'))
    const result = await submitCollab(bob, merges())
    expect(git(bob.repo, 'rev-list', '--parents', '-n', '1', 'HEAD').split(' ')).toHaveLength(3)
    expect(forMain()).toBe(result.commit)
  })
})
