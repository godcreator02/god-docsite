import { createHash, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { access, mkdir, open, readFile, readdir, realpath, rename, unlink, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readReport, type ReadReportResult } from './read-report.ts'
import { walk } from '../core/validate.ts'

type Mode = 'complete' | 'standalone'
type Job = { id: string; site: string; entry: string; mode: Mode; state: 'running' | 'ready' | 'failed'; fingerprint: string; message?: string; checks?: unknown; outputs?: Record<string, string> }
export interface ReportExportOptions {
  siteDir: string
  /** 相对站点目录的入口路径：reports/<报告 id>/content.json 或 reports/<报告 id>/index.mdx（reportEntryIn） */
  entry: string
  mode?: Mode
  action?: 'start' | 'status'
  /** Word 引擎的源码目录（里面有 pyproject.toml、uv.lock、templates/、src/docreport/）；不给就看环境变量 DOCREPORT_ENGINE_ROOT，再不给用本包自带的 engine/ */
  engineDir?: string
  /** 放引擎的 Python 环境与导出锁的目录；不给用 gwb home 的 data/word-report */
  dataDir?: string
  /** 本包目录：它的 package.json 与构建产物算进版本指纹；不给用装着的这一份 */
  packageDir?: string
  expectedFingerprint?: string
}
export interface ReportExportResult {
  state: Job['state'] | 'idle' | 'unavailable'
  jobId?: string
  fingerprint?: string
  stale?: boolean
  checks?: unknown
  visualReview?: 'pending'
  docx?: string
  pdf?: string
  message?: string
}
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const exists = async (file: string) => access(file).then(() => true, () => false)
async function saved<T>(file: string): Promise<T | undefined> { try { return JSON.parse(await readFile(file, 'utf8')) as T } catch { return undefined } }
async function atomicJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n')
  await rename(temporary, file)
}

/** 本模块所在的这一份包的目录：从模块文件往上找 name 是本包的 package.json（源码在 src/node/，构建产物在 dist/，深度不同） */
function installedPackageDir(): string {
  for (let directory = path.dirname(fileURLToPath(import.meta.url)); ; directory = path.dirname(directory)) {
    const manifest = path.join(directory, 'package.json')
    if (existsSync(manifest) && (JSON.parse(readFileSync(manifest, 'utf8')) as { name?: unknown }).name === '@godcreator/word-report') return directory
    if (path.dirname(directory) === directory) throw new Error(`从 ${fileURLToPath(import.meta.url)} 往上找不到 @godcreator/word-report 的 package.json`)
  }
}

/** 本包自带的 Word 引擎：包目录下的 engine/ */
const packagedEngineDir = (packageDir: string) => path.join(packageDir, 'engine')

/** gwb home 的 data/word-report；home 照 gwb 内核的规则找：GWB_HOME 是名字就在 %APPDATA%/gwb-kernel/homes/<名字>，带路径分隔符就是目录本身，没设是 default */
export function gwbDataDir(): string {
  const setting = process.env.GWB_HOME ?? 'default'
  if (/[\\/]/.test(setting)) return path.join(path.resolve(setting), 'data', 'word-report')
  const appData = process.env.APPDATA
  if (!appData) throw new Error(`找不到 gwb home：环境变量 GWB_HOME 是名字 ${JSON.stringify(setting)}，要靠 APPDATA 拼出 home 目录，但 APPDATA 没有设`)
  return path.join(appData, 'gwb-kernel', 'homes', setting, 'data', 'word-report')
}

/** PATH 里的 uv：导出用它照引擎的 uv.lock 准备 Python 环境再运行引擎 */
function uvOnPath(): string | undefined {
  const name = process.platform === 'win32' ? 'uv.exe' : 'uv'
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    if (directory && existsSync(path.join(directory, name))) return path.join(directory, name)
  }
  return undefined
}

/** 导出任务、快照与结果都在站点的 out/word-report/ 下；那里的 .gitignore 让整个目录不进 git */
const exportRootOf = (site: string) => path.join(site, 'out', 'word-report')
const lockFileOf = (dataDir: string) => path.join(dataDir, 'export.lock')
async function versionOf(compiler: string): Promise<string> {
  const version = (JSON.parse(await readFile(path.join(compiler, 'package.json'), 'utf8')) as { version?: unknown }).version
  if (typeof version !== 'string' || !version) throw new Error(`${path.join(compiler, 'package.json')} 里没有 version`)
  return version
}

