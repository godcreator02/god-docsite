import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pickPort, scanUsedPorts, type PortScanProblem } from './ports.js'
import { readRepoManifest } from './repo-root.js'
import { isInside } from './units-root.js'
import { siteTitle } from './values.js'

/**
 * 建一个 fumadocs 站，两条命令共用：`docfirst.create-plain` 只要官方输出加本机约定，
 * `docfirst.create` 再传入 docfirst 的三个文件清单与 package.json 的补充。
 * 先用官方脚手架 `create-fumadocs-app`（版本写死）生成到临时目录，再应用本机约定，
 * 再按传入的三个清单新增、替换、删除文件，最后整套写到目标目录。
 *
 * 本机约定只改这几处，每一处都是精确文本替换，官方输出里找不到要替换的原文就报错——
 * 那说明脚手架的输出变了，要来这里跟着改：
 * - 新增 `pnpm-workspace.yaml`：放行 esbuild 的安装脚本，否则 pnpm 装依赖直接失败
 * - `package.json`：dev / start 脚本写上端口并只监听 127.0.0.1（不指定地址时 Next 监听 0.0.0.0）
 * - `src/app/layout.tsx`：不从 Google 加载 Inter，页面语言 zh-CN
 * - `src/app/global.css`：字体用本机装的 Sarasa Mono SC，与工作台一致
 * - `src/lib/shared.ts`：站名；去掉指向 fumadocs 自己 GitHub 的 `gitConfig`
 * - `src/lib/layout.shared.tsx`、`src/app/docs/[[...slug]]/page.tsx`：去掉用 `gitConfig` 拼的 GitHub 链接
 * - 删掉分享图路由 `src/app/og/`（它在请求时为中文标题从 Google 下载字形，本机网络下常失败），
 *   docs 页面的元数据不再指向它
 * - 删掉落地页 `src/app/(home)/`，`next.config.mjs` 里把 `/` 跳到 `/docs`
 *
 * 目标目录必须还不存在，所以写文件途中失败时删掉整个目标目录就回到了原样。
 */

/** 官方脚手架的版本。升级 fumadocs 就改这里，再运行慢测试看输出变了没有 */
export const CREATE_FUMADOCS_APP = 'create-fumadocs-app@16.2.8'

/** 非交互运行脚手架的参数：Next + fumadocs-mdx 模板、用 src 目录、自带 Orama 搜索、不装依赖、不 git init */
export const SCAFFOLD_ARGS = ['--template', '+next+fuma-docs-mdx', '--src', '--search', 'orama', '--pm', 'pnpm', '--no-git', '-y']

const SCAFFOLD_TIMEOUT_MS = 5 * 60_000

/** 脚手架输出变了时，报错里指向要跟着改的文件 */
const FIX_HERE = '要跟着改 docfirst 插件的 src/scaffold.ts'

/** 本机约定改过或新增的文件：传入的清单不能再替换、删除它们 */
export const MANAGED_FILES: readonly string[] = [
  'package.json',
  'pnpm-workspace.yaml',
  'next.config.mjs',
  'src/app/layout.tsx',
  'src/app/global.css',
  'src/lib/shared.ts',
  'src/lib/layout.shared.tsx',
  'src/app/docs/[[...slug]]/page.tsx',
]

/** 本机约定删掉的官方文件：分享图路由与落地页 */
export const REMOVED_FILES: readonly string[] = ['src/app/og/docs/[...slug]/route.tsx', 'src/app/(home)/layout.tsx', 'src/app/(home)/page.tsx']

const PNPM_WORKSPACE = `# esbuild（fumadocs-mdx 的依赖）要跑安装脚本才装得下平台二进制，pnpm 默认不跑、直接报错
allowBuilds:
  esbuild: true
`

const FONT_THEME = `
@theme {
  --font-sans: 'Sarasa Mono SC', 'Sarasa Gothic SC', ui-sans-serif, system-ui, 'Segoe UI', 'PingFang SC',
    'Microsoft YaHei UI', 'Noto Sans SC', sans-serif;
  --font-mono: 'Sarasa Mono SC', ui-monospace, 'Cascadia Mono', Consolas, monospace;
}
`

