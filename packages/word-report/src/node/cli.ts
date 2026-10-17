#!/usr/bin/env node
import { realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkReports, type ReportCheckResult } from './check.ts'
import { reportExport, type ReportExportOptions, type ReportExportResult } from './export.ts'
import { reportEntryIn, reportEntryOf } from './report-files.ts'

const help = `用法：report-docx <export|status> <报告 id> [选项]
      report-docx check [选项]

报告在站点目录的 reports/<报告 id>/：入口是 content.json（JSON 报告）或 index.mdx（MDX 报告）。
export   导出这份报告的 Word 与 PDF，等这次导出做完，把结果按 JSON 打出来；结果在站点的 out/word-report/ 下
status   只看这份报告的导出状态，不启动 Word
check    检查站点里全部报告（JSON 报告的每份与每一章、MDX 报告整份）的格式、引用与图片，有问题时退出码非零

导出要本机装着 Word、MathType 与 uv：uv 照引擎的 uv.lock 在 gwb home 的 data/word-report/ 下准备 Python 环境
（home 照环境变量 GWB_HOME 找，没设是 default），第一次导出要多等几十秒。

选项：
  --site <目录>     站点目录（默认当前目录）
  --engine <目录>   Word 引擎的源码目录（只给 export、status；默认环境变量 DOCREPORT_ENGINE_ROOT，再默认本包自带的 engine/）
  --json            check 的结果按 JSON 打出来
  --help, -h        显示这段说明
`

/** export、status 的入口要看磁盘上是哪种报告，由 main 补上 */
export type CliCommand =
  | { command: 'export' | 'status'; reportId: string; options: Omit<ReportExportOptions, 'entry'> }
  | { command: 'check'; siteDir: string; json: boolean }

function flagValuesOf(flags: string[], allowed: readonly string[]): { values: Map<string, string>; switches: Set<string> } {
  const values = new Map<string, string>()
  const switches = new Set<string>()
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index]!
    if (flag === '--json' && allowed.includes(flag)) {
      if (switches.has(flag)) throw new Error(`参数重复：${flag}`)
      switches.add(flag)
      continue
    }
    if (!allowed.includes(flag) || flag === '--json') throw new Error(`认不出的参数：${flag}；能用的只有 ${allowed.join('、')}`)
    if (values.has(flag)) throw new Error(`参数重复：${flag}`)
    const value = flags[index + 1]
    if (value === undefined || value.startsWith('-') || !value.trim()) throw new Error(`参数缺少值：${flag}`)
    values.set(flag, value)
    index += 1
  }
  return { values, switches }
}

/** 解析命令行；要显示说明时回 undefined。参数不对直接报错 */
export function parseCliArgs(args: string[], cwd = process.cwd()): CliCommand | undefined {
  if (args.length === 0) throw new Error('缺少命令：export、status 或 check；用 --help 查看用法')
  if (args.includes('--help') || args.includes('-h')) return undefined
  const [command, ...rest] = args
  if (command === 'check') {
    const { values, switches } = flagValuesOf(rest, ['--site', '--json'])
    return { command, siteDir: path.resolve(cwd, values.get('--site') ?? '.'), json: switches.has('--json') }
  }
  if (command !== 'export' && command !== 'status') throw new Error(`认不出的命令 ${JSON.stringify(command)}：只有 export、status、check；用 --help 查看用法`)
  const [reportId, ...flags] = rest
  if (reportId === undefined || reportId.startsWith('-')) throw new Error(`${command} 要给报告 id（站点 reports/ 下的目录名）`)
  reportEntryOf(reportId)
  const { values } = flagValuesOf(flags, ['--site', '--engine'])
  const engine = values.get('--engine')
  return {
    command,
    reportId,
    options: {
      siteDir: path.resolve(cwd, values.get('--site') ?? '.'),
      mode: 'complete',
      action: command === 'export' ? 'start' : 'status',
      ...(engine !== undefined ? { engineDir: path.resolve(cwd, engine) } : {}),
    },
  }
}

export interface CliDependencies {
  reportExport?: (options: ReportExportOptions) => Promise<ReportExportResult>
  checkReports?: (siteDir: string) => Promise<ReportCheckResult>
  reportEntryIn?: (siteDir: string, reportId: string) => Promise<string>
  sleep?: (milliseconds: number) => Promise<void>
  stdout?: (text: string) => void
  stderr?: (text: string) => void
  cwd?: string
}

function checkReportText(result: ReportCheckResult): string {
  const lines = [`检查了 ${result.checked} 份报告文档（${result.runs.length} 次组装）。`]
  for (const warning of result.warnings) lines.push(`提示 ${warning.file}${warning.pointer}：${warning.message}`)
  for (const problem of result.problems) lines.push(`问题 ${problem.entry}（${problem.mode === 'complete' ? '整份' : '单独'}）：${problem.message}`)
  if (result.problems.length === 0) lines.push('没有问题。')
  return `${lines.join('\n')}\n`
}

/** export 要等引擎做完同一个任务才退出：引擎在固定下来的快照上工作，进程退了就没人等它的结果 */
async function runExport(options: ReportExportOptions, dependencies: Required<Pick<CliDependencies, 'reportExport' | 'sleep'>>): Promise<ReportExportResult> {
  let result = await dependencies.reportExport(options)
  if (options.action !== 'start' || result.state !== 'running') return result
  const jobId = result.jobId
  if (!jobId) throw new Error('导出任务没有 jobId，无法等它做完')
  do {
    await dependencies.sleep(500)
    result = await dependencies.reportExport({ ...options, action: 'status' })
    if (result.jobId !== jobId) throw new Error('导出任务换了或丢了，不能把别的任务的结果当成这次的')
  } while (result.state === 'running')
  return result
}

export async function main(args: string[], dependencies: CliDependencies = {}): Promise<number> {
  const write = dependencies.stdout ?? ((text: string) => { process.stdout.write(text) })
  const error = dependencies.stderr ?? ((text: string) => { process.stderr.write(text) })
  const sleep = dependencies.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)))
  try {
    const parsed = parseCliArgs(args, dependencies.cwd)
    if (!parsed) {
      write(help)
      return 0
    }
    if (parsed.command === 'check') {
      const result = await (dependencies.checkReports ?? checkReports)(parsed.siteDir)
      write(parsed.json ? `${JSON.stringify(result)}\n` : checkReportText(result))
      return result.problems.length > 0 ? 1 : 0
    }
    const entry = await (dependencies.reportEntryIn ?? reportEntryIn)(parsed.options.siteDir, parsed.reportId)
    const result = await runExport({ ...parsed.options, entry }, { reportExport: dependencies.reportExport ?? reportExport, sleep })
    write(`${JSON.stringify(result)}\n`)
    if (parsed.command === 'status') return result.state === 'failed' || result.state === 'unavailable' ? 1 : 0
    return result.state === 'ready' ? 0 : 1
  } catch (cause) {
    error(`${JSON.stringify({ state: 'failed', message: cause instanceof Error ? cause.message : String(cause) })}\n`)
    return 1
  }
}

// pnpm 的 bin 包装可能经符号链接调起：比较真实路径，被 import 时不执行
function isDirectRun(): boolean {
  const invoked = process.argv[1]
  return invoked !== undefined && realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url))
}
if (isDirectRun()) process.exitCode = await main(process.argv.slice(2))
