import { checkMerge, git } from '../node/merge-check.js'

export type CliResult = { exitCode: 0 | 1 | 2; output: string }

const usage = '用法：collab-merge-check --base <git 版本> --head <git 版本> --author <提交合并请求的人的 Gitea 用户名> --leads <协作仓的负责人，Gitea 用户名，逗号分隔>'

const optionNames = ['--base', '--head', '--author', '--leads'] as const
type OptionName = (typeof optionNames)[number]

const missingOptionReasons: Record<OptionName, string> = {
  '--base': '合进哪个版本',
  '--head': '要合并的版本',
  '--author': '提交合并请求的人',
  '--leads': '协作仓的负责人（Gitea 上协作仓的协作者）',
}

function parseArgs(args: string[]): { base: string; head: string; author: string; authorIsLead: boolean } | string {
  const options: Partial<Record<OptionName, string>> = {}
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!
    if (!(optionNames as readonly string[]).includes(arg)) return arg.startsWith('-') ? `认不出的参数 ${arg}` : `多出来的参数 ${arg}`
    const value = args[index + 1]
    if (value === undefined || value.startsWith('--')) return `${arg} 后面要跟一个值`
    options[arg as OptionName] = value
    index++
  }
  const missing = optionNames.find((name) => options[name] === undefined)
  if (missing !== undefined) return `缺少 ${missing}：${missingOptionReasons[missing]}`
  const leads = options['--leads']!.split(',')
  if (leads.some((lead) => lead === '')) return `--leads 要是逗号分隔的 Gitea 用户名，收到 ${JSON.stringify(options['--leads'])}`
  return { base: options['--base']!, head: options['--head']!, author: options['--author']!, authorIsLead: leads.includes(options['--author']!) }
}

/**
 * 命令行入口的全部逻辑；在仓里任何目录下运行都按仓根算。bin 脚本只负责打印结果、按退出码退出。
 * 检查自己出错（git 失败这类）接住，以退出码 2 结束、打印原话，与「不能合并」的退出码 1 分开，不把堆栈当原因打回
 */
export async function runMergeCheckCli(args: string[], cwd: string): Promise<CliResult> {
  const parsed = parseArgs(args)
  if (typeof parsed === 'string') return { exitCode: 2, output: `${parsed}\n${usage}` }
  try {
    const repo = (await git(cwd, ['rev-parse', '--show-toplevel'])).trim()
    const { verdict, problems } = await checkMerge({ repo, ...parsed })
    if (verdict === 'mergeable') return { exitCode: 0, output: '可以合并：没有冲突，没改只有负责人能改的内容' }
    return { exitCode: 1, output: problems.map((problem) => `- ${problem}`).join('\n') }
  } catch (error) {
    return { exitCode: 2, output: `合并检查自己出错了：${error instanceof Error ? error.message : String(error)}` }
  }
}
