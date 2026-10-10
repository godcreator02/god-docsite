import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { anchorTagOf, offsetOfPoint, parseCommentBlockSpec, sourceHash } from '../comment-source.js'
import { commentAnchorComponent, commentAnchorIdPattern, isThreadHeadFile, type Commenter } from '../comments.js'

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

/**
 * 这个站写评论的人：开发服务里是本机 git 的 user.name；发布出去的站（react-router-serve）只读，返回 null。
 * import.meta.env.DEV 由 Vite 编译时换掉：基础包和站点代码一起经 Vite 处理
 */
export async function siteCommenter(): Promise<Commenter | null> {
  return import.meta.env.DEV ? await currentCommenter() : null
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

function frontmatterOf(fields: Record<string, string | number | undefined>) {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? yamlString(value) : value}`)
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

/**
 * 网页传来的 target：{} 批整页；{ anchor } 批已有标记的块；{ block } 批还没有标记的块，block 是块上 data-comment-block 的值。
 * 后两种可以再带 { quote, quoteIndex }，批块里的几个字
 */
type CommentTarget = { anchor?: string; block?: string; quote?: string; quoteIndex?: number }

function targetOf(form: FormData): CommentTarget {
  let target: unknown
  try {
    target = JSON.parse(requiredField(form, 'target'))
  } catch (error) {
    if (error instanceof RejectedRequest) throw error
    throw new RejectedRequest(400, 'target 不是 JSON')
  }
  if (typeof target !== 'object' || target === null || Array.isArray(target)) throw new RejectedRequest(400, 'target 要是对象')
  const { anchor, block, quote, quoteIndex, ...rest } = target as Record<string, unknown>
  if (Object.keys(rest).length > 0) throw new RejectedRequest(400, `target 里认不出 ${Object.keys(rest).join('、')}`)
  if (anchor !== undefined && (typeof anchor !== 'string' || !commentAnchorIdPattern.test(anchor))) throw new RejectedRequest(400, 'target.anchor 要是标记的 id')
  if (block !== undefined && typeof block !== 'string') throw new RejectedRequest(400, 'target.block 要是块上 data-comment-block 的值')
  if (anchor !== undefined && block !== undefined) throw new RejectedRequest(400, 'target 里 anchor 和 block 只能写一个')
  if (quote !== undefined) {
    if (anchor === undefined && block === undefined) throw new RejectedRequest(400, 'target.quote 要和 anchor 或 block 一起写')
    if (typeof quote !== 'string' || quote.trim() === '') throw new RejectedRequest(400, 'target.quote 要是非空字符串')
    if (!Number.isInteger(quoteIndex) || (quoteIndex as number) < 1) throw new RejectedRequest(400, 'target.quoteIndex 要是从 1 数的整数')
  } else if (quoteIndex !== undefined) throw new RejectedRequest(400, 'target.quoteIndex 要和 quote 一起写')
  return { anchor, block, quote, quoteIndex } as CommentTarget
}

/** 新标记的 id：几个随机字母数字，和这一页已有的标记不重复 */
function newAnchorId(pageSource: string) {
  for (;;) {
    const id = randomBytes(3).toString('hex')
    if (!pageSource.includes(`id="${id}"`)) return id
  }
}

/**
 * 在页面源码里给这一块插上标记，返回新的源码与标记 id。块的位置与指纹由编译插件写在网页上；
 * 源码里这一块和网页打开时不一样了（文件改过、位置挪了）就拒绝，不去猜
 */
function withNewAnchor(pageSource: string, blockSpec: string, file: string) {
  const spec = parseCommentBlockSpec(blockSpec)
  if (!spec) throw new RejectedRequest(400, `target.block 写错了：${blockSpec}`)
  const start = offsetOfPoint(pageSource, spec.start)
  const end = offsetOfPoint(pageSource, spec.end)
  if (start === undefined || end === undefined || sourceHash(pageSource.slice(start, end)) !== spec.hash) {
    throw new RejectedRequest(409, `${path.basename(file)} 在网页打开以后改过了，这一块对不上：刷新页面再批`)
  }
  const id = newAnchorId(pageSource)
  if (spec.placement === 'inline') return { id, source: `${pageSource.slice(0, start)}${anchorTagOf(id)}${pageSource.slice(start)}` }
  // 单独一行插在块前面，带上和这一块第一行一样的前缀（列表里的缩进、引用的 >），不然 MDX 会认成别的结构
  const lineStart = pageSource.lastIndexOf('\n', start - 1) + 1
  const prefix = pageSource.slice(lineStart, start)
  if (!/^[ \t>]*$/.test(prefix)) throw new RejectedRequest(400, `这一块和列表符号或别的内容写在同一行（${prefix.trim()}），插不进标记：把它挪到下一行再批`)
  return { id, source: `${pageSource.slice(0, lineStart)}${prefix}${anchorTagOf(id)}\n${pageSource.slice(lineStart)}` }
}

/** 删掉页面源码里的标记：单独占一行的连这一行一起删，写在文字开头的只删标记本身；源码里已经没有它时原样返回 */
function withoutAnchor(pageSource: string, id: string) {
  const tag = anchorTagOf(id)
  const at = pageSource.indexOf(tag)
  if (at === -1) return pageSource
  const lineStart = pageSource.lastIndexOf('\n', at - 1) + 1
  const lineEnd = pageSource.indexOf('\n', at)
  const ownsLine = /^[ \t>]*$/.test(pageSource.slice(lineStart, at)) && pageSource.slice(at + tag.length, lineEnd === -1 ? undefined : lineEnd).trim() === ''
  if (ownsLine) return `${pageSource.slice(0, lineStart)}${lineEnd === -1 ? '' : pageSource.slice(lineEnd + 1)}`
  return `${pageSource.slice(0, at)}${pageSource.slice(at + tag.length)}`
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

/** 能评论的页面：地址，和它的源文件（MDX 与 TSX 页面；HTML 页面没有，只能批整页） */
export type CommentablePage = { url: string; sourceFile: string | undefined }

/**
 * 站点全部页面换成评论接口要的样子：pages 是 source.getPages()。
 * TSX 与 HTML 页面的 data.file 是 glob 给的路径（/content/…），MDX 页面的 path 相对内容目录
 */
export function commentablePagesOf(pages: ReadonlyArray<{ url: string; path: string; data: object }>, siteRoot = process.cwd(), contentDir = 'content'): CommentablePage[] {
  return pages.map((page) => {
    const file = 'file' in page.data && typeof page.data.file === 'string' ? page.data.file : undefined
    if (file === undefined) return { url: page.url, sourceFile: path.join(siteRoot, contentDir, page.path) }
    return { url: page.url, sourceFile: file.endsWith('.html') ? undefined : path.join(siteRoot, file) }
  })
}

type CommentRequestOptions = {
  /** 写评论的人；发布站传 null，只读 */
  commenter: Commenter | null
  /** 站点全部页面：新评论串批的页面要在里面；批块时在页面源文件里插标记 */
  pages: readonly CommentablePage[]
  /** 评论目录，默认是站点目录下的 comments */
  commentsDir?: string
}

function pageOf(pages: readonly CommentablePage[], url: string) {
  const page = pages.find((candidate) => candidate.url === url)
  if (!page) throw new RejectedRequest(400, `没有页面 ${url}`)
  return page
}

/**
 * 新评论串批的块：已有标记就用它（核对源文件里有这个标记）；还没有就在页面源文件里插一个，
 * 返回插好的源码，等评论文件写好再写回页面
 */
async function anchorForTarget(page: CommentablePage, target: CommentTarget) {
  if (target.anchor === undefined && target.block === undefined) return { anchor: undefined, pageSourceToWrite: undefined }
  if (!page.sourceFile) throw new RejectedRequest(400, `${page.url} 是 HTML 页面，只能批整页`)
  const pageSource = await readFile(page.sourceFile, 'utf8')
  if (target.anchor !== undefined) {
    if (!pageSource.includes(`<${commentAnchorComponent} id="${target.anchor}"`)) throw new RejectedRequest(409, `${path.basename(page.sourceFile)} 里没有标记 ${target.anchor}：刷新页面再批`)
    return { anchor: target.anchor, pageSourceToWrite: undefined }
  }
  if (!page.sourceFile.endsWith('.mdx') && !page.sourceFile.endsWith('.md')) throw new RejectedRequest(400, `${page.url} 是 TSX 页面，只能批整页和页面里手放的标记`)
  const { id, source } = withNewAnchor(pageSource, target.block!, page.sourceFile)
  return { anchor: id, pageSourceToWrite: source }
}

/** 评论目录里还有没有别的评论串引用这一页的这个标记 */
async function isAnchorStillUsed(commentsDir: string, page: string, anchor: string) {
  for (const thread of await readdir(commentsDir)) {
    const dir = path.join(commentsDir, thread)
    if (!(await stat(dir)).isDirectory()) continue
    const head = (await readdir(dir)).find((file) => isThreadHeadFile(file))
    if (!head) continue
    const { frontmatter } = splitComment(await readFile(path.join(dir, head), 'utf8'), head)
    if (frontmatterValue(frontmatter, 'page') === page && frontmatterValue(frontmatter, 'anchor') === anchor) return true
  }
  return false
}

async function handleForm(form: FormData, { commenter, pages, commentsDir }: Required<CommentRequestOptions> & { commenter: Commenter }) {
  const operation = requiredField(form, 'op') as CommentOperation
  if (!operations.includes(operation)) throw new RejectedRequest(400, `op 要是 ${operations.join('、')} 之一`)
  const now = new Date()
  const createdAt = now.toISOString()

  if (operation === 'create') {
    const page = pageOf(pages, requiredField(form, 'page'))
    const target = targetOf(form)
    const body = bodyOf(form)
    const { anchor, pageSourceToWrite } = await anchorForTarget(page, target)
    const thread = newThreadId(now)
    const dir = path.join(commentsDir, thread)
    await mkdir(dir, { recursive: true })
    await writePastedImages(form, dir)
    const fields = { author: commenter.name, createdAt, page: page.url, status: 'open', anchor, quote: target.quote, quoteIndex: target.quoteIndex }
    await writeFile(path.join(dir, 'index.md'), `${frontmatterOf(fields)}\n${body}\n`)
    if (pageSourceToWrite !== undefined) {
      try {
        await writeFile(page.sourceFile!, pageSourceToWrite)
      } catch (error) {
        // 页面写不进去，刚写的评论串就批不到东西，删掉再报错
        await rm(dir, { recursive: true })
        throw error
      }
    }
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
  // 删除：删发起的那条就是删整串，只有发起人能删；没有别的评论串再用这个标记时，连页面里的标记一起删
  await assertAuthor(target, commenter, '删除')
  if (!isThreadHeadFile(target)) {
    await rm(target)
    return { thread, file: path.basename(target) }
  }
  const { frontmatter } = splitComment(await readFile(target, 'utf8'), target)
  await rm(dir, { recursive: true })
  const anchor = frontmatterValue(frontmatter, 'anchor')
  const pageUrl = frontmatterValue(frontmatter, 'page')
  const sourceFile = pages.find((page) => page.url === pageUrl)?.sourceFile
  if (anchor !== undefined && pageUrl !== undefined && sourceFile?.match(/\.mdx?$/) && !(await isAnchorStillUsed(commentsDir, pageUrl, anchor))) {
    const pageSource = await readFile(sourceFile, 'utf8')
    const cleaned = withoutAnchor(pageSource, anchor)
    if (cleaned !== pageSource) await writeFile(sourceFile, cleaned)
  }
  return { thread, file: path.basename(target) }
}

/**
 * 评论接口的 POST：项目 routes.ts 里 route('api/comments', …) 的 action 调它。
 * 表单字段：op（create、reply、edit、delete、resolve、reopen）、page 与 target（create）、thread、file（edit、delete）、body、image（粘贴的图片，可多个）。
 * 改 comments/ 里的文件；批还没有标记的块时在页面源文件里插标记，删掉最后一个用它的评论串时把标记删掉。不碰 git；开发服务看到文件变了自己刷新页面
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
