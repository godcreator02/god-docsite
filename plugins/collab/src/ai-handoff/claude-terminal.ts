import { execFile } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { CollabRejected } from '../errors.js'

const execFileAsync = promisify(execFile)
const startWindowTimeoutMilliseconds = 30_000

export const claudeTerminalModel = 'claude-sonnet-5-5'
export const claudeTerminalEffort = 'medium'

/** pwsh 单引号字符串里的单引号写成两个 */
function pwshQuoted(text: string): string {
  return `'${text.replaceAll("'", "''")}'`
}

/**
 * 提示词写进临时文件，新开一个 pwsh 窗口在协作仓里运行 Claude Code 读它；Claude 退出后窗口留着。
 * 经一个隐藏的 pwsh 调 Start-Process 开窗口：插件没有终端，直接 spawn 出来的 pwsh 标准输入是空设备，一读到结尾就连同 Claude 一起退出；
 * Start-Process 让系统新开一个控制台。窗口里要运行的命令用 -EncodedCommand 传，不用再套一层引号
 */
export async function handOffToClaudeTerminal(repo: string, prompt: string): Promise<string> {
  const promptDir = path.join(tmpdir(), 'gwb-collab-ai')
  mkdirSync(promptDir, { recursive: true })
  const promptFile = path.join(promptDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.md`)
  writeFileSync(promptFile, prompt)
  const claudeCommand = ['claude.exe', '--model', claudeTerminalModel, '--effort', claudeTerminalEffort, pwshQuoted(`读 ${promptFile} 并照里面的要求处理`)].join(' ')
  const encodedClaudeCommand = Buffer.from(claudeCommand, 'utf16le').toString('base64')
  const startWindow = `Start-Process pwsh.exe -WorkingDirectory ${pwshQuoted(repo)} -ArgumentList '-NoExit','-EncodedCommand','${encodedClaudeCommand}'`
  try {
    await execFileAsync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', startWindow], { windowsHide: true, timeout: startWindowTimeoutMilliseconds })
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim()
    throw new CollabRejected(`开 pwsh 窗口运行 Claude Code 失败：${stderr || (error as Error).message}`)
  }
  return promptFile
}
