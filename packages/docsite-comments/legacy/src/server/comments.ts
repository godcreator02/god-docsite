import { randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { compile } from '@mdx-js/mdx'
import { authorizeWrite, WriteAccessError, type Person } from '@godcreator/docsite-identity/server'
import {
  commentablePagesOf,
  commentElementKinds,
  commentSnapshotFile,
  isCommentOpeners,
  isCommentRange,
  isThreadHeadFile,
  snapshotMismatchOf,
  type CommentElementKind,
  type Commenter,
  type CommentRange,
  type CommentThreadFrontmatter,
} from '../comments.js'
import { pageTextOfHtml } from './page-text.js'

/** 网页能做的几件事 */
export type CommentOperation = 'create' | 'reply' | 'edit' | 'delete' | 'resolve' | 'reopen'
const operations: readonly CommentOperation[] = ['create', 'reply', 'edit', 'delete', 'resolve', 'reopen']

class RejectedRequest extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

const threadIdPattern = /^[\w-]+$/
const commentFilePattern = /^[\w-]+\.mdx$/
const pastedImagePattern = /^paste-[\w-]+\.(png|jpe?g|gif|webp)$/
const maxImageBytes = 10 * 1024 * 1024

function requiredField(form: FormData, name: string) {
  const value = form.get(name)
  if (typeof value !== 'string' || value === '') throw new RejectedRequest(400, `缺少 ${name}`)
  return value
}

/**
 * 网页上写的评论原样存成 MDX，能写组件，也能在评论里 export 一个组件再用。
 * 先编译一遍：写错的 MDX 存进去，开发服务编译评论集合时整站报错，所以编译不过就拒绝，回第几行第几列哪里错。
 * 这里只用默认配置编译做校验，和宿主站点的 fumadocs-mdx 集合配置（remark、rehype 插件）的对齐还没做：
 * 宿主集合多配的插件在这里编译得过、到了集合编译不过的情况仍可能漏进文件
 */
async function bodyOf(form: FormData) {
  const body = requiredField(form, 'body').replace(/\r\n/g, '\n').trim()
  if (body === '') throw new RejectedRequest(400, '评论是空的')
  try {
    await compile(body)
  } catch (error) {
    const { line, column, reason } = error as { line?: number; column?: number; reason?: string }
    const place = line === undefined ? '' : `第 ${line} 行第 ${column} 列：`
    throw new RejectedRequest(400, `评论按 MDX 编译不过，${place}${reason ?? String(error)}。要写字面的 < 或 {，写成 \\< 、\\{ 或放进反引号里`)
  }
  return body
}

function yamlString(value: string) {
  return JSON.stringify(value)
}

function frontmatterOf(fields: Record<string, string | CommentRange | CommentRange[] | undefined>) {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? yamlString(value) : JSON.stringify(value)}`)
  return `---\n${lines.join('\n')}\n---\n`
}

/** 新评论串的文件夹名：日期加几个随机字母数字，不会和别人同时写的撞上 */
function newThreadId(now: Date) {
  return `${now.toISOString().slice(0, 10)}-${randomBytes(3).toString('hex')}`
}

/** 一条回复的文件名：时间加随机字母数字，按名字排就是按时间排 */
function newReplyFile(now: Date) {
  return `${now.toISOString().slice(0, 19).replace(/[-:]/g, '').toLowerCase()}-${randomBytes(2).toString('hex')}.mdx`
}

/** 新评论串批的位置：frontmatter 里写的几项，加上要存成 snapshot.txt 的页面文字；批整页时都没有 */
type NewAnchor = { fields: AnchorFieldsWithRange | Record<string, never>; snapshot?: string }
type AnchorFieldsWithRange = ({ quote: string; range: CommentRange } | { element: CommentElementKind; range: CommentRange }) & { openers?: CommentRange[] }

const anchorShapes = '{ quote, range, snapshot, openers? }、{ element, range, snapshot, openers? }、{ quote, occurrence } 或 {}'

/** 一页渲染出的 HTML：默认向开发服务自己请求这一页，测试与宿主里换成别的 */
export type PageHtmlOf = (page: string) => Promise<string>

async function fetchedPageHtml(url: URL) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`取页面 ${url.pathname} 的 HTML 失败：开发服务回了 ${response.status}`)
  return response.text()
}

/** quote 在 text 里每一处的开头位置；相互重叠的也各算一处 */
function startsOfQuote(quote: string, text: string) {
  const starts: number[] = []
  for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1)) starts.push(at)
  return starts
}

/** agent 传来的 { quote, occurrence }：agent 拿不到页面文字，由服务端取这一页的页面文字，在里面找第 occurrence 处 quote */
async function anchorOfOccurrence(anchor: Record<string, unknown>, page: string, pageHtmlOf: PageHtmlOf): Promise<NewAnchor> {
  const { quote, occurrence } = anchor
  if (Object.keys(anchor).length !== 2 || typeof quote !== 'string' || quote.trim() === '') throw new RejectedRequest(400, `anchor 要是 ${anchorShapes}`)
  if (!Number.isInteger(occurrence) || (occurrence as number) < 1) throw new RejectedRequest(400, 'anchor.occurrence 要是从 1 数的整数')
  const snapshot = pageTextOfHtml(await pageHtmlOf(page))
  const starts = startsOfQuote(quote, snapshot)
  const start = starts[(occurrence as number) - 1]
  if (start === undefined) throw new RejectedRequest(400, `这一页的文字里没有第 ${occurrence as number} 处「${quote}」，一共有 ${starts.length} 处`)
  return checkedAgainstSnapshot({ quote, range: [start, start + quote.length] }, snapshot)
}

function checkedAgainstSnapshot(fields: AnchorFieldsWithRange, snapshot: string): NewAnchor {
  const mismatch = snapshotMismatchOf(fields, snapshot)
  if (mismatch) throw new RejectedRequest(400, `anchor 对不上：${mismatch}`)
  return { fields, snapshot }
}

/**
 * 传来的 anchor：网页传 { quote, range, snapshot }（批一段文字）、{ element, range, snapshot }（批一个元素）或 {}（批整页）；
 * agent 传 { quote, occurrence }（批这一页上第 occurrence 处 quote）
 */
async function anchorOf(form: FormData, page: string, pageHtmlOf: PageHtmlOf): Promise<NewAnchor> {
  let anchor: unknown
  try {
    anchor = JSON.parse(requiredField(form, 'anchor'))
  } catch (error) {
    if (error instanceof RejectedRequest) throw error
    throw new RejectedRequest(400, 'anchor 不是 JSON')
  }
  if (typeof anchor !== 'object' || anchor === null) throw new RejectedRequest(400, `anchor 要是 ${anchorShapes}`)
  if (Object.keys(anchor).length === 0) return { fields: {} }
  if ('occurrence' in anchor) return anchorOfOccurrence(anchor as Record<string, unknown>, page, pageHtmlOf)
  const { quote, element, range, snapshot, openers } = anchor as Record<string, unknown>
  if (!isCommentRange(range)) throw new RejectedRequest(400, 'anchor.range 要是 [start, end]，start 小于 end')
  if (typeof snapshot !== 'string' || snapshot.includes('\r')) throw new RejectedRequest(400, 'anchor.snapshot 要是页面文字，换行只用 \\n')
  if (openers !== undefined && !isCommentOpeners(openers)) throw new RejectedRequest(400, 'anchor.openers 要是 [[start, end], …]，至少一个')
  const fields: AnchorFieldsWithRange | undefined =
    typeof quote === 'string' && quote.trim() !== ''
      ? { quote, range }
      : commentElementKinds.includes(element as CommentElementKind)
        ? { element: element as CommentElementKind, range }
        : undefined
  if (!fields) throw new RejectedRequest(400, `anchor 要是 ${anchorShapes}`)
  if (openers !== undefined) fields.openers = openers
  return checkedAgainstSnapshot(fields, snapshot)
}

/** 不挂在页面上的评论：anchor 不给或给 {} */
function noPageAnchorOf(form: FormData): NewAnchor {
  const anchor = form.get('anchor')
  if (anchor !== null && anchor !== '{}') throw new RejectedRequest(400, '不挂在页面上的评论没有 anchor：要批页面上的地方，给 page')
  return { fields: {} }
}

async function exists(file: string) {
  return stat(file).then(
    () => true,
    () => false,
  )
}

/** 粘贴的图片：文件名由网页起（正文里已经引用了它），写进评论串的文件夹，同名的已经在就拒绝 */
async function writePastedImages(form: FormData, threadDir: string) {
  for (const image of form.getAll('image')) {
    if (!(image instanceof File)) throw new RejectedRequest(400, 'image 要是文件')
    if (!pastedImagePattern.test(image.name)) throw new RejectedRequest(400, `图片名 ${image.name} 不对：要是 paste-….png/jpg/gif/webp`)
    if (image.size > maxImageBytes) throw new RejectedRequest(413, `图片 ${image.name} 超过 10 MB`)
    const target = path.join(threadDir, image.name)
    if (await exists(target)) throw new RejectedRequest(409, `图片 ${image.name} 已经有了`)
    await writeFile(target, Buffer.from(await image.arrayBuffer()))
  }
}

async function threadDirOf(commentsDir: string, form: FormData) {
  const thread = requiredField(form, 'thread')
  if (!threadIdPattern.test(thread)) throw new RejectedRequest(400, `评论串名 ${thread} 不对`)
  const dir = path.join(commentsDir, thread)
  if (!(await exists(dir))) throw new RejectedRequest(404, `没有评论串 ${thread}`)
  return { thread, dir }
}

async function threadHeadFile(dir: string) {
  const heads = (await readdir(dir)).filter((file) => isThreadHeadFile(file))
  if (heads.length !== 1) throw new RejectedRequest(500, `${dir} 里发起的那条要正好一个，现在有 ${heads.length} 个`)
  return path.join(dir, heads[0]!)
}

async function commentFileOf(dir: string, form: FormData) {
  const file = requiredField(form, 'file')
  if (!commentFilePattern.test(file)) throw new RejectedRequest(400, `评论文件名 ${file} 不对`)
  const target = path.join(dir, file)
  if (!(await exists(target))) throw new RejectedRequest(404, `没有评论 ${file}`)
  return target
}

/** 评论文件拆成 frontmatter（含首尾两行 ---）与正文 */
function splitComment(source: string, file: string) {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(source)
  if (!match) throw new RejectedRequest(500, `${file} 开头没有 frontmatter`)
  return { frontmatter: match[0].replace(/\r\n/g, '\n'), body: source.slice(match[0].length).replace(/^\r?\n/, '') }
}

/** frontmatter 里某一项的值：评论文件可能是人或 agent 手写的，引号可有可无 */
function frontmatterValue(frontmatter: string, key: string) {
  const raw = new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, 'm').exec(frontmatter)?.[1]
  if (raw === undefined) return undefined
  if (raw.startsWith('"')) return JSON.parse(raw) as string
  if (raw.startsWith("'")) return raw.slice(1, -1).replace(/''/g, "'")
  return raw
}

async function assertAuthor(file: string, actor: Person, action: string) {
  const { frontmatter } = splitComment(await readFile(file, 'utf8'), file)
  const author = frontmatterValue(frontmatter, 'author')
  if (author !== actor.id) throw new RejectedRequest(403, `只有作者 ${author} 能${action}这条评论`)
}

/** frontmatter 里改掉、去掉几项，其余照原样留着 */
function withFrontmatterFields(frontmatter: string, changes: Record<string, string | undefined>) {
  const keys = Object.keys(changes)
  const kept = frontmatter
    .split('\n')
    .slice(1, -2)
    .filter((line) => !keys.some((key) => line.startsWith(`${key}:`)))
  const added = Object.entries(changes)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${yamlString(value!)}`)
  return `---\n${[...kept, ...added].join('\n')}\n---\n`
}

