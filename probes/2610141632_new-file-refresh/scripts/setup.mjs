// 把 site/ 复制成两个独立安装根：.work/original（原版 vite 8.3.4）与 .work/patched（挂 docsite-kit 仓根那份 vite 补丁），
// 各自 pnpm install。重复运行只覆盖源文件，保留已装的 node_modules
import { spawnSync } from 'node:child_process'
import { cp, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const probeDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const siteDir = path.join(probeDir, 'site')
const repoPatch = path.resolve(probeDir, '../../patches/vite@8.3.4.patch')
const logDir = path.join(probeDir, 'results', 'logs')

const sharedWorkspaceSettings = `allowBuilds:
  esbuild: true
  '@parcel/watcher': false
onlyBuiltDependencies:
  - esbuild
`

const installRoots = {
  original: sharedWorkspaceSettings,
  patched: `patchedDependencies:
  vite@8.3.4: patches/vite@8.3.4.patch
${sharedWorkspaceSettings}`,
}

const skippedNames = new Set(['node_modules', '.source', '.react-router', 'build'])

await mkdir(logDir, { recursive: true })
for (const [rootName, workspaceYaml] of Object.entries(installRoots)) {
  const rootDir = path.join(probeDir, '.work', rootName)
  await cp(siteDir, rootDir, { recursive: true, force: true, filter: (source) => !skippedNames.has(path.basename(source)) })
  await writeFile(path.join(rootDir, 'pnpm-workspace.yaml'), workspaceYaml)
  if (rootName === 'patched') await cp(repoPatch, path.join(rootDir, 'patches', 'vite@8.3.4.patch'))
  console.log(`[setup] ${rootName}: pnpm install …`)
  const install = spawnSync('pnpm', ['install'], { cwd: rootDir, shell: true, encoding: 'utf8' })
  await writeFile(path.join(logDir, `install-${rootName}.log`), `${install.stdout}\n${install.stderr}`)
  if (install.status !== 0) throw new Error(`${rootName} 的 pnpm install 失败（退出码 ${install.status}），日志在 results/logs/install-${rootName}.log`)
}
console.log('[setup] 完成')