/** 一个文件：相对站目录的路径（正斜杠）与正文 */
export interface SiteFile {
  path: string
  text: string
}

/** 合进 package.json 的内容。依赖与脚本的键跟已有的重名就报错 */
export interface ManifestAdditions {
  description?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  scripts?: Record<string, string>
}

/** 在官方输出上的改动 */
export interface FileChanges {
  /** 新增，官方输出里已经有同名文件就报错 */
  addFiles?: SiteFile[]
  /** 整份替换，官方输出里必须有这份 */
  replaceFiles?: SiteFile[]
  /** 删除，官方输出里必须有这份 */
  removeFiles?: string[]
}

/** 建一个站要的全部输入。除了 `dir` 都可以不给 */
export interface SiteOptions extends ManifestAdditions, FileChanges {
  /** 站目录：**绝对路径，且必须还不存在**（上一级得已经在） */
  dir: string
  /** 站名，不给按 `siteTitle` 的规则从仓根 package.json 与目录名认 */
  title?: string
  /** 写进 dev / start 脚本的端口。给了就用它，被别的站占着也只在 `portTakenBy` 里写明 */
  port?: number
  /** 单元容器根（单元文件夹插件的设置 `units-root`）。站在它里面就在整个根里查端口，否则只查站目录的祖父目录 */
  unitsRoot?: string
}

/** 把官方脚手架生成到 `into` 目录（它必须还不存在）。测试里换成读样本 */
export type Scaffold = (into: string) => Promise<void>

/** 端口查重的范围与结果 */
export interface PortScanReport {
  /** 实际扫描的目录 */
  root: string
  /** 为真：扫的是容器根；为假：没给容器根或站不在它里面，只扫了站目录的祖父目录 */
  coversUnitsRoot: boolean
  /** 没读成的目录或 package.json；有内容就说明查重不完整 */
  incomplete: PortScanProblem[]
}

/** 算完、还没写文件的一个站 */
export interface SitePlan {
  target: string
  title: string
  port: number
  portTakenBy?: string
  /** 别的站已经占用的端口 → 占用它的目录 */
  used: Map<number, string>
  portScan: PortScanReport
  files: SiteFile[]
}

export interface SiteResult extends SitePlan {
  written: string[]
}

/** 递归读出一个目录下的所有文件，路径用正斜杠、按路径排序 */
export function readTree(root: string): SiteFile[] {
  const out: SiteFile[] = []
  const walk = (prefix: string): void => {
    for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
      const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      if (entry.isDirectory()) walk(rel)
      else out.push({ path: rel, text: fs.readFileSync(path.join(root, rel), 'utf8') })
    }
  }
  walk('')
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

/** 实际运行官方脚手架。要联网（pnpm dlx 下载包），不装依赖 */
export const runCreateFumadocsApp: Scaffold = async (into) => {
  const args = ['dlx', CREATE_FUMADOCS_APP, path.basename(into), ...SCAFFOLD_ARGS]
  // Windows 上 pnpm 是 .cmd，不能直接当可执行文件启动，经 cmd.exe 启动
  const [file, argv] = process.platform === 'win32' ? ['cmd.exe', ['/d', '/c', 'pnpm', ...args]] : ['pnpm', args]
  await new Promise<void>((resolve, reject) => {
    execFile(file, argv, { cwd: path.dirname(into), timeout: SCAFFOLD_TIMEOUT_MS }, (error, _stdout, stderr) => {
      if (error === null) resolve()
      else reject(new Error(`pnpm ${args.join(' ')} 失败：${error.message}${stderr === '' ? '' : `\n${stderr.slice(-2000)}`}`, { cause: error }))
    })
  })
  if (!fs.existsSync(path.join(into, 'package.json'))) throw new Error(`${CREATE_FUMADOCS_APP} 运行完了，但 ${into} 下没有 package.json`)
}

