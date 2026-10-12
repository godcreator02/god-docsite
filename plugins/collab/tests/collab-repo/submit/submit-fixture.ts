import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { encodeRecordFile, recordFileOf, type CollabRecord, type TaskRecord } from '@godcreator/collab-model/task-model'
import { beforeEach } from 'vitest'
import { openProject, type RemoteProject } from '../../../src/project/project.js'

import type { GiteaRepo } from '../../../src/gitea-api/gitea.js'
import type { VerdictWait } from '../../../src/collab-repo/submit/submit.js'

/*
 * 提交审核四个测试文件共用的夹具：origin 是本机的裸仓（开着推送选项，才收得下 `-o topic=`），
 * admin 与 bob 各克隆一份。推到裸仓的 refs/for/main 只是一个普通的引用；裸仓的 post-receive 钩子
 * 像 Gitea 那样回一行合并请求的地址，执行器的结论由假的 Gitea 接口给。
 *
 * 裸仓的起点（含钩子与 admin 的起点提交）只在每个测试进程里现建一次（模板），每个用例本地 clone
 * 模板（硬链接共享对象，毫秒级）再写钩子、开推送选项——钩子与本地配置不随 clone 走，要每用例重来；
 * 克隆时的三样配置经 clone -c 一次带上。每用例从 13 次 git 降到 4 次。
 */

/** origin 是本机的裸仓，联网的 git 调用不需要认证 */
const gitea = { owner: 'hybrid-mmc', repo: 'collab', ownerUrl: 'https://git.example.org/hybrid-mmc' }
export const bobCode = 'bobcode2345'
const openLocal = async (repo: string): Promise<RemoteProject> => ({ ...(await openProject(repo, bobCode)), remote: { env: {} }, gitea })

export const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

export const pullUrl = 'https://git.example.org/hybrid-mmc/collab/pulls/7'

export type PersonEntry = { id: string; name: string; codes?: string[]; gitea: string }
export const peopleEntries: PersonEntry[] = [
  { id: 'admin', name: '管理员', codes: ['admincode234'], gitea: 'admin' },
  { id: 'bob', name: '成员', codes: [bobCode], gitea: 'bob' },
  { id: 'carol', name: '成员', gitea: 'carol' },
]
/** 和 gwb-docsite 写回人员列表时一样：一项一行 */
export const peopleText = (entries: PersonEntry[]) => `[\n${entries.map((entry) => `  ${JSON.stringify(entry)}`).join(',\n')}\n]\n`

export const task = (id: string, author: string, status: TaskRecord['status'] = 'todo'): TaskRecord => ({ id, type: 'task', author, status, title: `${author} 的任务` })
export const t1 = '20260925100000-aaaaaaa'
export const t2 = '20260925110000-bbbbbbb'

export function writeRecord(repo: string, record: CollabRecord) {
  const file = path.join(repo, 'collab', recordFileOf(record.id))
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, encodeRecordFile(record))
}

export function writeSite(repo: string, files: Record<string, string>) {
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(repo, 'site', relative)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, content)
  }
}

/** 站点 comments/ 里一串评论的发起文件 */
export const threadFile = (author: string) => `---\nauthor: ${author}\ncreatedAt: 2026-10-10T09:00:00.000Z\nstatus: open\n---\n\n${author} 的评论\n`

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

function cloneAs(root: string, originUrl: string, person: string): string {
  const repo = path.join(root, person)
  git(root, 'clone', '-q', '-c', `user.name=${person}`, '-c', `user.email=${person}@local`, '-c', 'core.autocrlf=false', originUrl, repo)
  installKitInto(repo)
  return repo
}

const writeHook = (bare: string) => {
  writeFileSync(
    path.join(bare, 'hooks', 'post-receive'),
    `#!/bin/sh\n[ "\${GIT_PUSH_OPTION_COUNT:-0}" != 0 ] && printf '%s\\n' "$GIT_PUSH_OPTION_0" "$GIT_PUSH_OPTION_1" > push-options\necho "Visit the existing pull request:"\necho "  ${pullUrl}"\n`,
    { mode: 0o755 },
  )
}

let templateOrigin: string | undefined

export let origin: string
export let admin: string
export let bob: RemoteProject

beforeEach(async () => {
  if (templateOrigin === undefined) {
    const root = mkdtempSync(path.join(tmpdir(), 'gwb-collab-submit-template-'))
    templateOrigin = path.join(root, 'origin.git')
    git(root, 'init', '-q', '--bare', '-b', 'main', templateOrigin)
    git(templateOrigin, 'config', 'receive.advertisePushOptions', 'true')
    writeHook(templateOrigin)
    const seedAdmin = cloneAs(root, templateOrigin, 'admin')
    writeSite(seedAdmin, { 'people.json': peopleText(peopleEntries), 'package.json': '{ "dependencies": {} }\n' })
    writeRecord(seedAdmin, task(t1, 'admin'))
    git(seedAdmin, 'add', '.')
    git(seedAdmin, 'commit', '-q', '-m', '起点')
    git(seedAdmin, 'push', '-q', 'origin', 'main')
  }
  const root = mkdtempSync(path.join(tmpdir(), 'gwb-collab-'))
  origin = path.join(root, 'origin.git')
  git(root, 'clone', '-q', '--bare', templateOrigin, origin)
  git(origin, 'config', 'receive.advertisePushOptions', 'true')
  writeHook(origin)
  admin = cloneAs(root, origin, 'admin')
  bob = await openLocal(cloneAs(root, origin, 'bob'))
})

export const forMain = () => git(origin, 'rev-parse', 'refs/for/main')

/**
 * 假的执行器：merge 时把 refs/for/main 按「合并提交」方式合进 main；reject 时打回，留言写原因；silent 一直不给结论。
 * projectLeads 是协作仓的协作者，推送前本机检查「只有负责人能改的内容」时读它
 */
export function executor(outcome: 'merge' | 'reject' | 'silent', projectLeads: string[] = ['admin']) {
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

export const noWait: VerdictWait = { timeoutMilliseconds: 0, pollMilliseconds: 0 }
export const merges = () => executor('merge').repo
