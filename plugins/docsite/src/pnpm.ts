import { spawn } from 'node:child_process'
import { lastLinesOf, stopProcessTree } from './dev-server.js'
import { DocsiteRejected } from './errors.js'

/** 装依赖、加包的时间上限 */
export const pnpmTimeoutMilliseconds = 600_000

/** 在站点目录里跑一条 pnpm 命令；doing 是报错里说「在做什么」。测试里换成假的 */
export type RunPnpm = (dir: string, args: readonly string[], doing: string) => Promise<void>

/**
 * 跑一条 pnpm 命令并等它退出；超时就停掉整棵进程，失败把最后的输出原样报出来。
 * Windows 上 pnpm 是 .cmd，只能经 shell 启动：参数由调用方先校验过，不含空白与 shell 元字符
 */
export const runPnpm: RunPnpm = (dir, args, doing) => {
  const child = spawn('pnpm', [...args], { cwd: dir, shell: true, windowsHide: true })
  let output = ''
  const collect = (chunk: string) => (output = (output + chunk).slice(-4000))
  child.stdout.setEncoding('utf8').on('data', collect)
  child.stderr.setEncoding('utf8').on('data', collect)
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const fail = (error: DocsiteRejected) => {
      if (timer !== undefined) clearTimeout(timer)
      reject(error)
    }
    timer = setTimeout(() => {
      stopProcessTree(child).then(
        () => fail(new DocsiteRejected(`${doing} ${pnpmTimeoutMilliseconds / 1000} 秒没做完，已停掉。输出：\n${lastLinesOf(output, 30)}`)),
        (stopError: unknown) => fail(new DocsiteRejected(`${doing} ${pnpmTimeoutMilliseconds / 1000} 秒没做完，停掉时又出错（${String(stopError)}）。输出：\n${lastLinesOf(output, 30)}`)),
      )
    }, pnpmTimeoutMilliseconds)
    child.on('error', (error) => fail(new DocsiteRejected(`pnpm 启动不了：${error.message}`)))
    child.on('exit', (code) => {
      if (code === 0) {
        if (timer !== undefined) clearTimeout(timer)
        resolve()
        return
      }
      fail(new DocsiteRejected(`${doing}失败（退出码 ${String(code)}）。输出：\n${lastLinesOf(output, 30)}`))
    })
  })
}
