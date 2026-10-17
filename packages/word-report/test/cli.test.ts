import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { main, parseCliArgs } from '../src/node/cli.ts'
import type { ReportExportResult } from '../src/node/export.ts'

const entry = 'reports/example/content.json'
function harness(results: ReportExportResult[] = []) {
  const reportExport = vi.fn(async () => {
    const result = results.shift()
    if (!result) throw new Error('Unexpected export call')
    return result
  })
  const checkReports = vi.fn(async () => ({ checked: 0, runs: [], problems: [], warnings: [] }))
  const reportEntryIn = vi.fn(async () => entry)
  return { reportExport, checkReports, reportEntryIn, sleep: vi.fn(async () => {}), stdout: vi.fn(), stderr: vi.fn() }
}

describe('命令行 report-docx（不启动实际 Word）', () => {
  it('export、status 收报告 id，入口留给 main 看磁盘；默认站点是当前目录', () => {
    expect(parseCliArgs(['export', 'example'])).toEqual({ command: 'export', reportId: 'example', options: { siteDir: process.cwd(), mode: 'complete', action: 'start' } })
    expect(parseCliArgs(['status', 'example'], path.resolve('fixture-site'))).toEqual({ command: 'status', reportId: 'example', options: { siteDir: path.resolve('fixture-site'), mode: 'complete', action: 'status' } })
    expect(parseCliArgs(['export', 'example', '--site', 'site', '--engine', 'engine'], path.resolve('fixture'))).toEqual({
      command: 'export',
      reportId: 'example',
      options: { siteDir: path.resolve('fixture/site'), mode: 'complete', action: 'start', engineDir: path.resolve('fixture/engine') },
    })
  })

  it('export 用 main 在磁盘上找到的入口：MDX 报告的入口是 index.mdx', async () => {
    const deps = harness([{ state: 'ready', jobId: 'job' }])
    deps.reportEntryIn.mockResolvedValue('reports/example/index.mdx')
    expect(await main(['export', 'example'], deps)).toBe(0)
    expect(deps.reportEntryIn).toHaveBeenCalledWith(process.cwd(), 'example')
    expect(deps.reportExport).toHaveBeenCalledWith({ siteDir: process.cwd(), entry: 'reports/example/index.mdx', mode: 'complete', action: 'start' })
  })

  it('check 收 --site 与 --json', () => {
    expect(parseCliArgs(['check'])).toEqual({ command: 'check', siteDir: process.cwd(), json: false })
    expect(parseCliArgs(['check', '--site', 'site', '--json'], path.resolve('fixture'))).toEqual({ command: 'check', siteDir: path.resolve('fixture/site'), json: true })
  })

  it.each([
    [], ['unknown', 'example'], ['export'], ['export', '../x'], ['export', 'Upper'], ['export', 'example', '--mode', 'standalone'],
    ['export', 'example', '--site'], ['export', 'example', '--engine', ''], ['export', 'example', '--site', '--engine', 'e'],
    ['export', 'example', '--other', 'value'], ['export', 'example', 'extra'], ['export', 'example', '--site', 'a', '--site', 'b'],
    ['export', 'example', '--json'], ['check', '--engine', 'e'], ['check', '--json', '--json'], ['convert', 'old', 'new'],
  ])('参数错误不调用导出与检查，返回非零：%j', async (...args: string[]) => {
    const deps = harness()
    expect(await main(args, deps)).toBe(1)
    expect(deps.reportExport).not.toHaveBeenCalled()
    expect(deps.checkReports).not.toHaveBeenCalled()
    expect(deps.stdout).not.toHaveBeenCalled()
    expect(JSON.parse(deps.stderr.mock.calls[0]![0] as string)).toMatchObject({ state: 'failed', message: expect.any(String) })
  })

  it.each([['--help'], ['-h'], ['export', '--help'], ['status', '-h'], ['export', 'example', '--help'], ['check', '--help']])('帮助不触发导出：%j', async (...args: string[]) => {
    const deps = harness()
    expect(await main(args, deps)).toBe(0)
    expect(deps.reportExport).not.toHaveBeenCalled()
    expect(deps.stdout).toHaveBeenCalledWith(expect.stringContaining('用法：report-docx'))
  })

  it.each(['idle', 'running', 'ready'] as const)('status 只查询，%s 状态直接返回', async (state) => {
    const deps = harness([{ state, jobId: 'existing-job' }])
    expect(await main(['status', 'example'], deps)).toBe(0)
    expect(deps.reportExport).toHaveBeenCalledExactlyOnceWith({ siteDir: process.cwd(), entry, mode: 'complete', action: 'status' })
    expect(deps.sleep).not.toHaveBeenCalled()
    expect(JSON.parse(deps.stdout.mock.calls[0]![0] as string)).toEqual({ state, jobId: 'existing-job' })
  })

  it('export 等同一个任务做完，只打出最终结果', async () => {
    const final = { state: 'ready', jobId: 'own-job', docx: 'report.docx', pdf: 'report.pdf' } as const
    const deps = harness([{ state: 'running', jobId: 'own-job', docx: 'previous.docx' }, { state: 'running', jobId: 'own-job' }, final])
    deps.sleep.mockImplementation(async () => { expect(deps.stdout).not.toHaveBeenCalled() })
    expect(await main(['export', 'example'], deps)).toBe(0)
    expect(deps.reportExport.mock.calls).toHaveLength(3)
    expect(deps.reportExport).toHaveBeenNthCalledWith(1, { siteDir: process.cwd(), entry, mode: 'complete', action: 'start' })
    expect(deps.reportExport).toHaveBeenNthCalledWith(2, { siteDir: process.cwd(), entry, mode: 'complete', action: 'status' })
    expect(deps.stdout).toHaveBeenCalledExactlyOnceWith(JSON.stringify(final) + '\n')
  })

  it('这次任务失败，不把上次成功的文件当成这次的', async () => {
    const failed = { state: 'failed', jobId: 'own-job', docx: 'previous.docx', message: 'Word failed' } as const
    const deps = harness([{ state: 'running', jobId: 'own-job' }, failed])
    expect(await main(['export', 'example'], deps)).toBe(1)
    expect(deps.stdout).toHaveBeenCalledExactlyOnceWith(JSON.stringify(failed) + '\n')
  })

  it.each(['export', 'status'])('缺少环境或立即失败时 %s 返回非零', async (command) => {
    for (const state of ['unavailable', 'failed'] as const) {
      const deps = harness([{ state, message: 'Missing environment' }])
      expect(await main([command, 'example'], deps)).toBe(1)
      expect(deps.reportExport).toHaveBeenCalledOnce()
    }
  })

  it.each([{ state: 'running' }, { state: 'ready', jobId: 'different-job' }])('拒绝缺失或换掉的 jobId：%j', async (result) => {
    const deps = harness([{ state: 'running', jobId: 'own-job' }, result as ReportExportResult])
    expect(await main(['export', 'example'], deps)).toBe(1)
    expect(deps.stdout).not.toHaveBeenCalled()
    expect(deps.stderr).toHaveBeenCalledOnce()
  })

  it('开始导出没给 jobId：返回非零，不进入没法追踪的等待', async () => {
    const deps = harness([{ state: 'running' }])
    expect(await main(['export', 'example'], deps)).toBe(1)
    expect(deps.sleep).not.toHaveBeenCalled()
    expect(deps.stdout).not.toHaveBeenCalled()
    expect(JSON.parse(deps.stderr.mock.calls[0]![0] as string).message).toContain('jobId')
  })

  it('导出抛错时打出结构化的错误、退出码非零', async () => {
    const deps = harness()
    deps.reportExport.mockRejectedValue(new Error('Word is locked'))
    expect(await main(['export', 'example'], deps)).toBe(1)
    expect(JSON.parse(deps.stderr.mock.calls[0]![0] as string)).toEqual({ state: 'failed', message: 'Word is locked' })
  })
})
