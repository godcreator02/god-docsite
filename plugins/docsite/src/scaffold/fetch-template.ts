import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { lastLinesOf, stopProcessTree } from '../dev-server.js'
import { DocsiteRejected } from '../errors.js'
import type { FeatureTemplate } from './assemble.js'

/** 拉功能包模板的时间；再久多半是网络不通 */
const fetchTimeoutMilliseconds = 300_000

/**
 * 从 registry 拉功能包的模板：npm pack 下载 tarball（解析版本范围，走用户级 .npmrc 的认证），
 * 系统 tar 解开，回包根目录与解析出的精确版本。返回的 rootDir 用完由调用方删掉
 */
export async function fetchFeatureTemplate(name: string, versionRange: string): Promise<FeatureTemplate & { rootDir: string }> {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'docsite-feature-'))
  try {
    await run(['npm', ['pack', `${name}@${versionRange}`, '--pack-destination', rootDir], rootDir, `拉 ${name}@${versionRange} 的 tarball`])
    const tarballs = readdirSync(rootDir).filter((entry) => entry.endsWith('.tgz'))
    if (tarballs.length !== 1) throw new DocsiteRejected(`npm pack ${name}@${versionRange} 在 ${rootDir} 里留下了 ${tarballs.length} 个 tarball（${tarballs.join('、')}），认不出哪个是它`)
    await run(['tar', ['-xzf', tarballs[0]!, '-C', rootDir], rootDir, `解开 ${tarballs[0]}`])
    const packageDir = path.join(rootDir, 'package')
    let manifest: unknown
    try {
      manifest = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'))
    } catch (error) {
      throw new DocsiteRejected(`${name} 的 tarball 里没有能读的 package.json：${error instanceof Error ? error.message : String(error)}`)
    }
    const version = (manifest as { version?: unknown }).version
    if (typeof version !== 'string') throw new DocsiteRejected(`${name} 的 package.json 没有写 version`)
    return { name, version, dir: packageDir, manifest, rootDir }
  } catch (error) {
    rmSync(rootDir, { recursive: true, force: true })
    throw error
  }
}

/** 在 cwd 里跑一条命令，等它退出；超时停掉整棵进程，失败把最后的输出原样报出来 */
function run([command, args, cwd, doing]: readonly [string, string[], string, string]): Promise<void> {
  const child = spawn(command, args, { cwd, shell: true, windowsHide: true })
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
        () => fail(new DocsiteRejected(`${doing} ${fetchTimeoutMilliseconds / 1000} 秒没做完，已停掉。输出：\n${lastLinesOf(output, 30)}`)),
        (stopError: unknown) => fail(new DocsiteRejected(`${doing} ${fetchTimeoutMilliseconds / 1000} 秒没做完，停掉时又出错（${String(stopError)}）。输出：\n${lastLinesOf(output, 30)}`)),
      )
    }, fetchTimeoutMilliseconds)
    child.on('error', (error) => fail(new DocsiteRejected(`${doing}：${command} 启动不了（${error.message}）`)))
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
