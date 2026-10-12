import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { OrganizationSource } from '../../src/other-repos/fetch/clone-new-repos.js'
import { cloneOrganization } from '../../src/organization/setup/clone-organization.js'
import { openProject, type RemoteProject } from '../../src/project/project.js'

/** 几个目录的测试共用的本地「组织」：一个目录里放若干裸仓，克隆地址就是裸仓的路径；用 cloneOrganization 克隆进项目文件夹 */

export const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

/** 测试里本 home 的身份码：bob 的 */
export const bobCode = 'bobcode2345'

export const people = `${JSON.stringify([
  { id: 'admin', name: '管理员', gitea: 'admin' },
  { id: 'bob', name: '鲍勃', codes: [bobCode], gitea: 'bob' },
])}\n`

/** 协作仓起点就有的一个模块：协作仓要有 collab/ */
export const seedModuleId = '20260901090000-seedmod'
export const seedModule = `${JSON.stringify({ id: seedModuleId, type: 'module', author: 'admin', title: '起点模块', due: '2026-12-31' }, null, 2)}\n`

export const collabRepoFiles = {
  [`collab/records/${seedModuleId}.json`]: seedModule,
  'site/people.json': people,
  'site/package.json': '{"name":"site","private":true}\n',
}

export type LocalOrganization = {
  root: string
  organizationDir: string
  projectDir: string
  collabRepo: string
  source: OrganizationSource
  dirOf(name: string): string
  /** 在组织里建一个裸仓，带上给定的文件，推一个提交到 main */
  bareRepoWith(name: string, files: Record<string, string>): void
  /** 维护者往组织的裸仓 main 上推一个提交 */
  pushToOrigin(name: string, file: string, content: string): void
  /** 在项目文件夹里的仓上以本机身份提交 */
  commitIn(repo: string, message: string): void
  /** 本机身份是 bob 的联网项目；origin 都是本地裸仓，GitRemote 不带请求头 */
  bob(): Promise<RemoteProject>
}

/** repos 是除协作仓以外的仓与它们的文件；协作仓叫 collab */
export async function localOrganization(repos: Record<string, Record<string, string>>): Promise<LocalOrganization> {
  const root = mkdtempSync(path.join(tmpdir(), 'gwb-collab-org-'))
  const organizationDir = path.join(root, 'remote')
  mkdirSync(organizationDir)
  mkdirSync(path.join(root, 'projects'))
  const seedOf = (name: string) => path.join(root, 'seeds', name)
  const commitAs = (repo: string, message: string) => {
    git(repo, 'add', '.')
    git(repo, '-c', 'user.name=admin', '-c', 'user.email=admin@local', 'commit', '-q', '-m', message)
  }
  const bareRepoWith = (name: string, files: Record<string, string>) => {
    const bare = path.join(organizationDir, `${name}.git`)
    git(root, 'init', '-q', '--bare', '-b', 'main', bare)
    git(root, 'clone', '-q', bare, seedOf(name))
    for (const [file, content] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(seedOf(name), file)), { recursive: true })
      writeFileSync(path.join(seedOf(name), file), content)
    }
    commitAs(seedOf(name), '起点')
    git(seedOf(name), 'push', '-q', 'origin', 'main')
  }
  const source: OrganizationSource = {
    organization: 'hybrid-mmc',
    repoNames: async () =>
      readdirSync(organizationDir)
        .filter((entry) => entry.endsWith('.git'))
        .map((entry) => entry.slice(0, -'.git'.length)),
    cloneUrlOf: (name) => path.join(organizationDir, `${name}.git`),
  }
  bareRepoWith('collab', collabRepoFiles)
  for (const [name, files] of Object.entries(repos)) bareRepoWith(name, files)
  const cloned = await cloneOrganization(path.join(root, 'projects'), source, 'bob', { env: {} })
  const dirOf = (name: string) => path.join(cloned.projectDir, name)
  for (const name of cloned.repos) {
    git(dirOf(name), 'config', 'user.name', 'bob')
    git(dirOf(name), 'config', 'user.email', 'bob@local')
    git(dirOf(name), 'config', 'core.autocrlf', 'false')
  }
  return {
    root,
    organizationDir,
    projectDir: cloned.projectDir,
    collabRepo: cloned.repo,
    source,
    dirOf,
    bareRepoWith,
    pushToOrigin: (name, file, content) => {
      writeFileSync(path.join(seedOf(name), file), content)
      commitAs(seedOf(name), `改 ${file}`)
      git(seedOf(name), 'push', '-q', 'origin', 'main')
    },
    commitIn: (repo, message) => {
      git(repo, 'add', '.')
      git(repo, 'commit', '-q', '-m', message)
    },
    bob: async () => ({ ...(await openProject(cloned.repo, bobCode)), remote: { env: {} }, gitea: { owner: 'hybrid-mmc', repo: 'collab', ownerUrl: 'https://git.example.org/hybrid-mmc' } }),
  }
}

/** 假的 Gitea：按「方法 路径」回预先写好的回复，记下每次请求 */
export type FakeRequest = { method: string; path: string; query?: Record<string, string | number | boolean>; body?: Record<string, unknown> }
export type FakeReply = { status: number; body: unknown }

export function fakeGitea(replies: Record<string, FakeReply | ((request: FakeRequest) => FakeReply)>) {
  const requests: FakeRequest[] = []
  const http = async (request: FakeRequest): Promise<FakeReply> => {
    requests.push(request)
    const reply = replies[`${request.method} ${request.path}`]
    if (reply === undefined) throw new Error(`假的 Gitea 没准备 ${request.method} ${request.path}`)
    return typeof reply === 'function' ? reply(request) : reply
  }
  return { http, requests, sent: () => requests.map((request) => `${request.method} ${request.path}`) }
}

export const collaborators = (...logins: string[]): FakeReply => ({ status: 200, body: logins.map((login) => ({ id: 1, login, username: login })) })
export const isAdmin = (admin: boolean): FakeReply => ({ status: 200, body: { permissions: { admin, push: true, pull: true } } })
export const hasMain: FakeReply = { status: 200, body: { protected: true, user_can_merge: true } }
export const noMain: FakeReply = { status: 404, body: { message: 'branch not found' } }
export const noProtection: FakeReply = { status: 404, body: { message: 'branch protection does not exist' } }
export const done: FakeReply = { status: 204, body: null }

/** Gitea 1.24 回的 main 保护规则（只写用到的字段） */
export const protectionRule = (rule: { pushUsers?: string[]; pushTeams?: string[]; mergeUsers?: string[]; mergeTeams?: string[]; forcePush?: boolean; enablePush?: boolean }): FakeReply => ({
  status: 200,
  body: {
    rule_name: 'main',
    enable_push: rule.enablePush ?? true,
    enable_push_whitelist: true,
    push_whitelist_usernames: rule.pushUsers ?? [],
    push_whitelist_teams: rule.pushTeams ?? [],
    enable_force_push: rule.forcePush ?? false,
    enable_merge_whitelist: true,
    merge_whitelist_usernames: rule.mergeUsers ?? [],
    merge_whitelist_teams: rule.mergeTeams ?? [],
  },
})
