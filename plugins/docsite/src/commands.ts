import path from 'node:path'
import { isSiteAudience } from '@godcreator/god-docsite'
import type { GwbContext } from '@godcreator/gwb-kernel-desktop'
import { listComments, writeComment, type CommentFilter, type CommentWrite } from './comments.js'
import { DocsiteRejected, messageOf } from './errors.js'
import type { SiteWindowOpened } from './chrome-app.js'
import type { GwbDocsiteApi } from './service.js'
import { siteTitleOf, type SiteListing } from './site-list.js'

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
  /** 站点目录有没有登记为常驻 */
  isRegistered(dir: string): Promise<boolean>
  list(): Promise<SiteListing[]>
  /** 用 Chrome 应用窗口打开站点首页：siteTitle 是站名，靠它认出这个站已经开着的窗口 */
  openSiteWindow(url: string, siteTitle: string | null): Promise<SiteWindowOpened>
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
  '每个站是 { dir, state, url, error }：state 是 running（进程在，url 是实际地址）、stopped（没有进程）、failed（进程退出了或没能启动，error 记退出码与最后几行输出）；url 只在 running 时有。端口不写在站点里：启动时先试这个站上次用的端口，被占了就随机挑一个五位数的空闲端口'

const listingShape =
  `${siteShape}。列表的每一行另有 title、kind、audience、hosted、by：title 是站点 content/meta.json 的 title（没有为 null）；kind 是站点根 docsite.json 写的类别 base（基础站）、docs（文档站）或 collab（协作站），audience 是它写的给谁看 personal（只有自己在本机看）或 shared（别人也会 clone 下来看），没有这个文件两项都为 null；hosted 是登记为常驻（工作台每次启动都启动它），` +
  'by 是谁登记的（docsite.site.add，或登记它的插件名，如 gwb-collab）；没登记、只是这次被启动过的站 hosted 为 false、by 为 null。常驻的站按登记先后排在前面'

const commentWriteUsage =
  '要站点在运行（POST 到站点的评论写入路由 /comments，和网页评论面板同一套规则与字段）；署名是本 home 的身份码在 people.json 里对应的人，agent 写时给 as（people.json 里 agent 为 true 的 id）'