/** 把 `from` 恰好出现一次的地方换成 `to`；出现零次或多次都报错，说清是哪份文件 */
export function replaceOnce(text: string, from: string, to: string, file: string): string {
  const count = text.split(from).length - 1
  if (count !== 1) throw new Error(`${CREATE_FUMADOCS_APP} 的 ${file} 里「${from}」出现了 ${String(count)} 次，本机约定要它恰好出现一次——脚手架的输出变了，${FIX_HERE}`)
  return text.replace(from, to)
}

/**
 * 把传入的依赖、脚本、描述合进 package.json。依赖与脚本的键跟已有的重名就报错（一次列全）；
 * 新加的依赖按名字排进原表。
 */
export function extendManifest(manifestText: string, additions: ManifestAdditions): string {
  const manifest = JSON.parse(manifestText) as Record<string, unknown>
  const clashes: string[] = []
  for (const field of ['dependencies', 'devDependencies', 'scripts'] as const) {
    const extra = additions[field]
    if (extra === undefined) continue
    const own = (manifest[field] ?? {}) as Record<string, string>
    for (const key of Object.keys(extra)) if (key in own) clashes.push(`${field}.${key}`)
    const merged = { ...own, ...extra }
    manifest[field] = field === 'scripts' ? merged : Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)))
  }
  if (clashes.length > 0) throw new Error(`package.json 里已经有这些键，不覆盖：${clashes.join('、')}`)
  if (additions.description !== undefined) manifest['description'] = additions.description
  return `${JSON.stringify(manifest, null, 2)}\n`
}

/** 本机约定：在官方输出上改的那几份文件，见文件头 */
export function applyConventions(files: readonly SiteFile[], values: { title: string; port: number }): SiteFile[] {
  const byPath = new Map(files.map((file) => [file.path, file.text]))
  const take = (file: string): string => {
    const text = byPath.get(file)
    if (text === undefined) throw new Error(`${CREATE_FUMADOCS_APP} 的输出里没有 ${file}——脚手架的输出变了，${FIX_HERE}`)
    return text
  }
  if (byPath.has('pnpm-workspace.yaml')) throw new Error(`${CREATE_FUMADOCS_APP} 的输出里已经有 pnpm-workspace.yaml——脚手架的输出变了，${FIX_HERE}`)

  const port = String(values.port)
  const manifest = JSON.parse(take('package.json')) as { scripts?: Record<string, string> }
  for (const script of ['dev', 'start'] as const) {
    const command = manifest.scripts?.[script]
    if (command !== `next ${script}`) throw new Error(`${CREATE_FUMADOCS_APP} 的 package.json 里 ${script} 脚本是「${String(command)}」，本机约定要它是「next ${script}」——脚手架的输出变了，${FIX_HERE}`)
    manifest.scripts![script] = `next ${script} -p ${port} -H 127.0.0.1`
  }
  byPath.set('package.json', `${JSON.stringify(manifest, null, 2)}\n`)
  byPath.set('pnpm-workspace.yaml', PNPM_WORKSPACE)

  let layout = take('src/app/layout.tsx')
  layout = replaceOnce(layout, "import { Inter } from 'next/font/google';\n", '', 'src/app/layout.tsx')
  layout = replaceOnce(layout, "\nconst inter = Inter({\n  subsets: ['latin'],\n});\n", '', 'src/app/layout.tsx')
  layout = replaceOnce(layout, '<html lang="en" className={inter.className} suppressHydrationWarning>', '<html lang="zh-CN" suppressHydrationWarning>', 'src/app/layout.tsx')
  byPath.set('src/app/layout.tsx', layout)

  byPath.set('src/app/global.css', take('src/app/global.css') + FONT_THEME)
  let shared = take('src/lib/shared.ts')
  shared = replaceOnce(shared, "export const appName = 'My App';", `export const appName = ${JSON.stringify(values.title)};`, 'src/lib/shared.ts')
  shared = replaceOnce(
    shared,
    "// fill this with your actual GitHub info, for example:\nexport const gitConfig = {\n  user: 'fuma-nama',\n  repo: 'fumadocs',\n  branch: 'main',\n};\n\n",
    '',
    'src/lib/shared.ts',
  )
  byPath.set('src/lib/shared.ts', shared)

  let layoutShared = take('src/lib/layout.shared.tsx')
  layoutShared = replaceOnce(layoutShared, "import { appName, gitConfig } from './shared';", "import { appName } from './shared';", 'src/lib/layout.shared.tsx')
  layoutShared = replaceOnce(layoutShared, '    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,\n', '', 'src/lib/layout.shared.tsx')
  byPath.set('src/lib/layout.shared.tsx', layoutShared)

  const docsPage = 'src/app/docs/[[...slug]]/page.tsx'
  let page = take(docsPage)
  page = replaceOnce(page, "import { getPageImageUrl, getPageMarkdownUrl, gitConfig } from '@/lib/shared';", "import { getPageMarkdownUrl } from '@/lib/shared';", docsPage)
  page = replaceOnce(
    page,
    '          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/content/docs/${page.path}`}\n',
    '',
    docsPage,
  )
  page = replaceOnce(page, '    openGraph: {\n      images: getPageImageUrl(page).url,\n    },\n', '', docsPage)
  byPath.set(docsPage, page)

  byPath.set(
    'next.config.mjs',
    replaceOnce(
      take('next.config.mjs'),
      '  reactStrictMode: true,\n',
      "  reactStrictMode: true,\n  redirects: async () => [{ source: '/', destination: '/docs', permanent: true }],\n",
      'next.config.mjs',
    ),
  )
  for (const file of REMOVED_FILES) {
    take(file)
    byPath.delete(file)
  }

  return [...byPath].map(([file, text]) => ({ path: file, text })).sort((a, b) => a.path.localeCompare(b.path))
}

