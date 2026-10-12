import { spawn } from 'node:child_process'
import { createReadStream, existsSync } from 'node:fs'
import { open, stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { isPlainObject } from '@godcreator/collab-model/task-model'
import { projectDirOfSite } from '@godcreator/collab-model/project-model'
import { siteIdentity } from '@godcreator/docsite-kit/server'
import { projectFileApiUrl, repoLinkPrefix, type RepoLinkCheck, type RepoLinkOpen } from '../repo-link-api.js'

/** 交给浏览器看的文件：浏览器自己能显示，PDF 还能按 #page=N 跳页 */
const browserContentTypes: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}

function browserContentTypeOf(file: string) {
  return browserContentTypes[path.extname(file).toLowerCase()] ?? null
}

/** 链接到别处的目录（符号链接、目录联接）也算：existsSync 跟着链接走 */
function isGitRepo(dir: string) {
  return existsSync(path.join(dir, '.git'))
}

class LinkProblem extends Error {
  constructor(
    readonly state: 'no-repo' | 'no-file' | 'invalid',
    message: string,
  ) {
    super(message)
  }
}

/** 项目文件夹里的相对路径拆成段；跑出项目文件夹、绝对路径、反斜杠、空段都拒绝 */
function segmentsOf(relativePath: string) {
  let decoded: string
  try {
    decoded = decodeURIComponent(relativePath)
  } catch {
    throw new LinkProblem('invalid', `${relativePath} 里的百分号编码不完整`)
  }
  if (decoded === '') throw new LinkProblem('invalid', '没写路径：repo: 后面要写相对项目文件夹的路径，第一段是仓名')
  if (decoded.includes('\\')) throw new LinkProblem('invalid', '路径要用 / 分隔，不用 \\')
  if (decoded.startsWith('/') || /^[a-zA-Z]:/.test(decoded)) throw new LinkProblem('invalid', '要写相对项目文件夹的路径，不写绝对路径')
  const segments = decoded.replace(/\/$/, '').split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new LinkProblem('invalid', '路径里不能有 .、.. 或连续的 /：从项目文件夹直接写到文件')
  }
  return segments
}

/** 按段找到项目文件夹里某个仓里的东西；仓不在是 no-repo，东西不在是 no-file */
async function locate(projectDir: string, segments: string[]) {
  const [repoName, ...rest] = segments as [string, ...string[]]
  const repoDir = path.join(projectDir, repoName)
  if (!existsSync(repoDir)) throw new LinkProblem('no-repo', `项目文件夹里没有 ${repoName} 仓，本机可能还没克隆`)
  if (!isGitRepo(repoDir)) throw new LinkProblem('no-repo', `项目文件夹里的 ${repoName} 不是 git 仓`)
  const file = path.join(repoDir, ...rest)
  const stats = await stat(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') throw new LinkProblem('no-file', `${repoName} 仓里没有 ${rest.join('/')}`)
    throw error
  })
  return { file, isDirectory: stats.isDirectory() }
}

/** 开头 8000 字节里有 0 就算二进制，和 git 判断的办法一样 */
async function looksBinary(file: string) {
  const handle = await open(file, 'r')
  try {
    const buffer = Buffer.alloc(8000)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    return buffer.subarray(0, bytesRead).includes(0)
  } finally {
    await handle.close()
  }
}

function lineOf(hash: string) {
  if (hash === '') return undefined
  const match = /^L(\d+)(?:-L\d+)?$/.exec(hash)
  if (!match) throw new LinkProblem('invalid', `文本文件只认 #L<行号> 或 #L<行号>-L<行号>，认不出 #${hash}`)
  return Number(match[1])
}

/** 一条 repo: 链接指向的文件与打开方式；在 VS Code 里打开的带上要跳到的行 */
type Opening = { open: RepoLinkOpen; file: string; line?: number }

