import path from 'node:path'
import type { GwbContext } from '@godcreator/gwb-kernel-desktop'
import { listComments, writeComment, type CommentFilter, type CommentWrite } from './comments.js'
import { DocsiteRejected, messageOf } from './errors.js'
import type { GwbDocsiteApi } from './service.js'
import { siteKeyOf, type SiteStatus } from './site-host.js'

type Args = Record<string, unknown>

function argsOf(value: unknown, allowed: readonly string[]): Args {
  if (value === undefined || value === null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) throw new DocsiteRejected('参数要是一个对象')
  const unknownKeys = Object.keys(value).filter((key) => !allowed.includes(key))
  if (unknownKeys.length > 0) throw new DocsiteRejected(`认不出参数 ${unknownKeys.join('、')}，能给的只有 ${allowed.join('、') || '（无参数）'}`)
  return value as Args
}

function requiredString(args: Args, key: string): string {
  const value = args[key]
  if (typeof value !== 'string' || value.trim() === '') throw new DocsiteRejected(`缺少 ${key}，要是非空字符串`)
  return value
}

function optionalString(args: Args, key: string): string | undefined {
  const value = args[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.trim() === '') throw new DocsiteRejected(`${key} 要是非空字符串`)
  return value
}

/** dir 是站点目录的绝对路径 */
function dirOf(args: Args): string {
  const dir = requiredString(args, 'dir')
  if (!path.isAbsolute(dir)) throw new DocsiteRejected(`dir 要是站点目录的绝对路径，读到 ${dir}`)
  return path.resolve(dir)
}

type Handler = (args: unknown) => Promise<unknown>

type GwbCommandsApi = NonNullable<GwbContext['gwbCommands']>

export type CommandServices = {
  commands: GwbCommandsApi
  docsite: GwbDocsiteApi
  /** 设置 sites：docsite.site.add 登记的站点目录 */
  sitesSetting: { get(): string[]; set(dirs: string[]): Promise<void> }
  list(): SiteStatus[]
}

function register(commands: GwbCommandsApi, definition: { name: string; description: string; usage: string; effect: 'read' | 'write' | 'external' }, handler: Handler) {
  commands.register(definition, async (args: unknown) => {
    try {
      return { ok: true, data: await handler(args) }
    } catch (error) {
      if (error instanceof DocsiteRejected) return { ok: false, error: error.message }
      throw error
    }
  })
}

const siteShape =
  '每个站是 { dir, url, expectedUrl, running, kept, error }：url 在运行时是实际地址；expectedUrl 是按 package.json 的 scripts.dev 里的 --port 预期的地址（没写端口为 null）；kept 是托管着（常驻）；error 是常驻失败停下、启动前就失败（不是站点目录、没装依赖、站点检查不过）的原因，没有为 null'

const commentWriteUsage =
  '要站点在运行（经开发服务的评论接口写，和网页同一套规则：正文是 MDX，编译不过就拒绝）；署名是本 home 的身份码在 people.json 里对应的人，agent 写时给 as（people.json 里 agent 为 true 的 id）'

