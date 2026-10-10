import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import {
  commentBlockKinds,
  commentSnapshotFile,
  isCommentRange,
  isThreadHeadFile,
  snapshotMismatchOf,
  type CommentBlockKind,
  type Commenter,
  type CommentRange,
  type CommentThreadFrontmatter,
} from '../comments.js'

const commenterOfDir = new Map<string, Promise<Commenter>>()

/** 本机 git 的 user.name 当作写评论的人；没设时报错，写明怎么设 */
export function currentCommenter(cwd = process.cwd()): Promise<Commenter> {
  let commenter = commenterOfDir.get(cwd)
  if (!commenter) {
    commenter = promisify(execFile)('git', ['config', 'user.name'], { cwd }).then(
      ({ stdout }) => {
        const name = stdout.trim()
        if (name === '') throw new Error('git 的 user.name 是空的：运行 git config --global user.name "你的名字"')
        return { name }
      },
      (error: unknown) => {
        commenterOfDir.delete(cwd)
        throw new Error(`读不到 git 的 user.name，评论不知道是谁写的：运行 git config --global user.name "你的名字"（${String(error)}）`)
      },
    )
    commenterOfDir.set(cwd, commenter)
  }
  return commenter
}

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
const commentFilePattern = /^[\w-]+\.mdx?$/
const pastedImagePattern = /^paste-[\w-]+\.(png|jpe?g|gif|webp)$/
const maxImageBytes = 10 * 1024 * 1024

function requiredField(form: FormData, name: string) {
  const value = form.get(name)
  if (typeof value !== 'string' || value === '') throw new RejectedRequest(400, `缺少 ${name}`)
  return value
}

/**
 * 网页上写的评论按纯文字加 Markdown 存：< 转义成 &lt;，打出来的 <code> 照原样显示，不被当成 HTML 标签吞掉。
 * 编辑时取原文再换回来（commentSourceResponse）
 */
function bodyOf(form: FormData) {
  const body = requiredField(form, 'body').replace(/\r\n/g, '\n').trim()
  if (body === '') throw new RejectedRequest(400, '评论是空的')
  return body.replace(/</g, '&lt;')
}

function yamlString(value: string) {
  return JSON.stringify(value)
}

function frontmatterOf(fields: Record<string, string | CommentRange | undefined>) {
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
  return `${now.toISOString().slice(0, 19).replace(/[-:]/g, '').toLowerCase()}-${randomBytes(2).toString('hex')}.md`
}

/** 新评论串批的位置：frontmatter 里写的几项，加上要存成 snapshot.txt 的页面文字；批整页时都没有 */
type NewAnchor = { fields: { quote: string; range: CommentRange } | { block: CommentBlockKind; range: CommentRange } | Record<string, never>; snapshot?: string }

const anchorShapes = '{ quote, range, snapshot }、{ block, range, snapshot } 或 {}'

