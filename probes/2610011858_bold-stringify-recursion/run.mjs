// 依次在 cases/ 下每个组合目录里 pnpm install（按各自锁文件），再运行 repro.mjs，输出拼在一起打印。
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const casesDir = path.join(here, 'cases')
const pnpm = process.platform === 'win32' ? ['cmd.exe', ['/d', '/c', 'pnpm']] : ['pnpm', []]

for (const name of fs.readdirSync(casesDir).sort()) {
  const cwd = path.join(casesDir, name)
  execFileSync(pnpm[0], [...pnpm[1], 'install', '--frozen-lockfile'], { cwd, stdio: 'ignore', timeout: 5 * 60_000 })
  console.log(`== ${name}`)
  process.stdout.write(execFileSync(process.execPath, [path.join(here, 'repro.mjs')], { cwd, encoding: 'utf8', timeout: 60_000 }))
}