async function openingOf(projectDir: string, relativePath: string, hash: string | null): Promise<Opening> {
  const segments = segmentsOf(relativePath)
  const { file, isDirectory } = await locate(projectDir, segments)
  if (isDirectory) throw new LinkProblem('invalid', `${segments.join('/')} 是目录：repo: 链接要指向具体的文件`)
  if (browserContentTypeOf(file)) {
    return { open: { how: 'browser', url: `${projectFileApiUrl}${segments.map(encodeURIComponent).join('/')}${hash === null ? '' : `#${hash}`}` }, file }
  }
  if (await looksBinary(file)) {
    if (hash !== null) throw new LinkProblem('invalid', `用系统默认程序打开的文件后面不能带 #${hash}`)
    return { open: { how: 'system' }, file }
  }
  return { open: { how: 'vscode' }, file, line: lineOf(hash ?? '') }
}

function splitTarget(target: string) {
  if (!target.startsWith(repoLinkPrefix)) throw new LinkProblem('invalid', `不是 ${repoLinkPrefix} 链接`)
  const rest = target.slice(repoLinkPrefix.length)
  const hashAt = rest.indexOf('#')
  return { relativePath: hashAt < 0 ? rest : rest.slice(0, hashAt), hash: hashAt < 0 ? null : rest.slice(hashAt + 1) }
}

/** 检查一条 repo: 链接，能打开就给出打开方式，打不开就给出原因 */
export async function checkRepoLink(projectDir: string, target: string): Promise<RepoLinkCheck> {
  try {
    const { relativePath, hash } = splitTarget(target)
    return { target, state: 'ok', open: (await openingOf(projectDir, relativePath, hash)).open }
  } catch (error) {
    if (error instanceof LinkProblem) return { target, state: error.state, problem: error.message }
    throw error
  }
}

/** 要由站点服务在本机打开的 repo: 链接（VS Code 或系统默认程序）指向的文件；打不开、或该由页面在浏览器里打开的抛错 */
export async function locallyOpenedOf(projectDir: string, target: string): Promise<Opening & { open: { how: 'vscode' | 'system' } }> {
  let opening: Opening
  try {
    const { relativePath, hash } = splitTarget(target)
    opening = await openingOf(projectDir, relativePath, hash)
  } catch (error) {
    if (error instanceof LinkProblem) throw new Error(`${target}：${error.message}`)
    throw error
  }
  const { open } = opening
  if (open.how === 'browser') throw new Error(`${target} 由页面在浏览器里打开，不经站点服务`)
  return { ...opening, open }
}

/** 交文件接口收到的路径（接口前缀之后的部分）对应的文件；只交项目文件夹里各仓里交给浏览器看的那几种文件，别的抛错 */
export function projectFileOf(projectDir: string, urlPath: string) {
  const segments = segmentsOf(urlPath.replace(/^\//, '').replace(/[?#].*$/, ''))
  const repoDir = path.join(projectDir, segments[0]!)
  if (!isGitRepo(repoDir)) throw new Error(`项目文件夹里没有 ${segments[0]} 仓`)
  const file = path.join(projectDir, ...segments)
  if (!browserContentTypeOf(file)) throw new Error(`${segments.join('/')} 不是交给浏览器看的文件（PDF、图片、网页、视频）`)
  return file
}

/** 用系统默认程序打开；不等它退出，Windows 的 explorer 打开成功也返回 1 */
function openWithSystem(file: string) {
  const [command, args] =
    process.platform === 'win32' ? ['explorer.exe', [file]] : process.platform === 'darwin' ? ['open', [file]] : ['xdg-open', [file]]
  spawn(command, args as string[], { detached: true, stdio: 'ignore' }).unref()
}

/** 在项目文件夹的窗口里要打开的文件与跳到的行 */
type VsCodeFile = { file: string; line?: number }

/**
 * VS Code 命令行的参数：先给项目文件夹、再 -g 给文件，开着这个文件夹的窗口就在那个窗口里打开文件，没有就新开一个窗口打开文件夹。
 * Windows 上 code 是 code.cmd，要经 cmd.exe 运行；参数各自加引号（Windows 的路径里不会有引号），命令名 code 不能加：
 * 加了引号，code.cmd 里的 %~dp0 取到的是当前目录，找不到 Code.exe
 */
export function vscodeCommandOf(projectDir: string, target: VsCodeFile, platform: NodeJS.Platform = process.platform) {
  const args = [projectDir, '-g', target.line === undefined ? target.file : `${target.file}:${target.line}`]
  if (platform !== 'win32') return { command: 'code', args, windowsVerbatimArguments: false }
  const quotedArgs = args.map((arg) => `"${arg}"`).join(' ')
  return { command: 'cmd.exe', args: ['/d', '/s', '/c', `"code ${quotedArgs}"`], windowsVerbatimArguments: true }
}

/** 在开着项目文件夹的 VS Code 窗口里打开文件；code 命令找不到或退出码不是 0 就把原话抛出 */
function openInVsCode(projectDir: string, target: VsCodeFile): Promise<void> {
  const { command, args, windowsVerbatimArguments } = vscodeCommandOf(projectDir, target)
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsVerbatimArguments, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
    child.on('error', (error) => reject(new Error(`运行 VS Code 的 code 命令失败：${error.message}。装 VS Code 时要勾「添加到 PATH」`)))
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`VS Code 的 code 命令退出码 ${code}：${stderr.trim() || '没有输出'}。code 不在 PATH 里时，装 VS Code 时要勾「添加到 PATH」`))
    })
  })
}