/** 入口相对站点目录，不收本机的任意路径 */
export function reportEntry(entry: unknown): string {
  if (typeof entry !== 'string' || !(entry.endsWith('/content.json') || entry.endsWith('/index.mdx')) || /[\\:\x00-\x1f]/.test(entry) || entry.startsWith('/') || entry.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('报告入口要是站点目录里的相对路径，如 reports/<报告 id>/content.json 或 reports/<报告 id>/index.mdx')
  return entry
}
function reportMode(value: unknown): Mode {
  if (value === 'complete' || value === 'standalone') return value
  throw new Error('导出模式必须是 complete 或 standalone')
}
/** 引擎文件与本包（组装报告的代码）一起算指纹：任何一边变了，旧的导出结果就算过期 */
async function engineFingerprint(engine: string, compiler: string): Promise<string> {
  const files = ['templates/project-report.dotx', 'schemas/report-content.schema.json', 'pyproject.toml', 'uv.lock', '.python-version']
  for (const name of await readdir(path.join(engine, 'src/docreport'))) if (name.endsWith('.py')) files.push(`src/docreport/${name}`)
  const inputs = await Promise.all(files.sort().map(async (file): Promise<[string, string]> => [`word/${file}`, hash(await readFile(path.join(engine, file)))]))
  async function compilerFiles(relative: string): Promise<void> {
    for (const entry of await readdir(path.join(compiler, relative), { withFileTypes: true })) {
      const name = `${relative}/${entry.name}`
      if (entry.isDirectory()) await compilerFiles(name)
      else if (/\.(?:[cm]?js|json|ts)$/.test(entry.name)) inputs.push([`compiler/${name}`, hash(await readFile(path.join(compiler, name)))])
    }
  }
  inputs.push(['compiler/package.json', hash(await readFile(path.join(compiler, 'package.json')))])
  await compilerFiles('dist')
  if (await exists(path.join(compiler, 'src'))) await compilerFiles('src')
  return hash(JSON.stringify(inputs.sort(([a], [b]) => a.localeCompare(b))))
}
async function layoutOf(root: string, entry: string): Promise<{ value?: unknown; bytes?: Buffer; file: string }> {
  const file = path.join(root, path.dirname(entry), 'layout.json')
  if (!(await exists(file))) return { file }
  const resolved = await realpath(file), relative = path.relative(await realpath(root), resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('布局文件不在站点目录里')
  const bytes = await readFile(resolved)
  return { file, bytes, value: JSON.parse(bytes.toString('utf8')) }
}
/** Word 引擎还不会排一个图号下的多张图：报告里有多图就在启动 Word 之前拒绝 */
function rejectMultiImageFigures(document: unknown) {
  for (const { node } of walk(document)) if (node.type === 'figure' && node.panels) throw new Error(`图 ${node.id} 是多图（panels），导出 Word 还不支持多图；网页上照常显示`)
}
async function capture(site: string, engine: string, compiler: string, entry: string, mode: Mode) {
  const root = site
  const report = await readReport(path.join(root, entry), { root, mode })
  rejectMultiImageFigures(report.document)
  const layout = await layoutOf(root, entry)
  const engineHash = await engineFingerprint(engine, compiler)
  return { report, layout, engineHash, fingerprint: hash(`${report.fingerprint}\n${engineHash}\n${hash(layout.bytes ?? '')}\n${mode}`) }
}
const keyFor = (site: string, entry: string, mode: Mode) => hash(JSON.stringify([site, entry, mode]))
const jobPath = (exportRoot: string, id: string) => path.join(exportRoot, id)
async function previousJob(exportRoot: string, key: string, site: string, entry: string, mode: Mode): Promise<Job | undefined> {
  const latest = await saved<{ id: string }>(path.join(exportRoot, 'web-index', `${key}.json`))
  if (!latest || !/^web-[a-f0-9-]{36}$/.test(latest.id)) return undefined
  const job = await saved<Job>(path.join(jobPath(exportRoot, latest.id), 'job.json'))
  return job?.id === latest.id && job.site === site && job.entry === entry && job.mode === mode && job.state === 'ready' ? job : undefined
}
type RendererLock = { id: string; pid: number; ownerPid?: number; rendererPid?: number; phase?: 'starting' | 'rendering'; createdAt?: string }
class ExportLockError extends Error {
  readonly state: 'locked' | 'lock-invalid' | 'lock-orphaned'
  constructor(message: string, state: ExportLockError['state']) {
    super(message)
    this.state = state
  }
}
function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH' }
}
async function rendererLock(lockFile: string): Promise<RendererLock | undefined> {
  const value = await saved<RendererLock>(lockFile)
  return value && /^web-[a-f0-9-]{36}$/.test(value.id) && Number.isSafeInteger(value.pid) && value.pid > 0 ? value : undefined
}
async function verifyResult(exportRoot: string, job: Job) {
  const output = path.join(jobPath(exportRoot, job.id), 'result')
  const verification = await saved<{ status: string; events: { event: string; pages?: number }[] }>(path.join(output, 'verification.json'))
  const manifest = await saved<{ outputs: Record<string, string> }>(path.join(output, 'manifest.json'))
  if (verification?.status !== 'passed_automation_visual_review_pending' || !manifest?.outputs) throw new Error('Word 未给出完整自动验收记录')
  for (const name of ['report.docx', 'report.pdf']) if (hash(await readFile(path.join(output, name))) !== manifest.outputs[name]) throw new Error('生成文件与验收记录不一致')
  return { outputs: manifest.outputs, checks: { pages: verification.events.find((event) => event.event === 'document-check')?.pages, visualReview: 'pending' } }
}
/** Latest attempt is persisted independently of the previous successful output pointer. */
async function latestAttempt(exportRoot: string, lockFile: string, engine: string, compiler: string, key: string, site: string): Promise<Job | undefined> {
  const pointer = await saved<{ id: string }>(path.join(exportRoot, 'web-active', `${key}.json`))
  if (!pointer || !/^web-[a-f0-9-]{36}$/.test(pointer.id)) return undefined
  const job = await saved<Job>(path.join(jobPath(exportRoot, pointer.id), 'job.json'))
  if (!job || job.site !== site || job.state !== 'running') return job?.site === site ? job : undefined
  const lock = await rendererLock(lockFile)
  if (lock?.id === job.id && alive(lock.rendererPid ?? lock.pid)) return job
  try {
    const source = await saved<{ engineHash: string }>(path.join(jobPath(exportRoot, job.id), 'source-manifest.json'))
    if (!source || await engineFingerprint(engine, compiler) !== source.engineHash) throw new Error('导出服务已重启且引擎版本发生变化，请重新导出')
    const result = await verifyResult(exportRoot, job)
    Object.assign(job, result, { state: 'ready' })
    await atomicJson(path.join(jobPath(exportRoot, job.id), 'job.json'), job)
    await atomicJson(path.join(exportRoot, 'web-index', `${key}.json`), { id: job.id })
  } catch (error) {
    job.state = 'failed'; job.message = `导出进程已结束：${(error as Error).message}`
    await atomicJson(path.join(jobPath(exportRoot, job.id), 'job.json'), job)
  }
  return job
}
async function outputPaths(exportRoot: string, job?: Job): Promise<Pick<ReportExportResult, 'docx' | 'pdf'>> {
  if (!job || !job.outputs) return {}
  const directory = path.join(jobPath(exportRoot, job.id), 'result')
  for (const name of ['report.docx', 'report.pdf']) if (hash(await readFile(path.join(directory, name))) !== job.outputs[name]) throw new Error('生成文件与验收记录不一致')
  return { docx: path.join(directory, 'report.docx'), pdf: path.join(directory, 'report.pdf') }
}

/** One lock per gwb home's word-report data directory, shared across sites and dev-server instances. */
async function acquireLock(file: string, id: string): Promise<() => Promise<void>> {
  await mkdir(path.dirname(file), { recursive: true })
  try {
      const handle = await open(file, 'wx')
      try { await handle.writeFile(JSON.stringify({ id, pid: process.pid, ownerPid: process.pid, phase: 'starting', createdAt: new Date().toISOString() })) }
      catch (error) { await handle.close(); await unlink(file); throw error }
      await handle.close()
      return async () => { const owner = await saved<{ id: string }>(file); if (owner?.id === id) await unlink(file).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error }) }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      const owner = await rendererLock(file)
      if (!owner) throw new ExportLockError(`导出锁损坏或尚未写完，不能确认 Word 是否停止。请核对渲染进程后清理锁：${file}`, 'lock-invalid')
      if (alive(owner.rendererPid ?? owner.pid)) throw new ExportLockError('Word 正在生成另一份报告，请等待完成', 'locked')
      // Never race a delayed child handoff or delete a newly acquired lock from another server.
      throw new ExportLockError(`上次导出进程已退出，锁仍保留。请确认本次 Word 实例已结束后清理锁：${file}`, 'lock-orphaned')
    }
}