export type CommentRequestOptions = {
  /** 写评论的人（宿主服务端解析好的本机身份，身份包 siteIdentity().person）；只读时传 null，接口直接 403 */
  commenter: Commenter | null
  /** 站点人员列表（身份包 sitePeople 读出来）：agent 用 as 说明自己是谁时在这里找 */
  people: readonly Person[]
  /** 站点全部页面的地址：新评论串批的页面要在里面，或在 commentRoutes 下 */
  pageUrls: readonly string[]
  /** 功能包里标了 comments 的路由的 path，这些路由下的页面也能批 */
  commentRoutes?: readonly string[]
  /** 评论目录，默认是站点目录下的 comments */
  commentsDir?: string
  /** 一页渲染出的 HTML，anchor 是 { quote, occurrence } 时用它算页面文字；默认向开发服务自己请求这一页 */
  pageHtmlOf?: PageHtmlOf
  /** 站点的完整 origin（如 http://127.0.0.1:4430），宿主的可信配置传入：authorizeWrite 按 it 核对请求的 Origin，也是默认 pageHtmlOf 请求的起点 */
  siteOrigin: string
}

async function handleForm(form: FormData, actor: Person, { pageUrls, commentRoutes, commentsDir, pageHtmlOf }: { pageUrls: readonly string[]; commentRoutes: readonly string[]; commentsDir: string; pageHtmlOf: PageHtmlOf }) {
  const operation = requiredField(form, 'op') as CommentOperation
  if (!operations.includes(operation)) throw new RejectedRequest(400, `op 要是 ${operations.join('、')} 之一`)
  const now = new Date()
  const createdAt = now.toISOString()

  if (operation === 'create') {
    const pageField = form.get('page')
    const page = typeof pageField === 'string' && pageField !== '' ? pageField : undefined
    if (page !== undefined && !commentablePagesOf(pageUrls, commentRoutes)(page)) throw new RejectedRequest(400, `没有页面 ${page}`)
    const anchor: NewAnchor = page === undefined ? noPageAnchorOf(form) : await anchorOf(form, page, pageHtmlOf)
    const body = await bodyOf(form)
    const thread = newThreadId(now)
    const dir = path.join(commentsDir, thread)
    await mkdir(dir, { recursive: true })
    await writePastedImages(form, dir)
    if (anchor.snapshot !== undefined) await writeFile(path.join(dir, commentSnapshotFile), anchor.snapshot)
    await writeFile(path.join(dir, 'index.mdx'), `${frontmatterOf({ author: actor.id, createdAt, page, status: 'open', ...anchor.fields })}\n${body}\n`)
    return { thread, file: 'index.mdx' }
  }

  const { thread, dir } = await threadDirOf(commentsDir, form)
  if (operation === 'reply') {
    const body = await bodyOf(form)
    await writePastedImages(form, dir)
    const file = newReplyFile(now)
    await writeFile(path.join(dir, file), `${frontmatterOf({ author: actor.id, createdAt })}\n${body}\n`)
    return { thread, file }
  }
  if (operation === 'resolve' || operation === 'reopen') {
    const head = await threadHeadFile(dir)
    const { frontmatter, body } = splitComment(await readFile(head, 'utf8'), head)
    const changes = operation === 'resolve' ? { status: 'resolved', resolvedBy: actor.id, resolvedAt: createdAt } : { status: 'open', resolvedBy: undefined, resolvedAt: undefined }
    await writeFile(head, `${withFrontmatterFields(frontmatter, changes)}\n${body}`)
    return { thread, file: path.basename(head) }
  }
  const target = await commentFileOf(dir, form)
  if (operation === 'edit') {
    await assertAuthor(target, actor, '编辑')
    const body = await bodyOf(form)
    await writePastedImages(form, dir)
    const { frontmatter } = splitComment(await readFile(target, 'utf8'), target)
    await writeFile(target, `${frontmatter}\n${body}\n`)
    return { thread, file: path.basename(target) }
  }
  // 删除：删发起的那条就是删整串，只有发起人能删
  await assertAuthor(target, actor, '删除')
  if (isThreadHeadFile(target)) await rm(dir, { recursive: true })
  else await rm(target)
  return { thread, file: path.basename(target) }
}

