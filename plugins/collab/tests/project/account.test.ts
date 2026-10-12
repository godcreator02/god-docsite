import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { gitRemoteOf, requireOnGitea, requireSameAccount } from '../../src/project/account.js'
import { CollabRejected } from '../../src/errors.js'
import { runGit } from '../../src/git/git.js'
import { normalizeBaseUrl } from '../../src/gitea-api/access.js'

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

const account = { baseUrl: 'https://git.example.org:28377', token: 'secret-token', login: 'bob' }

describe('Gitea 账号与仓的地址', () => {
  it('地址写法与 gwb-gitea 一致：去掉结尾的 /，没写协议的当 https', () => {
    expect(normalizeBaseUrl('git.example.org:28377/')).toBe('https://git.example.org:28377')
    expect(normalizeBaseUrl(' http://host ')).toBe('http://host')
  })

  it('仓的地址要在配的 Gitea 上；地址里带了用户名也认', () => {
    requireOnGitea('https://bob-test@git.example.org:28377/godcreator/hybrid-mmc.git', account.baseUrl, 'origin')
    expect(() => requireOnGitea('https://other.example.org/godcreator/hybrid-mmc.git', account.baseUrl, 'origin')).toThrow(/不在 gwb-gitea 配的 Gitea/)
    expect(() => requireOnGitea('git@git.example.org:godcreator/hybrid-mmc.git', account.baseUrl, 'origin')).toThrow(CollabRejected)
  })

  it('令牌的账号和身份不一样就拒绝，两边都写出来', () => {
    requireSameAccount('bob', 'bob')
    expect(() => requireSameAccount('godcreator', 'bob')).toThrow(/令牌是 Gitea 账号 godcreator 的，本 home 的身份码在 site\/people\.json 里认出的是 bob/)
  })

  it('联网的 git 调用：请求头只配给这个 Gitea，凭据管理器清空；git 认这种经环境变量传的配置', async () => {
    const repo = mkdtempSync(path.join(tmpdir(), 'gwb-collab-account-'))
    git(repo, 'init', '-q')
    const { env } = gitRemoteOf(account)
    const header = (await runGit(repo, ['config', '--get', 'http.https://git.example.org:28377/.extraheader'], env)).stdout.trim()
    expect(header).toBe(`Authorization: Basic ${Buffer.from('bob:secret-token').toString('base64')}`)
    expect((await runGit(repo, ['config', '--get-all', 'credential.helper'], env)).stdout.split('\n').at(-2)).toBe('')
    expect(Object.values(env).join(' ')).not.toContain('secret-token')
  })
})
