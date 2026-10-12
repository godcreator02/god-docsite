import { spawn } from 'node:child_process'
import { CollabRejected } from '../errors.js'

export type GitOutput = { code: number; stdout: string; stderr: string }

/**
 * 在 repo 里运行一条 git 命令并收齐输出。退出码不是 0 不算异常，由调用方决定怎么报；git 启动不了才抛错。
 * 没有终端可以回答提示，关掉 git 自己的终端提示，免得卡住。联网的调用把 GitRemote 的 env 传进来（令牌的请求头）
 */
export function runGit(repo: string, args: string[], env: Record<string, string> = {}): Promise<GitOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd: repo, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...env } })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk))
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk))
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }))
  })
}

/** 退出码不是 0 就把 git 的原话报出来 */
export async function git(repo: string, args: string[], env: Record<string, string> = {}): Promise<string> {
  const output = await runGit(repo, args, env)
  if (output.code !== 0) throw new CollabRejected(`git ${args.join(' ')} 失败：${gitMessageOf(output)}`)
  return output.stdout
}

/** 用联网的环境变量（令牌的请求头）取回 origin，只动 refs/remotes/origin/*，不动分支与工作区 */
export async function fetchOrigin(repo: string, env: Record<string, string>): Promise<void> {
  await git(repo, ['fetch', 'origin'], env)
}

/** git 把进度和远端消息写在 stderr 里，结果写在 stdout 里；报给人看时两样都要 */
export function gitMessageOf(output: GitOutput): string {
  return [output.stdout.trim(), output.stderr.trim()].filter((part) => part !== '').join('\n')
}