/**
 * 评论接口的 POST：项目 routes.ts 里 route('api/comments', …) 的 action 调它。
 * 表单字段：op（create、reply、edit、delete、resolve、reopen）、page 与 anchor（create；不给 page 是不挂在页面上的评论）、thread、file（edit、delete）、body、image（粘贴的图片，可多个），
 * as（agent 说明自己是 people.json 里哪个 agent；人不带，身份取本机的身份码）。
 * anchor 是网页传的 { quote, range, snapshot, openers? }、{ element, range, snapshot, openers? }、{}，或 agent 传的 { quote, occurrence }（occurrence 从 1 数）。
 * 网页传来的 snapshot 是页面文字的快照；agent 那种由服务端取这一页渲染出的 HTML 算出页面文字当快照。快照存成评论串文件夹里的 snapshot.txt。
 * 谁在操作由身份包的 authorizeWrite 统一校验：核对请求的 Origin 与 siteOrigin 精确匹配、as 只允许已登记的 agent（as 不是字符串按坏请求 400，空字符串按未知 id 400，只有缺省才以本人身份执行）。
 * 这里只保留作者编辑、删除的权限检查。只改 comments/ 里的文件，不碰 git；开发服务看到文件变了自己刷新页面
 */
export async function commentRequestResponse(request: Request, options: CommentRequestOptions): Promise<Response> {
  const { commenter } = options
  if (!commenter) return new Response('这个站只读：评论在本机的开发服务里写', { status: 403 })
  const commentsDir = options.commentsDir ?? path.resolve(process.cwd(), 'comments')
  const pageHtmlOf = options.pageHtmlOf ?? ((page: string) => fetchedPageHtml(new URL(page, options.siteOrigin)))
  try {
    const form = await request.formData()
    const as = form.get('as')
    if (as !== null && typeof as !== 'string') throw new RejectedRequest(400, 'as 要是 people.json 里一个 agent 的 id')
    const actor = authorizeWrite(request, {
      identity: { person: commenter },
      people: options.people,
      as: as ?? undefined,
      origin: options.siteOrigin,
    })
    const result = await handleForm(form, actor, { pageUrls: options.pageUrls, commentRoutes: options.commentRoutes ?? [], commentsDir, pageHtmlOf })
    return Response.json(result)
  } catch (error) {
    if (error instanceof WriteAccessError) return new Response(error.message, { status: error.status })
    if (error instanceof RejectedRequest) return new Response(error.message, { status: error.status })
    throw error
  }
}