const siteDirOf = () => process.cwd()
const errorResponse = (status: number, error: string) => Response.json({ error }, { status })

/** 只读的站点（没有本机身份）不碰项目文件夹：发布出去的站点上，别的仓不该经它交出去 */
function readOnlyReason() {
  const identity = siteIdentity(siteDirOf())
  return identity.person ? null : `只读的站点打不开 repo: 链接（${identity.reason}），在本机的协作站里打开`
}

type RepoLinksRequest = { op: 'check'; targets: string[] } | { op: 'open'; target: string }

function parseRepoLinksRequest(value: unknown): RepoLinksRequest | string {
  if (!isPlainObject(value)) return '请求体要是 { op: "check", targets } 或 { op: "open", target }'
  if (value['op'] === 'check') {
    const unknownKey = Object.keys(value).find((key) => key !== 'op' && key !== 'targets')
    if (unknownKey !== undefined) return `check 请求里认不出的字段 ${unknownKey}`
    const targets = value['targets']
    if (!Array.isArray(targets) || !targets.every((target) => typeof target === 'string')) return 'targets 要是字符串数组'
    return { op: 'check', targets }
  }
  if (value['op'] === 'open') {
    const unknownKey = Object.keys(value).find((key) => key !== 'op' && key !== 'target')
    if (unknownKey !== undefined) return `open 请求里认不出的字段 ${unknownKey}`
    const target = value['target']
    if (typeof target !== 'string') return 'target 要是字符串'
    return { op: 'open', target }
  }
  return `op 只能是 check 或 open，收到 ${JSON.stringify(value['op'])}`
}

/**
 * repo: 链接的接口（POST /api/repo-links）：check 检查一批链接，open 在本机用 VS Code 或系统默认程序打开一条。
 * 只读的站点 check 一律回 read-only、open 回 403
 */
export async function repoLinksResponse(request: Request): Promise<Response> {
  if (request.method !== 'POST') return errorResponse(405, `只接受 POST，收到 ${request.method}`)
  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return errorResponse(400, `请求体不是合法 JSON：${error.message}`)
  }
  const parsed = parseRepoLinksRequest(body)
  if (typeof parsed === 'string') return errorResponse(400, parsed)
  const readOnly = readOnlyReason()
  const projectDir = projectDirOfSite(siteDirOf())
  if (parsed.op === 'check') {
    if (readOnly) return Response.json(parsed.targets.map((target): RepoLinkCheck => ({ target, state: 'read-only', problem: readOnly })))
    return Response.json(await Promise.all(parsed.targets.map((target) => checkRepoLink(projectDir, target))))
  }
  if (readOnly) return errorResponse(403, readOnly)
  const check = await checkRepoLink(projectDir, parsed.target)
  if (check.state !== 'ok') return errorResponse(422, `${parsed.target}：${check.problem}`)
  if (check.open.how === 'browser') return errorResponse(422, `${parsed.target} 由页面在浏览器里打开，不经站点服务`)
  const opened = await locallyOpenedOf(projectDir, parsed.target)
  if (opened.open.how === 'system') {
    openWithSystem(opened.file)
    return Response.json({})
  }
  try {
    await openInVsCode(projectDir, opened)
  } catch (error) {
    return errorResponse(500, (error as Error).message)
  }
  return Response.json({})
}

/** 交文件的接口（GET /api/project-file/<仓>/<路径>）：PDF、图片、网页、视频交给浏览器；只读的站点回 403 */
export function projectFileResponse(urlPath: string): Response {
  const readOnly = readOnlyReason()
  if (readOnly) return new Response(readOnly, { status: 403 })
  let file: string
  try {
    file = projectFileOf(projectDirOfSite(siteDirOf()), urlPath)
  } catch (error) {
    return new Response((error as Error).message, { status: 404 })
  }
  if (!existsSync(file)) return new Response(`没有 ${urlPath}`, { status: 404 })
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers: { 'content-type': browserContentTypeOf(file)! } })
}