/** 路径要相对站目录、用正斜杠、不越出站目录 */
function pathProblem(rel: string): string | undefined {
  if (rel === '' || rel.includes('\\') || rel.startsWith('/') || /^[A-Za-z]:/.test(rel)) return `${rel || '（空）'}：要相对站目录、用正斜杠`
  if (rel.split('/').some((s) => s === '' || s === '.' || s === '..')) return `${rel}：路径里不能有空段、. 或 ..`
  return undefined
}

/**
 * 按传入的三个清单改官方输出。新增的不能已存在；替换、删除的必须存在，且不能是本机约定改过的那几份；
 * 同一个路径不能出现两次；也不能既是文件又是别的文件的上级目录。有问题的一次列全，一个都不改。
 */
export function applyChanges(files: readonly SiteFile[], changes: FileChanges): SiteFile[] {
  const byPath = new Map(files.map((file) => [file.path, file.text]))
  const managed = new Set(MANAGED_FILES)
  const problems: string[] = []
  const touched = new Set<string>()
  const check = (rel: string, kind: 'add' | 'replace' | 'remove'): void => {
    const bad = pathProblem(rel)
    if (bad !== undefined) return void problems.push(bad)
    if (touched.has(rel)) return void problems.push(`${rel}：在清单里出现了不止一次`)
    touched.add(rel)
    if (kind === 'add' && byPath.has(rel)) problems.push(`${rel}：官方输出里已经有，要换请放进 replaceFiles`)
    if (kind !== 'add' && !byPath.has(rel)) problems.push(`${rel}：官方输出里没有这份，没法${kind === 'replace' ? '替换' : '删除'}`)
    if (kind !== 'add' && managed.has(rel)) problems.push(`${rel}：本机约定已经改过这份，不能再${kind === 'replace' ? '替换' : '删除'}`)
  }
  for (const file of changes.addFiles ?? []) check(file.path, 'add')
  for (const file of changes.replaceFiles ?? []) check(file.path, 'replace')
  for (const rel of changes.removeFiles ?? []) check(rel, 'remove')
  if (problems.length === 0) {
    for (const rel of changes.removeFiles ?? []) byPath.delete(rel)
    for (const file of [...(changes.addFiles ?? []), ...(changes.replaceFiles ?? [])]) byPath.set(file.path, file.text)
    for (const rel of byPath.keys()) {
      const segments = rel.split('/')
      for (let depth = 1; depth < segments.length; depth++) {
        const ancestor = segments.slice(0, depth).join('/')
        if (byPath.has(ancestor)) problems.push(`${ancestor}：既是文件，又是 ${rel} 的上级目录`)
      }
    }
  }
  if (problems.length > 0) throw new Error(`文件清单有问题，一个文件都没写：${problems.join('；')}`)
  return [...byPath].map(([file, text]) => ({ path: file, text })).sort((a, b) => a.path.localeCompare(b.path))
}