export function registerCommands({ commands, docsite, isRegistered, list, openSiteWindow }: CommandServices): void {
  const urlOfRunning = (dir: string) => {
    const status = docsite.status(dir)
    if (status.state !== 'running' || status.url === null) throw new DocsiteRejected(`${dir} 的站点没在运行：先 docsite.site.start`)
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
    { name: 'docsite.site.list', description: '列出常驻的站点与这次被启动过的站点，各自的站名、状态、谁登记的；站点窗格显示的就是它', usage: `无参数。回 { sites }。${listingShape}`, effect: 'read' },
    async (args) => {
      argsOf(args, [])
      return { sites: await list() }
    },
  )

  register(
    commands,
    {
      name: 'docsite.site.add',
      description: '托管一个站点：登记为常驻并启动（工作台每次启动时也会启动登记着的站）',
      usage: `{ dir }：站点目录的绝对路径，要有身份文件 docsite.json（平台建站时写出）、package.json（scripts.dev 不写 --port）、装好依赖。登记记在 gwb-data 的 hosted-sites 里，登记的一方记成 docsite.site.add；已经登记过的只确保它在运行。协作站由 gwb-collab 在项目加进列表时登记，不用另外加。回这个站。${siteShape}`,
      effect: 'write',
    },
    async (args) => docsite.add(dirOf(argsOf(args, ['dir']))),
  )

  register(
    commands,
    {
      name: 'docsite.site.remove',
      description: '不再托管一个站点：去掉常驻登记，在运行就停掉',
      usage: '{ dir }：登记为常驻的站点目录，没登记过就拒绝。协作站要移出项目列表（collab.project.remove），不然 gwb-collab 下次加载又登记回来。回 { dir, removed: true }',
      effect: 'write',
    },
    async (args) => {
      const dir = dirOf(argsOf(args, ['dir']))
      if (!(await isRegistered(dir))) throw new DocsiteRejected(`${dir} 没有登记为常驻`)
      await docsite.remove(dir)
      return { dir, removed: true }
    },
  )

  register(
    commands,
    {
      name: 'docsite.site.start',
      description: '启动一个站点的开发服务（在站点目录里运行 pnpm dev，只绑本机）',
      usage:
        '{ dir }：站点目录的绝对路径。启动前核对：站点根有身份文件 docsite.json 且写对了（没有就是平台之外建的站、或有身份文件之前建的站，拒绝并写明怎么补；format 不是这一版平台认的那一代也拒绝）、node_modules 里装着 @godcreator/god-docsite、scripts.dev 没写死 --port；起不来把开发服务的输出报出来。' +
        '端口先试这个站上次用的（记在 gwb-data 里），被占了由平台的 vite 插件在 10000–49151 里随机挑一个空闲的；地址以回执的 url 为准。' +
        '启动时经环境变量交给站点本 home 的身份码（DOCSITE_IDENTITY_CODE）、这次生成的推送令牌（DOCSITE_FEED_TOKEN）与阅读字体文件的路径（DOCSITE_READER_FONTS_FILE，三项字体在设置 font-body / font-heading / font-mono 里选，改了刷新页面生效）。已在运行或正在启动就回现状。回 { url, pid, alreadyRunning }。要看页面把 url 给 VS Code 插件打开',
      effect: 'write',
    },
    async (args) => {
      const dir = dirOf(argsOf(args, ['dir']))
      try {
        return await docsite.start(dir)
      } catch (error) {
        throw new DocsiteRejected(messageOf(error))
      }
    },
  )

  register(
    commands,
    {
      name: 'docsite.site.open',
      description: '用 Chrome 的应用窗口打开一个站点（没有标签栏和地址栏）：没在运行先启动，一个站只开一个窗口；站点窗格与协作窗格的「打开」调的就是它',
      usage:
        '{ dir }：站点目录的绝对路径。先照 docsite.site.start 确保站点在运行（起不来就拒绝，报出开发服务的输出），再用本机的 Chrome 运行 chrome.exe --app=<地址>。' +
        '这个站已经有应用窗口开着（按窗口标题里的站名、即 content/meta.json 的 title 认）就恢复它、切到前台，不再开新的；站点没写站名时认不出窗口，每次都新开。' +
        'Chrome 只在 Program Files、Program Files (x86)、当前用户的 LocalAppData 下的 Google\\Chrome\\Application\\chrome.exe 找，找不到就拒绝，不改用默认浏览器。' +
        '登录状态与 Cookie 和平时的 Chrome 共用。回 { url, window }：window 是 focused（切到了已经开着的窗口）或 launched（新开了一个）',
      effect: 'write',
    },
    async (args) => {
      const dir = dirOf(argsOf(args, ['dir']))
      let url: string
      try {
        url = (await docsite.start(dir)).url
      } catch (error) {
        throw new DocsiteRejected(messageOf(error))
      }
      return { url, window: await openSiteWindow(url, siteTitleOf(dir)) }
    },
  )

  register(
    commands,
    { name: 'docsite.site.stop', description: '停掉一个站点的开发服务', usage: '{ dir }：站点目录的绝对路径；没在运行就拒绝。回 { url }', effect: 'write' },
    async (args) => docsite.stop(dirOf(argsOf(args, ['dir']))),
  )

  register(
    commands,
    {
      name: 'docsite.site.init',
      description: '一条命令从空目录建站：平台包 god-docsite 的建站器复制站点模板、装依赖、起服务检查，骨架写完归站点',
      usage:
        '{ dir, title, audience }：dir 是站点目录的绝对路径，要不存在或是空目录；title（站名，写进 content/meta.json）必给；audience 必给，写这个站给谁看：只有自己在本机看写 personal（能读工作台插件提供的本机目录），别人也会 clone 下来看写 shared（只读站点目录里的文件）。端口不写进站点，启动时挑（见 docsite.site.start）。' +
        '站点模板是平台包 @godcreator/god-docsite 的 template/，平台包（god-docsite、identity、comments）的依赖写成插件旁边装着的那一版的 ^<版本>；站点根写身份文件 docsite.json：类别 base（基础站；文档站用 docfirst.create，协作站用 collab.site.init）、给的 audience、这一版的布局代号；写完 pnpm install，起服务检查首页，通过后登记为常驻的站保持运行、没登记的停掉。' +
        'people.json 里只有 agent claude，人用 docsite.people.join 把自己加进来。要功能（轨迹卡、钉码、协作等）建完再 docsite.feature.add。回 { dir, platformDependencies }',
      effect: 'write',
    },
    async (args) => {
      const parsed = argsOf(args, ['dir', 'title', 'audience'])
      const title = optionalString(parsed, 'title')
      if (title === undefined) throw new DocsiteRejected('缺少 title（站名），要是非空字符串')
      const audience = parsed['audience']
      if (!isSiteAudience(audience)) throw new DocsiteRejected(`audience 要是 personal 或 shared，收到 ${JSON.stringify(audience)}：只有自己在本机看写 personal，别人也会 clone 下来看写 shared`)
      return docsite.init(dirOf(parsed), { title, kind: 'base', audience })
    },
  )

  register(
    commands,
    {
      name: 'docsite.feature.add',
      description: '给平台建的站点加一个功能包（轨迹卡、钉码、讲解组件、协作等）：装上它、把它的站点模板补进 app/features/、起服务检查',
      usage:
        '{ dir, package, version? }：dir 是站点目录的绝对路径（docsite.site.init 建的站）；package 是功能包的包名，如 @godcreator/trajectory；' +
        'version 是装哪一版，写版本范围（^0.3.1、0.3.1、~0.3.1），或 link: / file: 加绝对路径（路径里不能有空白与引号），不给就用 gwb-docsite 旁边装着的那一版，没装就拒绝。' +
        '在站点目录里 pnpm add <package>@<version>，再把功能包 template/ 里站点还没有的文件补进 app/features/<功能名>/（已有的不覆盖，站点改过的文件留着）、重写 app/features/ 下的汇总文件，最后起服务检查首页（登记着的站保持运行，没登记的停掉）。' +
        '可以对同一站点重复运行，只补缺的；站点在运行时拒绝，先 docsite.site.stop。回 { feature, specifier, addedFiles, keptFiles, features }',
      effect: 'write',
    },
    async (args) => {
      const parsed = argsOf(args, ['dir', 'package', 'version'])
      const version = optionalString(parsed, 'version')
      return docsite.addFeature(dirOf(parsed), { packageName: requiredString(parsed, 'package'), ...(version !== undefined ? { specifier: version } : {}) })
    },
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
        '{ dir, page?, about? }：page 是页面在内容目录 content/ 里的路径（如 writing/collapse-test.mdx），给了只列批那一页的；about 是人员 id，给了只列和他有关的（他发起的、正文或回复里 @ 了他的）。回 { threads }：每串 { id, page, anchor?, author, createdAt, status, resolvedBy?, resolvedAt?, body, mentions, reactions?, replies }，anchor 是锚定的页面元素 id，页面级评论没有；author 是 people.json 里的 id；status 是 open 或 resolved，resolved 时带 resolvedBy（人员 id）与 resolvedAt；body 是 MDX 原文；mentions 是正文与回复里 @ 了的人员 id，去重；reactions 是网页上点的表情回应 { "<表情>": [人员 id…] }，没人点过就没有；replies 每条 { author, createdAt, body, mentions, reactions? }，按时间排。文件在站点目录的 comments/<id>/ 里：index.mdx 是发起的那条，回复各一个 .mdx',
      effect: 'read',
    },
    async (args) => {
      const parsed = argsOf(args, ['dir', 'page', 'about'])
      const filter: CommentFilter = {}
      const page = optionalString(parsed, 'page')
      const about = optionalString(parsed, 'about')
      if (page) filter.page = page
      if (about) filter.about = about
      return { threads: await listComments(dirOf(parsed), filter) }
    },
  )

  register(
    commands,
    {
      name: 'docsite.comment.create',
      description: '在站点上发起一串评论：批整页或批页面上的一个元素',
      usage: `{ dir, body, page, anchor?, as? }：page 是页面在内容目录 content/ 里的路径（如 writing/collapse-test.mdx），与 docsite.comments 的 page 同一写法；anchor 是页面元素的 id，给了就批那个元素，不给批整页。${commentWriteUsage}。回 { thread }`,
      effect: 'write',
    },
    async (args) => {
      const parsed = argsOf(args, ['dir', 'body', 'page', 'anchor', 'as'])
      const anchor = optionalString(parsed, 'anchor')
      const as = optionalString(parsed, 'as')
      const write: CommentWrite = { op: 'create', page: requiredString(parsed, 'page'), body: requiredString(parsed, 'body'), ...(anchor ? { anchor } : {}), ...(as ? { as } : {}) }
      const dir = dirOf(parsed)
      return writeComment(urlOfRunning(dir), write)
    },
  )

  register(
    commands,
    { name: 'docsite.comment.reply', description: '回复站点上的一串评论', usage: `{ dir, thread, body, as? }：thread 是评论串的文件夹名（docsite.comments 回的 id）。${commentWriteUsage}。回 { thread, reply }：reply 是回复的 id（评论串文件夹里 <reply>.mdx）`, effect: 'write' },
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
        usage:
          `{ dir, thread, as? }：thread 是评论串的文件夹名（docsite.comments 回的 id）。` +
          (op === 'resolve'
            ? '串头 index.mdx 写上 status: resolved 与 resolvedBy（写的人）、resolvedAt；已经是已解决就拒绝。标了以后这串带来的 @ 与回复不再算待办'
            : '串头 index.mdx 改回 status: open、去掉 resolvedBy 与 resolvedAt；本来就是未解决就拒绝') +
          `。${commentWriteUsage}。回 { thread }`,
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