/**
 * 一页上各评论串的页面文字快照，按评论串文件夹名：内容页路由的 loader 调它，传给 PageComments。
 * 批整页的评论串没有快照。快照缺了、frontmatter 的 range 或 quote 和快照对不上时报错，一次列出全部。
 * 读出来统一成 \n 换行：git 在 Windows 上取出文件时可能把换行改成 \r\n，位置就差了
 */
export async function commentSnapshotsOf(
  threads: ReadonlyArray<{ id: string; head: Pick<CommentThreadFrontmatter, 'quote' | 'range' | 'openers'> }>,
  commentsDir = path.resolve(process.cwd(), 'comments'),
): Promise<Record<string, string>> {
  const snapshots: Record<string, string> = {}
  const problems: string[] = []
  for (const { id, head } of threads) {
    if (!head.range) continue
    const file = path.join(commentsDir, id, commentSnapshotFile)
    if (!(await exists(file))) {
      problems.push(`评论串 ${id} 写了 range，但文件夹里没有 ${commentSnapshotFile}`)
      continue
    }
    const snapshot = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n')
    const mismatch = snapshotMismatchOf(head, snapshot)
    if (mismatch) problems.push(`评论串 ${id}：${mismatch}`)
    else snapshots[id] = snapshot
  }
  if (problems.length > 0) throw new Error(problems.join('\n'))
  return snapshots
}

/** 评论接口的 GET：编辑时取一条评论的原文（不含 frontmatter）。查询参数 thread、file */
export async function commentSourceResponse(request: Request, commentsDir = path.resolve(process.cwd(), 'comments')): Promise<Response> {
  const params = new URL(request.url).searchParams
  const form = new FormData()
  for (const key of ['thread', 'file']) form.set(key, params.get(key) ?? '')
  try {
    const { dir } = await threadDirOf(commentsDir, form)
    const target = await commentFileOf(dir, form)
    const { body } = splitComment(await readFile(target, 'utf8'), target)
    return new Response(body.trimEnd(), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } })
  } catch (error) {
    if (error instanceof RejectedRequest) return new Response(error.message, { status: error.status })
    throw error
  }
}