/** 引擎在哪、导出写到哪、Python 环境与锁在哪 */
type ExportPlaces = { engine: string; compiler: string; exportRoot: string; dataDir: string; lockFile: string; uv: string }

async function execute(job: Job, places: ExportPlaces, report: ReadReportResult, layout: Awaited<ReturnType<typeof layoutOf>>, engineHash: string, release: () => Promise<void>) {
  const { engine, compiler, exportRoot, dataDir, lockFile, uv } = places
  const directory = jobPath(exportRoot, job.id), input = path.join(directory, 'input'), output = path.join(directory, 'result')
  let log = ''
  try {
    await mkdir(input, { recursive: true })
    await writeFile(path.join(input, 'content.json'), JSON.stringify(report.document, null, 2) + '\n')
    for (const [relative, bytes] of Object.entries(report.assetBytes)) {
      const file = path.join(input, relative)
      await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, bytes)
    }
    for (const [relative, text] of Object.entries(report.files)) {
      const file = path.join(directory, 'sources', relative)
      await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, text)
    }
    await atomicJson(path.join(directory, 'source-manifest.json'), { entry: job.entry, mode: job.mode, fingerprint: job.fingerprint, engineHash, files: report.snapshot, sources: report.sources, assets: report.assets, warnings: report.warnings })
    if (layout.bytes) await writeFile(path.join(directory, 'layout.json'), layout.bytes)
    // Recheck before starting COM; no authored code or live content paths enter Python.
    if (await engineFingerprint(engine, compiler) !== engineHash) throw new Error('Word 引擎在建立快照期间改变，请重新导出')
    // uv 照 uv.lock 把环境同步进 dataDir/env-<版本>（第一次几十秒），引擎从 src/ 以 python -m 运行；不写字节码，安装在 node_modules 里的引擎目录一个文件都不改
    const args = ['run', '--project', engine, '--frozen', 'python', '-m', 'docreport.web_runner', '--lock', lockFile, '--job', job.id, input, '--data-only', '--out', output]
    if (layout.bytes) args.push('--layout', path.join(directory, 'layout.json'))
    const environment = { ...process.env, UV_PROJECT_ENVIRONMENT: path.join(dataDir, `env-${await versionOf(compiler)}`), PYTHONDONTWRITEBYTECODE: '1' }
    await new Promise<void>((resolve, reject) => {
      const child = spawn(uv, args, { cwd: path.join(engine, 'src'), env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk: Buffer) => { log += chunk.toString('utf8'); if (log.length > 2_000_000) log = log.slice(-2_000_000) })
      child.on('error', reject)
      child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Word 导出失败（退出码 ${code}），请查看本次运行记录`)))
    })
    if (await engineFingerprint(engine, compiler) !== engineHash) throw new Error('Word 引擎在生成期间改变，本次结果不能标为成功')
    Object.assign(job, await verifyResult(exportRoot, job), { state: 'ready' })
    await atomicJson(path.join(directory, 'job.json'), job)
    await atomicJson(path.join(exportRoot, 'web-index', `${keyFor(job.site, job.entry, job.mode)}.json`), { id: job.id })
  } catch (error) {
    job.state = 'failed'; job.message = (error as Error).message
    await atomicJson(path.join(directory, 'job.json'), job)
  } finally {
    try { await writeFile(path.join(directory, 'export.log'), log) } finally { await release() }
  }
}

/** Package API: callers can start or inspect a render without a website or workbench process. */
export async function reportExport(options: ReportExportOptions): Promise<ReportExportResult> {
  if (!options || typeof options.siteDir !== 'string' || !options.siteDir.trim()) throw new Error('siteDir 必须是站点目录')
  const site = path.resolve(options.siteDir)
  const entry = reportEntry(options.entry), mode = reportMode(options.mode ?? 'complete')
  const action = options.action ?? 'start'
  if (action !== 'start' && action !== 'status') throw new Error('导出操作必须是 start 或 status')
  if (options.engineDir !== undefined && (typeof options.engineDir !== 'string' || !options.engineDir.trim())) throw new Error('engineDir 必须是 Word 引擎目录')
  if (options.packageDir !== undefined && (typeof options.packageDir !== 'string' || !options.packageDir.trim())) throw new Error('packageDir 必须是本包目录')
  if (options.dataDir !== undefined && (typeof options.dataDir !== 'string' || !options.dataDir.trim())) throw new Error('dataDir 必须是放 Python 环境与导出锁的目录')
  if (options.expectedFingerprint !== undefined && typeof options.expectedFingerprint !== 'string') throw new Error('expectedFingerprint 必须是字符串')
  const compiler = path.resolve(options.packageDir ?? installedPackageDir())
  const engine = path.resolve(options.engineDir ?? process.env.DOCREPORT_ENGINE_ROOT ?? packagedEngineDir(compiler))
  const dataDir = path.resolve(options.dataDir ?? gwbDataDir()), lockFile = lockFileOf(dataDir), exportRoot = exportRootOf(site)
  const key = keyFor(site, entry, mode), active = await latestAttempt(exportRoot, lockFile, engine, compiler, key, site), previous = await previousJob(exportRoot, key, site, entry, mode)
  const outputs = await outputPaths(exportRoot, previous)
  const uv = uvOnPath()
  if (!uv) return { state: 'unavailable', message: `本机找不到 uv：导出用 uv 照 Word 引擎的 uv.lock 在 ${dataDir} 下准备 Python 环境再运行引擎；装好 uv（winget install astral-sh.uv）后重试。导出还要本机装着 Word 与 MathType`, ...outputs }
  let current: Awaited<ReturnType<typeof capture>>
  try { current = await capture(site, engine, compiler, entry, mode) } catch (error) { return { state: 'failed', stale: Boolean(previous), message: (error as Error).message, ...outputs } }
  const latest = active ?? previous
  if (action === 'status') return { state: latest?.state ?? 'idle', message: latest?.message, fingerprint: current.fingerprint, jobId: latest?.id, stale: previous ? previous.fingerprint !== current.fingerprint : false, checks: previous?.checks, visualReview: 'pending', ...outputs }
  if (options.expectedFingerprint !== undefined && options.expectedFingerprint !== current.fingerprint) throw new Error('报告内容已变化，请重新获取状态后导出')
  if (active?.state === 'running') throw new ExportLockError('Word 正在生成这份报告，请等待完成', 'locked')
  const job: Job = { id: `web-${randomUUID()}`, site, entry, mode, state: 'running', fingerprint: current.fingerprint }
  const release = await acquireLock(lockFile, job.id)
  try {
    await mkdir(exportRoot, { recursive: true })
    await writeFile(path.join(exportRoot, '.gitignore'), '*\n')
    await mkdir(jobPath(exportRoot, job.id))
    await atomicJson(path.join(jobPath(exportRoot, job.id), 'job.json'), job)
    await atomicJson(path.join(exportRoot, 'web-active', `${key}.json`), { id: job.id })
  } catch (error) { await release(); throw error }
  void execute(job, { engine, compiler, exportRoot, dataDir, lockFile, uv }, current.report, current.layout, current.engineHash, release).catch(async (error: unknown) => {
    job.state = 'failed'; job.message = String(error)
    await atomicJson(path.join(jobPath(exportRoot, job.id), 'job.json'), job).catch(() => undefined)
  })
  return { state: 'running', jobId: job.id, fingerprint: job.fingerprint, ...outputs }
}