export function registerCommands({ commands, docsite, sitesSetting, list }: CommandServices): void {
  const urlOfRunning = (dir: string) => {
    const status = docsite.status(dir)
    if (!status.running || status.url === null) throw new DocsiteRejected(`${dir} 的站点没在运行：先 docsite.site.start`)
    return status.url
  }

  register(
    commands,
    { name: 'docsite.identity', description: '本 home 的身份码：站点的 people.json 里按它认出「我是谁」', usage: '无参数。回 { code }：设置 identity-code 的值，插件第一次加载时生成；换电脑时把旧的码填进新电脑的设置', effect: 'read' },
    async (args) => {
      argsOf(args, [])
      return { code: docsite.identityCode() }
    },
  )

  register(
    commands,
    { name: 'docsite.site.list', description: '列出托管着的站点与各自的状态', usage: `无参数。回 { sites }。${siteShape}`, effect: 'read' },
    async (args) => {
      argsOf(args, [])
      return { sites: list() }
    },
  )

  register(
    commands,
    {
      name: 'docsite.site.add',
      description: '托管一个站点：登记进设置 sites，开发服务常驻（插件每次加载时启动）',
      usage: `{ dir }：站点目录的绝对路径，要有 package.json（scripts.dev 写死 --port）、装好依赖、有 people.json。已经登记过的只回它此刻的样子。别的插件（如 gwb-collab）托管的站点不经这里。回这个站。${siteShape}`,
      effect: 'write',
    },
    async (args) => {
      const dir = dirOf(argsOf(args, ['dir']))
      const listed = sitesSetting.get()
      if (!listed.some((each) => siteKeyOf(each) === siteKeyOf(dir))) await sitesSetting.set([...listed, dir])
      await docsite.keep(dir)
      return docsite.status(dir)
    },
  )

  register(
    commands,
    { name: 'docsite.site.remove', description: '不再托管一个站点：停掉它、从设置 sites 里去掉', usage: '{ dir }：docsite.site.add 登记过的站点目录，没登记过就拒绝。回 { dir, removed: true }', effect: 'write' },
    async (args) => {
      const dir = dirOf(argsOf(args, ['dir']))
      const listed = sitesSetting.get()
      if (!listed.some((each) => siteKeyOf(each) === siteKeyOf(dir))) throw new DocsiteRejected(`${dir} 不在设置 sites 里：别的插件托管的站点由那个插件管`)
      await sitesSetting.set(listed.filter((each) => siteKeyOf(each) !== siteKeyOf(dir)))
      await docsite.forget(dir)
      return { dir, removed: true }
    },
  )

  register(
    commands,
    {
      name: 'docsite.site.start',
      description: '启动并打开一个站点（默认用 Chrome 的应用窗口，见设置 site-window）',
      usage: '{ dir, open? }：站点目录的绝对路径；open 默认 true，false 只启动不打开。人为停止、连续失败停下的也用它再启动（清掉这两种记录）；已经在运行就只打开；Chrome 应用窗口已经开着就试着切到前台，Windows 不让切时窗口留在原处、任务栏按钮闪烁，照常回执。启动前查站点（装没装依赖、人员列表与评论文件对不对），不过就拒绝、写明每条问题。回 { url, pid, alreadyRunning }',
      effect: 'external',
    },
    async (args) => {
      const parsed = argsOf(args, ['dir', 'open'])
      const dir = dirOf(parsed)
      if (parsed['open'] !== undefined && typeof parsed['open'] !== 'boolean') throw new DocsiteRejected('open 要是 true 或 false')
      try {
        return parsed['open'] === false ? await docsite.start(dir) : await docsite.open(dir)
      } catch (error) {
        throw new DocsiteRejected(messageOf(error))
      }
    },
  )

  register(
    commands,
    { name: 'docsite.site.stop', description: '停掉一个站点的开发服务，这次加载期间不再自动启动', usage: '{ dir }：站点目录的绝对路径；没在运行就拒绝。回 { url }', effect: 'write' },
    async (args) => docsite.stop(dirOf(argsOf(args, ['dir']))),
  )

  register(
    commands,
    {
      name: 'docsite.people.join',
      description: '把本 home 的身份码加进站点的 people.json，之后在这个站上写的评论署这个人',
      usage: '{ dir, id, name, gitea? }：dir 是站点目录的绝对路径；id 只用字母、数字、_、-。people.json 里已有这个 id 就把码加进它的 codes（gitea 给了就核对或补上），没有就新加一项。码已经在别人名下、id 是 agent 时拒绝。只写文件、不提交。回 { changed }：false 是本来就在',
      effect: 'write',
    },
    async (args) => {
      const parsed = argsOf(args, ['dir', 'id', 'name', 'gitea'])
      const gitea = optionalString(parsed, 'gitea')
      return docsite.join(dirOf(parsed), { id: requiredString(parsed, 'id'), name: requiredString(parsed, 'name'), ...(gitea ? { gitea } : {}) })
    },
  )

  register(
    commands,
    {
      name: 'docsite.comments',
      description: '列出站点上的评论（只读，读文件，不要站点在运行）',
      usage:
        "{ dir, page?, status?, about? }：page 是页面地址（如 /writing），给了只列批那一页的；status 是 open / resolved；about 是人员 id，给了只列和他有关的（他发起的、回复过的、正文里 @ 了他的）。回 { threads }：每串 { id, author, createdAt, page?, status, quote?, element?, range?, openers?, resolvedBy?, resolvedAt?, file, body, mentions, replies }，page 没有的是不挂在页面上的评论；body 是 MDX 原文；replies 每条 { file, author, createdAt, body, mentions }，按时间排；文件在站点目录的 comments/<id>/ 里",
      effect: 'read',
    },
    async (args) => {
      const parsed = argsOf(args, ['dir', 'page', 'status', 'about'])
      const status = parsed['status']
      if (status !== undefined && status !== 'open' && status !== 'resolved') throw new DocsiteRejected('status 要是 open 或 resolved')
      const filter: CommentFilter = {}
      const page = optionalString(parsed, 'page')
      const about = optionalString(parsed, 'about')
      if (page) filter.page = page
      if (status) filter.status = status
      if (about) filter.about = about
      return { threads: await listComments(dirOf(parsed), filter) }
    },
  )

  register(
    commands,
    {
      name: 'docsite.comment.create',
      description: '在站点上发起一串评论：批页面上的一段字、批整页，或不挂在页面上',
      usage: `{ dir, body, page?, quote?, occurrence?, as? }：不给 page 是不挂在页面上的评论（只在全部评论页 /comments 上）；给 page 不给 quote 是批整页；给 quote 是批这一页文字里第 occurrence 处（从 1 数，默认 1）这段字。${commentWriteUsage}。回 { thread, file }`,
      effect: 'write',
    },
    async (args) => {
      const parsed = argsOf(args, ['dir', 'body', 'page', 'quote', 'occurrence', 'as'])
      const occurrence = parsed['occurrence']
      if (occurrence !== undefined && !Number.isInteger(occurrence)) throw new DocsiteRejected('occurrence 要是从 1 数的整数')
      const page = optionalString(parsed, 'page')
      const quote = optionalString(parsed, 'quote')
      if (quote !== undefined && page === undefined) throw new DocsiteRejected('给了 quote 就要给 page：批的是哪一页')
      const as = optionalString(parsed, 'as')
      const write: CommentWrite = { op: 'create', body: requiredString(parsed, 'body'), ...(page ? { page } : {}), ...(quote ? { quote } : {}), ...(occurrence !== undefined ? { occurrence: occurrence as number } : {}), ...(as ? { as } : {}) }
      const dir = dirOf(parsed)
      return writeComment(urlOfRunning(dir), write)
    },
  )

  register(
    commands,
    { name: 'docsite.comment.reply', description: '回复站点上的一串评论', usage: `{ dir, thread, body, as? }：thread 是评论串的文件夹名（docsite.comments 回的 id）。${commentWriteUsage}。回 { thread, file }`, effect: 'write' },
    async (args) => {
      const parsed = argsOf(args, ['dir', 'thread', 'body', 'as'])
      const as = optionalString(parsed, 'as')
      const dir = dirOf(parsed)
      return writeComment(urlOfRunning(dir), { op: 'reply', thread: requiredString(parsed, 'thread'), body: requiredString(parsed, 'body'), ...(as ? { as } : {}) })
    },
  )

  for (const op of ['resolve', 'reopen'] as const) {
    register(
      commands,
      {
        name: `docsite.comment.${op}`,
        description: op === 'resolve' ? '把站点上的一串评论标为已解决' : '把站点上一串已解决的评论重新打开',
        usage: `{ dir, thread, as? }：thread 是评论串的文件夹名。${commentWriteUsage}。回 { thread, file }`,
        effect: 'write',
      },
      async (args) => {
        const parsed = argsOf(args, ['dir', 'thread', 'as'])
        const as = optionalString(parsed, 'as')
        const dir = dirOf(parsed)
        return writeComment(urlOfRunning(dir), { op, thread: requiredString(parsed, 'thread'), ...(as ? { as } : {}) })
      },
    )
  }
}
