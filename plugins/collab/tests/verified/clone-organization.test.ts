import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { cloneOrganization, organizationOfUrl } from '../../src/organization/setup/clone-organization.js'
import type { OrganizationSource } from '../../src/other-repos/fetch/clone-new-repos.js'
import { CollabRejected } from '../../src/errors.js'

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

const people = `${JSON.stringify([{ id: 'admin', name: '管理员' }, { id: 'bob', name: '鲍勃' }])}\n`

let root: string
/** 本地的「组织」：一个目录里放若干裸仓，克隆地址就是裸仓的路径 */
let organizationDir: string
let parent: string

/** 在组织里建一个裸仓，带上给定的文件，推一个提交到 main */
function bareRepoWith(name: string, files: Record<string, string>): void {
  const bare = path.join(organizationDir, `${name}.git`)
  git(root, 'init', '-q', '--bare', '-b', 'main', bare)
  const seed = path.join(root, 'seeds', name)
  git(root, 'clone', '-q', bare, seed)
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(seed, file)), { recursive: true })
    writeFileSync(path.join(seed, file), content)
  }
  git(seed, 'add', '.')
  git(seed, '-c', 'user.name=admin', '-c', 'user.email=admin@local', 'commit', '-q', '-m', '起点')
  git(seed, 'push', '-q', 'origin', 'main')
}

const seedModule = `${JSON.stringify({ id: '20260901090000-seedmod', type: 'module', author: 'admin', title: '起点模块', due: '2026-12-31' }, null, 2)}\n`
const collabRepoFiles = { 'collab/records/20260901090000-seedmod.json': seedModule, 'site/people.json': people, 'site/docsite.json': '{"kind":"collab","format":1}\n', 'site/package.json': '{"name":"site","private":true}\n' }

function sourceOf(names: string[], organization = 'hybrid-mmc'): OrganizationSource {
  return { organization, repoNames: async () => [...names], cloneUrlOf: (name) => path.join(organizationDir, `${name}.git`) }
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'gwb-collab-org-'))
  organizationDir = path.join(root, 'remote')
  mkdirSync(organizationDir)
  parent = path.join(root, 'projects')
  mkdirSync(parent)
  bareRepoWith('collab', collabRepoFiles)
  bareRepoWith('datasheets', { 'README.md': '资料库\n' })
})

describe('组织地址', () => {
  it('https://<主机>/<组织> 读出组织名与组织地址；结尾的 / 与地址里的用户名不算', () => {
    expect(organizationOfUrl('https://git.example.org:28377/hybrid-mmc')).toEqual({ organization: 'hybrid-mmc', organizationUrl: 'https://git.example.org:28377/hybrid-mmc' })
    expect(organizationOfUrl(' https://bob@git.example.org/hybrid-mmc/ ')).toEqual({ organization: 'hybrid-mmc', organizationUrl: 'https://git.example.org/hybrid-mmc' })
  })

  it('给的是仓地址、只有主机、带查询串或组织名有别的字符：直接拒绝，写明要组织地址', () => {
    expect(() => organizationOfUrl('https://git.example.org/hybrid-mmc/collab.git')).toThrow(/像是仓的地址.*要组织地址 https:\/\/<主机>\/<组织>/)
    expect(() => organizationOfUrl('https://git.example.org/')).toThrow(/没有组织名/)
    expect(() => organizationOfUrl('https://git.example.org/hybrid-mmc?tab=repos')).toThrow(CollabRejected)
    expect(() => organizationOfUrl('https://git.example.org/hybrid%20mmc')).toThrow(/组织名/)
    expect(() => organizationOfUrl('hybrid-mmc')).toThrow(CollabRejected)
  })
})

