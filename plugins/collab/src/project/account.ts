import { CollabRejected } from '../errors.js'
import type { GiteaAccount } from '../gitea-api/access.js'
import { ownerAndRepoOf } from '../gitea-api/gitea.js'
import { git } from '../git/git.js'
import { requireOrganizationFolder, type GitRemote, type Project, type RemoteProject } from './project.js'

/** 协议、主机、端口；地址不是 http(s) 的就报出来 */
function serverOf(url: string, what: string): string {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    throw new CollabRejected(`${what} ${url.trim()} 不是 https://<主机>/<owner>/<仓名> 的样子`)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new CollabRejected(`${what} ${url.trim()} 不是 http(s) 地址`)
  return parsed.origin
}

/** 仓的地址要在 gwb-gitea 配的那个 Gitea 上：令牌只发给那一台 */
export function requireOnGitea(repoUrl: string, baseUrl: string, what: string): void {
  if (serverOf(repoUrl, what) !== serverOf(baseUrl, 'gwb-gitea 设置里的地址')) {
    throw new CollabRejected(`${what} ${repoUrl.trim()} 不在 gwb-gitea 配的 Gitea（${baseUrl}）上；令牌只发给那一台，换项目或改 gwb-gitea 的设置 base-url`)
  }
}

/**
 * 提交审核是 AGit 推送，Gitea 把合并请求记在推送用的账号名下，执行器拿这个发起人比对协作仓的协作者、
 * 判断是不是项目负责人提交的；令牌的账号和本 home 的身份不一样，记录的作者和合并请求的提交人对不上，所以一开始就拒绝
 */
export function requireSameAccount(login: string, person: string): void {
  if (login !== person) {
    throw new CollabRejected(
      `gwb-gitea 的令牌是 Gitea 账号 ${login} 的，本 home 的身份码在 site/people.json 里认出的是 ${person}：两边要是同一个人。换成自己账号的令牌，或者在 gwb-docsite 的设置 identity-code 里填自己的身份码`,
    )
  }
}

/**
 * 联网的 git 调用（fetch、push、clone）带上的配置：令牌拼成的 Authorization 请求头只发给这个 Gitea，
 * 并清空 credential.helper，不经 Windows 凭据管理器。经环境变量传给 git，不出现在进程的命令行里。
 * baseUrl 在这里不再 normalize：GiteaAccount 的唯一来源（gitea/access.ts 的 account）已经做过
 */
export function gitRemoteOf(account: GiteaAccount): GitRemote {
  const basic = Buffer.from(`${account.login}:${account.token}`).toString('base64')
  return {
    env: {
      GIT_CONFIG_COUNT: '2',
      GIT_CONFIG_KEY_0: `http.${account.baseUrl}/.extraHeader`,
      GIT_CONFIG_VALUE_0: `Authorization: Basic ${basic}`,
      GIT_CONFIG_KEY_1: 'credential.helper',
      GIT_CONFIG_VALUE_1: '',
    },
  }
}

/** 要联网的命令用它：origin 在配的 Gitea 上、令牌的账号就是本机身份、协作仓放在以组织命名的项目文件夹里；origin 只在这里读一次 */
export async function remoteProjectOf(project: Project, account: GiteaAccount): Promise<RemoteProject> {
  const origin = await git(project.repo, ['remote', 'get-url', 'origin'])
  requireOnGitea(origin, account.baseUrl, '这个仓的 origin')
  requireSameAccount(account.login, project.person)
  const gitea = ownerAndRepoOf(origin)
  requireOrganizationFolder(project.repo, gitea.owner)
  return { ...project, remote: gitRemoteOf(account), gitea }
}