/** 网页传来的 anchor：{ quote, range, snapshot }（批一段文字）、{ block, range, snapshot }（批一整块）或 {}（批整页） */
function anchorOf(form: FormData): NewAnchor {
  let anchor: unknown
  try {
    anchor = JSON.parse(requiredField(form, 'anchor'))
  } catch (error) {
    if (error instanceof RejectedRequest) throw error
    throw new RejectedRequest(400, 'anchor 不是 JSON')
  }
  if (typeof anchor !== 'object' || anchor === null) throw new RejectedRequest(400, `anchor 要是 ${anchorShapes}`)
  if (Object.keys(anchor).length === 0) return { fields: {} }
  const { quote, block, range, snapshot } = anchor as Record<string, unknown>
  if (!isCommentRange(range)) throw new RejectedRequest(400, 'anchor.range 要是 [start, end]，start 小于 end')
  if (typeof snapshot !== 'string' || snapshot.includes('\r')) throw new RejectedRequest(400, 'anchor.snapshot 要是页面文字，换行只用 \\n')
  const fields = typeof quote === 'string' && quote.trim() !== '' ? { quote, range } : commentBlockKinds.includes(block as CommentBlockKind) ? { block: block as CommentBlockKind, range } : undefined
  if (!fields) throw new RejectedRequest(400, `anchor 要是 ${anchorShapes}`)
  const mismatch = snapshotMismatchOf(fields, snapshot)
  if (mismatch) throw new RejectedRequest(400, `anchor 对不上：${mismatch}`)
  return { fields, snapshot }
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

async function assertAuthor(file: string, commenter: Commenter, action: string) {
  const { frontmatter } = splitComment(await readFile(file, 'utf8'), file)
  const author = frontmatterValue(frontmatter, 'author')
  if (author !== commenter.name) throw new RejectedRequest(403, `只有作者 ${author} 能${action}这条评论`)
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

type CommentRequestOptions = {
  /** 写评论的人；发布站传 null，只读 */
  commenter: Commenter | null
  /** 站点全部页面的地址：新评论串批的页面要在里面 */
  pageUrls: readonly string[]
  /** 评论目录，默认是站点目录下的 comments */
  commentsDir?: string
}

async function handleForm(form: FormData, { commenter, pageUrls, commentsDir }: Required<CommentRequestOptions> & { commenter: Commenter }) {
  const operation = requiredField(form, 'op') as CommentOperation
  if (!operations.includes(operation)) throw new RejectedRequest(400, `op 要是 ${operations.join('、')} 之一`)
  const now = new Date()
  const createdAt = now.toISOString()

  if (operation === 'create') {
    const page = requiredField(form, 'page')
    if (!pageUrls.includes(page)) throw new RejectedRequest(400, `没有页面 ${page}`)
    const anchor = anchorOf(form)
    const body = bodyOf(form)
    const thread = newThreadId(now)
    const dir = path.join(commentsDir, thread)
    await mkdir(dir, { recursive: true })
    await writePastedImages(form, dir)
    if (anchor.snapshot !== undefined) await writeFile(path.join(dir, commentSnapshotFile), anchor.snapshot)
    await writeFile(path.join(dir, 'index.md'), `${frontmatterOf({ author: commenter.name, createdAt, page, status: 'open', ...anchor.fields })}\n${body}\n`)
    return { thread, file: 'index.md' }
  }

  const { thread, dir } = await threadDirOf(commentsDir, form)
  if (operation === 'reply') {
    const body = bodyOf(form)
    await writePastedImages(form, dir)
    const file = newReplyFile(now)
    await writeFile(path.join(dir, file), `${frontmatterOf({ author: commenter.name, createdAt })}\n${body}\n`)
    return { thread, file }
  }
  if (operation === 'resolve' || operation === 'reopen') {
    const head = await threadHeadFile(dir)
    const { frontmatter, body } = splitComment(await readFile(head, 'utf8'), head)
    const changes = operation === 'resolve' ? { status: 'resolved', resolvedBy: commenter.name, resolvedAt: createdAt } : { status: 'open', resolvedBy: undefined, resolvedAt: undefined }
    await writeFile(head, `${withFrontmatterFields(frontmatter, changes)}\n${body}`)
    return { thread, file: path.basename(head) }
  }
  const target = await commentFileOf(dir, form)
  if (operation === 'edit') {
    await assertAuthor(target, commenter, '编辑')
    const body = bodyOf(form)
    await writePastedImages(form, dir)
    const { frontmatter } = splitComment(await readFile(target, 'utf8'), target)
    await writeFile(target, `${frontmatter}\n${body}\n`)
    return { thread, file: path.basename(target) }
  }
  // 删除：删发起的那条就是删整串，只有发起人能删
  await assertAuthor(target, commenter, '删除')
  if (isThreadHeadFile(target)) await rm(dir, { recursive: true })
  else await rm(target)
  return { thread, file: path.basename(target) }
}

/**
 * 评论接口的 POST：项目 routes.ts 里 route('api/comments', …) 的 action 调它。
 * 表单字段：op（create、reply、edit、delete、resolve、reopen）、page 与 anchor（create）、thread、file（edit、delete）、body、image（粘贴的图片，可多个）。
 * anchor 里带着页面文字的快照，存成评论串文件夹里的 snapshot.txt。
 * 只改 comments/ 里的文件，不碰 git；开发服务看到文件变了自己刷新页面
 */
export async function commentRequestResponse(request: Request, options: CommentRequestOptions): Promise<Response> {
  const { commenter } = options
  if (!commenter) return new Response('这个站只读：评论在本机的开发服务里写', { status: 403 })
  const commentsDir = options.commentsDir ?? path.resolve(process.cwd(), 'comments')
  try {
    const result = await handleForm(await request.formData(), { ...options, commenter, commentsDir })
    return Response.json(result)
  } catch (error) {
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
  threads: ReadonlyArray<{ id: string; head: Pick<CommentThreadFrontmatter, 'quote' | 'range'> }>,
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
    return new Response(body.trimEnd().replace(/&lt;/g, '<'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } })
  } catch (error) {
    if (error instanceof RejectedRequest) return new Response(error.message, { status: error.status })
    throw error
  }
}