describe('克隆整个组织', () => {
  it('在 <parent>/<组织>/ 下克隆全部仓，认出协作仓、看账号在不在人员列表里；项目文件夹里只有仓，不放工作区文件', async () => {
    const cloned = await cloneOrganization(parent, sourceOf(['datasheets', 'collab']), 'bob', { env: {} })
    const projectDir = path.join(parent, 'hybrid-mmc')
    expect(cloned).toEqual({
      projectDir,
      repo: path.join(projectDir, 'collab'),
      person: 'bob',
      listed: true,
      repos: ['collab', 'datasheets'],
    })
    expect(existsSync(path.join(projectDir, 'datasheets', 'README.md'))).toBe(true)
    expect(readdirSync(projectDir).sort()).toEqual(['collab', 'datasheets'])
  })

  it('克隆出来的每个仓都在自己的配置里开了 core.longpaths：资料库里的长文件名在 Windows 上也检出得了', async () => {
    const cloned = await cloneOrganization(parent, sourceOf(['datasheets', 'collab']), 'bob', { env: {} })
    for (const name of cloned.repos) expect(git(path.join(cloned.projectDir, name), 'config', '--local', '--get', 'core.longpaths')).toBe('true')
  })

  it('账号还不在 people.json 里：照样克隆，listed 为 false', async () => {
    expect((await cloneOrganization(parent, sourceOf(['collab']), 'carol', { env: {} })).listed).toBe(false)
  })

  it('协作仓的 people.json 写坏：报成 CollabRejected，写明是 people.json 的问题', async () => {
    // beforeEach 已经按仓名 collab 建过 seed，换一个组织目录重建同名仓前先删掉它的 seed
    rmSync(path.join(root, 'seeds', 'collab'), { recursive: true, force: true })
    organizationDir = path.join(root, 'remote-broken')
    mkdirSync(organizationDir)
    bareRepoWith('collab', { ...collabRepoFiles, 'site/people.json': '{{{ 不是 JSON' })
    const error = await cloneOrganization(parent, sourceOf(['collab']), 'bob', { env: {} }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(CollabRejected)
    expect((error as Error).message).toMatch(/site\/people\.json 不是合法 JSON/)
  })

  it('项目文件夹已经存在就拒绝，什么都不克隆', async () => {
    mkdirSync(path.join(parent, 'hybrid-mmc'))
    await expect(cloneOrganization(parent, sourceOf(['collab']), 'bob', { env: {} })).rejects.toThrow(/已经存在/)
    expect(existsSync(path.join(parent, 'hybrid-mmc', 'collab'))).toBe(false)
  })

  it('parent 不存在、组织里没有仓：拒绝，不建项目文件夹', async () => {
    await expect(cloneOrganization(path.join(root, 'missing'), sourceOf(['collab']), 'bob', { env: {} })).rejects.toThrow(/不存在/)
    await expect(cloneOrganization(parent, sourceOf([]), 'bob', { env: {} })).rejects.toThrow(/组织 hybrid-mmc 里没有仓/)
    expect(existsSync(path.join(parent, 'hybrid-mmc'))).toBe(false)
  })

  it('组织里没有协作仓：照实报错，写明克隆了哪些仓', async () => {
    await expect(cloneOrganization(parent, sourceOf(['datasheets']), 'bob', { env: {} })).rejects.toThrow(/没有协作仓（site\/docsite\.json 写着 "kind": "collab"）.*datasheets/s)
  })

  it('协作仓不止一个：照实报错，写明是哪些仓', async () => {
    bareRepoWith('collab-2', collabRepoFiles)
    await expect(cloneOrganization(parent, sourceOf(['collab', 'collab-2', 'datasheets']), 'bob', { env: {} })).rejects.toThrow(/不止一个.*collab、collab-2/s)
  })

  it('中途某个仓克隆失败：停下，报出已经克隆了哪些、哪个失败、git 的原话；后面的不再克隆', async () => {
    const error = await cloneOrganization(parent, sourceOf(['collab', 'missing-repo', 'datasheets']), 'bob', { env: {} }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(CollabRejected)
    const message = (error as Error).message
    expect(message).toMatch(/克隆 missing-repo 失败/)
    expect(message).toMatch(/已经克隆了：collab/)
    expect(message).toMatch(/git 的原话：\n[\s\S]*fatal: /)
    expect(message).toMatch(/已克隆的仓留在 .*hybrid-mmc；要重新克隆整个组织，先删掉这个文件夹/)
    expect(existsSync(path.join(parent, 'hybrid-mmc', 'datasheets'))).toBe(false)
  })
})
