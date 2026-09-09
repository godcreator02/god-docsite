import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildState, hasNodeModules } from '../src/sites.js'
import { freePort, killTree, pidAlive, portResponds, startServer } from '../src/runner.js'

/**
 * 真起子进程的那半：现挑空口、`pnpm exec next start -p <口>`、探端口、杀树。
 * **打 `slow` 标签**，日常 `pnpm test` 跳过；`pnpm test:all` 才跑。
 *
 * 夹具是开发套件仓的文档站——它大概率已经 build 过；没 node_modules 或没 build 产物就 skip，
 * 不替人装依赖、不在测试里跑 build（那要几分钟）。
 */

const FIXTURE = 'D:\\unitfolders\\260908dkv\\gwb-devkit\\docs-site'
const usable = fs.existsSync(FIXTURE) && hasNodeModules(FIXTURE) && buildState(FIXTURE) !== 'missing'
if (!usable) console.warn(`[gwb-live-doc] 夹具站不可用（${FIXTURE}），slow 组跳过`)

describe('freePort / portResponds', { tags: ['slow'] }, () => {
  it('挑到的口此刻没人应答', async () => {
    const port = await freePort()
    expect(port).toBeGreaterThan(0)
    expect(await portResponds(port, 500)).toBe(false)
  })
})

describe.skipIf(!usable)('startServer → 探端口 → killTree', { tags: ['slow'] }, () => {
  it('起一个已 build 的站：端口有 HTTP 应答；杀树之后端口释放、pid 不在', async () => {
    const port = await freePort()
    const lines: string[] = []
    const { child, ready } = startServer(FIXTURE, port, (l) => lines.push(l))
    try {
      await ready
      expect(await portResponds(port)).toBe(true)
      expect(child.pid).toBeDefined()
    } finally {
      if (child.pid !== undefined) await killTree(child.pid)
    }
    // taskkill /T 之后 next 那个 node 也该没了：端口不再应答
    let released = false
    for (let i = 0; i < 20 && !released; i++) {
      released = !(await portResponds(port, 500))
      if (!released) await new Promise((r) => setTimeout(r, 250))
    }
    expect(released).toBe(true)
    expect(pidAlive(child.pid!)).toBe(false)
  }, 120_000)
})