/** 端口在哪儿查重：站在容器根里就查整个容器根，否则只查站目录的祖父目录 */
function portScanRoot(target: string, unitsRoot: string | undefined): { root: string; coversUnitsRoot: boolean } {
  if (unitsRoot !== undefined && isInside(unitsRoot, target)) return { root: unitsRoot, coversUnitsRoot: true }
  return { root: path.dirname(path.dirname(target)), coversUnitsRoot: false }
}

/**
 * 算出一个站，不写目标目录：检查目标 → 定站名 → 选端口 → 脚手架生成到临时目录并读进内存 →
 * 应用本机约定 → 合并 package.json → 按清单改。任何一步不通过都在这里抛出；临时目录总会删掉。
 */
export async function planSite(options: SiteOptions, scaffold: Scaffold = runCreateFumadocsApp): Promise<SitePlan> {
  const raw = options.dir.trim()
  if (raw === '') throw new Error('要 { dir: string }——站目录的绝对路径')
  if (!path.isAbsolute(raw)) throw new Error(`dir 要是绝对路径（这里不知道该相对于哪个目录），给的是：${options.dir}`)
  const target = path.resolve(raw)
  if (fs.existsSync(target)) throw new Error(`目标目录已经存在，不覆盖任何东西：${target}`)
  const parent = path.dirname(target)
  if (!fs.existsSync(parent)) throw new Error(`上一级目录不存在：${parent}——先把仓建出来，站放在它下面`)

  const title = siteTitle(parent, readRepoManifest(parent), options.title)
  const scope = portScanRoot(target, options.unitsRoot)
  const { used, incomplete } = scanUsedPorts(scope.root)
  const port = pickPort(used, options.port)

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-docfirst-site-'))
  let generated: SiteFile[]
  try {
    const into = path.join(temp, path.basename(target))
    await scaffold(into)
    generated = readTree(into)
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }

  const conventional = applyConventions(generated, { title, port }).map((file) =>
    file.path === 'package.json' ? { path: file.path, text: extendManifest(file.text, options) } : file,
  )
  const plan: SitePlan = { target, title, port, used, portScan: { ...scope, incomplete }, files: applyChanges(conventional, options) }
  const takenBy = used.get(port)
  if (takenBy !== undefined) plan.portTakenBy = takenBy
  return plan
}

/** 算出一个站并写入目标目录。写到一半失败就删掉整个目标目录（它是这次新建的）再抛出 */
export async function createSite(options: SiteOptions, scaffold: Scaffold = runCreateFumadocsApp): Promise<SiteResult> {
  const plan = await planSite(options, scaffold)
  const written: string[] = []
  try {
    for (const file of plan.files) {
      const full = path.join(plan.target, ...file.path.split('/'))
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, file.text, 'utf8')
      written.push(file.path)
    }
  } catch (error) {
    fs.rmSync(plan.target, { recursive: true, force: true })
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`写盘途中失败，已删掉新建的 ${plan.target}：${reason}`, { cause: error })
  }
  return { ...plan, written }
}
