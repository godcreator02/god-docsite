import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isRecord, type GwbContext } from '@godcreator02/gwb-plugin-api'
// 只为激活那几个件的 `declare module 'cordis'`——它们给 ctx 加上各自那个名字
import type {} from '@godcreator02/gwb-commands'
import type {} from '@godcreator02/gwb-skills'
// 只 import type：运行器的面与一次调用的回执形状（gwbNodeCli 这个名字也由它的 declare module 加上）
import type { CliRunOutcome, GwbNodeCliApi } from '@godcreator02/gwb-node-cli'
import { inboundPath, parseEntries, readInbound, today, writeFeedback } from './feedback.js'
import { DOCS_SITE_LIST, hasLivedocConfig, isSiteDir, parseSiteListing, pickSiteInUnit } from './site-lookup.js'
import { collapse, parseCheckJson } from './stale.js'

/**
 * node 半：只剩接线。待重写页的收敛在 stale.ts，反馈页的读写在 feedback.ts，问站件要清单
 * 在 site-lookup.ts——那三份全能不起进程单测；这儿把它们挂到命令总线上。
 *
 * 目的一句话：把 livedoc 命令行开给连着工作台的 agent，再加两条它自己干不了的事
 * （跨仓投反馈、把 check 的机读报告收敛成待重写页清单）。
 *
 * **本件不管站的一生**——扫站、起停、端口、到点关、那一格窗格全在站件
 * （`@godcreator02/gwb-docs-site`）。本件管的是站里**内容的正确性**：钉码、核对、确认、
 * 渲染、装配六区。它不知道站是谁建的、有没有在跑，也不注册窗格（站件那格已经叫「文档站」了）。
 */
export const name = 'gwb-live-doc'

export const CLI_COMMAND = 'live-doc.cli'
export const RAW_CLI_COMMAND = 'live-doc.cli-raw'
export const ATTACH_COMMAND = 'live-doc.attach'
export const STALE_COMMAND = 'live-doc.stale'
export const FEEDBACK_COMMAND = 'live-doc.feedback'
export const FEEDBACK_LIST_COMMAND = 'live-doc.feedback-list'

/**
 * livedoc 那个可执行的绝对路径。`import.meta.resolve` 拿到的是包的主入口 `dist/run.mjs`
 * （`exports` 只开了 `.` 与 `./fumadocs`），可执行在它旁边：`dist/cli.mjs`。
 * **不读 `bin` 字段、不查 `.bin` 垫片**——node-cli 登记的是一个绝对路径的 js，
 * 垫片在 Windows 上是 `.cmd`，起不了。解析不到回 null（依赖没装全的 home），调用方 warn 一句、不炸。
 */
function livedocEntry(): string | null {
  try {
    return fileURLToPath(new URL('./cli.mjs', import.meta.resolve('@godcreator02/livedoc')))
  } catch {
    return null
  }
}

/** livedoc 随包发的那两份 skill（`livedoc-docs` / `trajectory`）所在的目录 */
function livedocSkillsDir(): URL | null {
  try {
    return new URL('../skills/', import.meta.resolve('@godcreator02/livedoc'))
  } catch {
    return null
  }
}

/**
 * 跑一趟 livedoc 给多久。顶到运行器的上限（110 秒）：`check` 要 load 整个项目、
 * 对每处引用问一次 git，站大了六十秒不够；再长运行器也不收。
 */
const CLI_TIMEOUT_MS = 110_000

/** 缺哪个都不挂——inject 是 cordis 的等待机制，不是建议 */
export const inject = ['gwbCommands']

export function apply(ctx: GwbContext): void {
  const log = ctx.logger(name)

  const cli = ctx.gwbCommands
  // inject 保证了它在，这句只是把类型收窄
  if (cli === undefined) return

  // ── livedoc 命令行 ──────────────────────────────────────────────────────────

  /**
   * livedoc 是个 CLI 包、不是件，自己挂不上工作台。**CLI 形态的东西一律经 `gwbNodeCli`
   * 登记，不做总线命令、不进程内调**（devkit 手册的红线）——局部注入 = 可选依赖：
   * node-cli 件不在的 home 里本件照常挂，只是那几条跟 livedoc 打交道的命令回「没登记」。
   *
   * 登记出来的 `live-doc.cli-raw` 是**裸口**：cwd 不给就落在 livedoc 包自己旁边，那儿没有
   * `livedoc.config.mjs`。缺省要落到「选中单元的站」得在调用那一刻算，而运行器的缺省 cwd
   * 是登记时定死的一个字符串——所以缺省那一层是本件自己的命令 `live-doc.cli`，它算好 cwd
   * 再经 `run` 递给运行器。两条同名不可能：运行器登记什么名字就往总线上挂同一个名字。
   */
  let nodeCli: GwbNodeCliApi | undefined
  ctx.inject(['gwbNodeCli'], (scoped) => {
    const entry = livedocEntry()
    if (entry === null) {
      log.warn(`@godcreator02/livedoc 解析不到——${RAW_CLI_COMMAND} 没登记，别的几条也就跑不了`)
      return
    }
    // register 不用自己包 effect：运行器内部已经挂在调用方的 effect 上了
    scoped.gwbNodeCli.register({
      name: RAW_CLI_COMMAND,
      description: `livedoc 命令行的裸口，cwd 必须自己给（不给落在 livedoc 包自己旁边，那儿没有 livedoc.config.mjs）。一般用 ${CLI_COMMAND}——它把 cwd 缺省成选中单元的站`,
      entry,
      timeoutMs: CLI_TIMEOUT_MS,
    })
    nodeCli = scoped.gwbNodeCli
    // 服务撤了就把这一格还回去：留着一个已经死掉的引用，失败会发生在很远的地方
    scoped.effect(() => () => {
      nodeCli = undefined
    })
  })

  /** 没装 node-cli 件时那几条命令回的话。名字点出来，人一看就知道装哪个件 */
  const MISSING_NODE_CLI =
    '跑不了 livedoc：这个 home 里没装 node-cli 件（@godcreator02/gwb-node-cli），或者解析不到 @godcreator02/livedoc'

  /** 跑一趟 livedoc。运行器不在回 undefined；cwd 的存在性校验在运行器那头（错误文本就是文档） */
  async function runLivedoc(args: readonly string[], cwd: string): Promise<CliRunOutcome | undefined> {
    return nodeCli === undefined ? undefined : nodeCli.run(RAW_CLI_COMMAND, args, { cwd })
  }

  /**
   * 不给 cwd 时落在哪：**选中单元的站**。清单问站件要（`docs-site.list`）——本件不扫盘。
   * 站件没装、或者挑不出，都报清楚，不替人猜：猜错的代价是在错误的仓里跑了一次 confirm。
   */
  const selectedSite = async (): Promise<{ ok: true; dir: string } | { ok: false; error: string }> => {
    if (!cli.list().some((c) => c.name === DOCS_SITE_LIST)) {
      return {
        ok: false,
        error: `这个 home 里没装站件（@godcreator02/gwb-docs-site），本件问不出「有哪些站」——给 cwd 指明站目录的绝对路径`,
      }
    }
    const reply = await cli.run(DOCS_SITE_LIST, {})
    if (!reply.ok) return { ok: false, error: `${DOCS_SITE_LIST} 没给出清单：${String(reply.error ?? '未知原因')}——给 cwd 指明站目录` }
    const listing = parseSiteListing(reply.data)
    if (listing === undefined) return { ok: false, error: `${DOCS_SITE_LIST} 的回执形状认不出来——给 cwd 指明站目录` }
    if (listing.currentUnit === null) {
      return { ok: false, error: '没有选中的单元（站件那边还没接上 unit-folder，或者还没在单元树里点过）——给 cwd 指明站目录' }
    }
    const picked = pickSiteInUnit(listing.sites, listing.currentUnit)
    if (picked.dir !== undefined) return { ok: true, dir: picked.dir }
    if (picked.candidates.length === 0) {
      return { ok: false, error: `选中的单元 ${listing.currentUnit} 里没有 fumadocs 站——给 cwd 指明站目录` }
    }
    return {
      ok: false,
      error: `选中的单元 ${listing.currentUnit} 里有 ${String(picked.candidates.length)} 个站，挑不出缺省的：${picked.candidates.join('、')}——给 cwd 指明要哪一个`,
    }
  }

  /** 总线递来的参数是 unknown：收 `{ dir }`——站目录的绝对路径 */
  function dirOf(args: unknown): string {
    const dir = isRecord(args) ? args['dir'] : undefined
    if (typeof dir !== 'string' || dir.trim() === '') throw new Error('参数要是 { dir: string }——站目录的绝对路径')
    return path.resolve(dir.trim())
  }

  /** 总线递来的参数里那个 cwd：不给回 undefined，给了必须是绝对路径（存不存在归运行器判） */
  function cwdOf(args: unknown): { ok: true; cwd?: string } | { ok: false; error: string } {
    const raw = isRecord(args) ? args['cwd'] : undefined
    if (raw === undefined) return { ok: true }
    if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, error: 'cwd 要是站目录的绝对路径（字符串）；不给就落在选中单元的站' }
    if (!path.isAbsolute(raw.trim())) return { ok: false, error: `cwd 要是绝对路径（这儿不知道该相对于谁），给的是：${raw}` }
    return { ok: true, cwd: path.resolve(raw.trim()) }
  }

  /** 总线递来的参数里那串 args：给数组就是它，别的当空 */
  function argsOf(args: unknown): string[] {
    const raw = isRecord(args) ? args['args'] : undefined
    return Array.isArray(raw) ? raw.map((a) => String(a)) : []
  }

  /** 收 `{ dir }` 之外的字符串参数，空白算没给 */
  function textOf(args: unknown, key: string): string | undefined {
    const raw = isRecord(args) ? args[key] : undefined
    return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined
  }

  // **每条 register 都包 ctx.effect**：回的是注销函数，不包的话条目停了名字还留在表上
  ctx.effect(() =>
    cli.register(
      {
        name: CLI_COMMAND,
        description:
          `livedoc 的命令行：{ args: string[], cwd?: string }。args 原样递给 livedoc——check（核对，有红退 1）、check --json（机读报告，${STALE_COMMAND} 吃的就是它）、confirm（确认、换记号；先 commit）、render（重摆 outputs 生成物）、trajectory。给一个已有的 fumadocs 骨架装六区有专门的 ${ATTACH_COMMAND}，别从这儿递 attach。` +
          `cwd 是站目录的绝对路径（那儿有 livedoc.config.mjs），**不给就落在选中单元的站**（清单问站件要）；站件没装、选中的单元没有站、或有好几个，就回一句让你给 cwd。` +
          `回 { ok, cwd, exitCode, timedOut, durationMs, stdout, stderr }——check 有红时退出码 1，那是核对结果不是命令失败`,
        plugin: name,
      },
      async (args) => {
        const argv = argsOf(args)
        if (argv.length === 0) return { ok: false, error: `${CLI_COMMAND} 要 { args: string[] }——比如 { "args": ["check"] }` }
        const given = cwdOf(args)
        if (!given.ok) return given
        let cwd = given.cwd
        if (cwd === undefined) {
          const picked = await selectedSite()
          if (!picked.ok) return { ok: false, code: 'no-site', error: picked.error }
          cwd = picked.dir
        }
        const outcome = await runLivedoc(argv, cwd)
        if (outcome === undefined) return { ok: false, code: 'no-node-cli', error: MISSING_NODE_CLI }
        // 被拒（cwd 不合规）：运行器回的就是一句说清要什么的话，原样交出去
        if (!('exitCode' in outcome)) return outcome
        return {
          ok: outcome.ok,
          cwd,
          exitCode: outcome.exitCode,
          timedOut: outcome.timedOut,
          durationMs: outcome.durationMs,
          stdout: outcome.stdout,
          stderr: outcome.stderr,
          ...(outcome.ok ? {} : { error: `livedoc ${argv.join(' ')} 退出码 ${String(outcome.exitCode)}${outcome.timedOut ? '（超时）' : ''}` }),
        }
      },
    ),
  )

  /**
   * 装配六区的入口。**实现一行都不在这儿**：装配是 livedoc 命令行里那个模块的活，件只把
   * 「哪个站」翻译成一趟子进程——livedoc 得能在没装工作台的仓里独立用，反过来把装配搬进件，
   * 就等于让接 livedoc 依赖一整台桌面工作台。
   *
   * 目标站要**绝对路径**：件跑在工作台主进程里，相对谁都不知道；存不存在归 livedoc 判，
   * 只有「不是目录」这一条先拦下——那会变成运行器抱怨 cwd，看不出是站给错了。
   */
  function siteOf(args: unknown): { ok: true; dir: string } | { ok: false; error: string } {
    const raw = isRecord(args) ? args['dir'] : undefined
    if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, error: `${ATTACH_COMMAND} 要 { dir: string }——目标站目录的绝对路径` }
    if (!path.isAbsolute(raw.trim())) return { ok: false, error: `dir 要是绝对路径（这儿不知道该相对于谁），给的是：${raw}` }
    const dir = path.resolve(raw.trim())
    let isDir = false
    try {
      isDir = fs.statSync(dir).isDirectory()
    } catch {
      isDir = false
    }
    if (!isDir) return { ok: false, error: `不是目录：${dir}——装配是往一个**已经建好的 fumadocs 骨架**上加六区，先用站件 docs-site.create 铺骨架` }
    return { ok: true, dir }
  }

  ctx.effect(() =>
    cli.register(
      {
        name: ATTACH_COMMAND,
        description:
          '给一个**已经建好的 fumadocs 骨架**装上 livedoc 的六区（起子进程跑 livedoc attach）：{ dir: string, title?: string }。' +
          'dir 是**站目录**的绝对路径（约定是 <仓>/docs-site，骨架由站件 docs-site.create 铺）。' +
          '装六个集合、六条路由、侧栏六个根节、livedoc.config.mjs、mdx 接线、投影块与术语组件、名册脚本、五个区的骨架页，' +
          'package.json 里补上 livedoc 的依赖与 doc 脚本。' +
          '**只在刚铺好的骨架上跑**：站里已经有 livedoc.config.mjs、或 content/ 下已经有骨架之外的内容，就报一句「这个站已有内容，请人工接线」退非零，不改写任何东西。' +
          '回 { dir, exitCode, timedOut, durationMs, stdout, stderr, note }——装了哪些文件、接着做什么全在 stdout.text 里',
        plugin: name,
      },
      async (args) => {
        const site = siteOf(args)
        if (!site.ok) return site
        const title = textOf(args, 'title')
        const argv = ['attach', '--dir', site.dir]
        if (title !== undefined) argv.push('--title', title)
        // cwd 落在目标站自己：attach 不读 livedoc.config.mjs（那正是它要写出来的），落哪儿都不影响结果，落在站里最好查
        const outcome = await runLivedoc(argv, site.dir)
        if (outcome === undefined) return { ok: false, code: 'no-node-cli', error: MISSING_NODE_CLI }
        if (!('exitCode' in outcome)) return outcome
        log.info(`${ATTACH_COMMAND}：${site.dir} 退出码 ${String(outcome.exitCode)}`)
        return {
          ok: outcome.ok,
          dir: site.dir,
          exitCode: outcome.exitCode,
          timedOut: outcome.timedOut,
          durationMs: outcome.durationMs,
          stdout: outcome.stdout,
          stderr: outcome.stderr,
          ...(outcome.ok
            ? { note: `只写了文件。接着在 ${site.dir} 跑 pnpm install、pnpm doc:render、pnpm doc；起手页写了第一条引用怎么钉` }
            : { error: `livedoc attach 退出码 ${String(outcome.exitCode)}${outcome.timedOut ? '（超时）' : ''}——看 stderr.text` }),
        }
      },
    ),
  )

  ctx.effect(() =>
    cli.register(
      {
        name: STALE_COMMAND,
        description:
          '一个站里哪几页的现状漂了：{ dir: string }——dir 是站目录的绝对路径（站件 docs-site.list 回包里的 dir 就是）。' +
          '内部跑 livedoc check --json，收敛成 { dir, ok, red, docs, pages: [{ doc, red, pins: [{ target, kind, status: changed|missing, line, lines, reason?, diff? }], outputs: [{ to, status: missing|stale|no-frontmatter, fresh: false, missing? }] }], others: [{ doc, orphans, components }], strays, trajectory }。' +
          'pages 就是待重写页（钉漂了或生成物不新鲜）；others 是只有孤儿记录 / 名册外组件的页——那两种不用重写正文，confirm 或补名册就平',
        plugin: name,
      },
      async (args) => {
        const target = dirOf(args)
        if (!hasLivedocConfig(target)) {
          return { ok: false, code: 'not-livedoc', error: `${target} 下没有 livedoc.config.mjs——这条要的是接了 livedoc 的站目录` }
        }
        const outcome = await runLivedoc(['check', '--json'], target)
        if (outcome === undefined) return { ok: false, code: 'no-node-cli', error: MISSING_NODE_CLI }
        if (!('exitCode' in outcome)) return outcome
        const report = parseCheckJson(outcome.stdout.text)
        if (report === undefined) {
          // 红的时候 check 退 1、报告照样在 stdout 上，所以退出码不是判据——没捞到那一行才是
          const tail = (outcome.stderr.text || outcome.stdout.text).trim().slice(-500)
          return {
            ok: false,
            error: `livedoc check --json 没给出机读报告（退出码 ${String(outcome.exitCode)}${outcome.timedOut ? '，超时' : ''}）：${tail}`,
          }
        }
        return { ok: true, data: { dir: target, ...collapse(report) } }
      },
    ),
  )

  // ── 反馈：跨会话把话投进别的仓 ───────────────────────────────────────────────

  ctx.effect(() =>
    cli.register(
      {
        name: FEEDBACK_COMMAND,
        description:
          '往目标站的反馈区投一条：{ dir: string, title: string, body: string, from?: string }。追加到 <dir>/content/feedback/inbound.mdx 末尾（页不在就先建），带今天的日期与来源；' +
          'from 不给就是「未署名」，写成「哪个仓 / 哪个会话」最有用。**只追加这一页、不 commit、不动别的页**——那个仓的人自己看了再提交。回 { dir, file, created, date, total }',
        plugin: name,
      },
      (args) => {
        const target = dirOf(args)
        const title = textOf(args, 'title')
        const body = textOf(args, 'body')
        if (title === undefined || body === undefined) {
          return { ok: false, error: `${FEEDBACK_COMMAND} 要 { dir, title, body, from? }——title 与 body 都不能是空的` }
        }
        if (!isSiteDir(target)) return { ok: false, error: `不是站：${target} 下没有 content 目录` }
        const date = today()
        const written = writeFeedback(target, { date, title, body, from: textOf(args, 'from') ?? '未署名' })
        log.info(`${FEEDBACK_COMMAND}：${target} 收到一条「${title}」${written.created ? '（顺手建了反馈页）' : ''}`)
        return {
          ok: true,
          data: {
            dir: target,
            file: written.file,
            created: written.created,
            date,
            total: written.total,
            note: '只写了这一页，没有 commit',
          },
        }
      },
    ),
  )

  ctx.effect(() =>
    cli.register(
      {
        name: FEEDBACK_LIST_COMMAND,
        description:
          '读回一个站反馈区里的条目：{ dir: string }。回 { dir, file, exists, entries: [{ date, title, from, body }] }——页还不在时 exists 是 false、entries 空表，不是错',
        plugin: name,
      },
      (args) => {
        const target = dirOf(args)
        const text = readInbound(target)
        return {
          ok: true,
          data: {
            dir: target,
            file: inboundPath(target),
            exists: text !== undefined,
            entries: text === undefined ? [] : parseEntries(text),
          },
        }
      },
    ),
  )

  // 说明书那一格，局部注入：没装 skills 件的 home 里本件照常挂。产物在 dist/ 下，包根的 skills/ 是 '../skills/'
  ctx.inject(['gwbSkills'], (scoped) => {
    scoped.effect(() => scoped.gwbSkills.register(new URL('../skills/', import.meta.url)))
    // **livedoc 随包的两份也从这儿挂**（`livedoc-docs` / `trajectory`）：文档怎么写、卡怎么记
    // 归 livedoc，但连着工作台的 agent 得读得到它们，而 livedoc 是个 cli 包、不是件、自己挂不上。
    // 解析不到只 warn——那两份不是本件能不能干活的前提
    const dir = livedocSkillsDir()
    if (dir === null) {
      log.warn('@godcreator02/livedoc 解析不到——livedoc 随包那两份 skill（livedoc-docs / trajectory）没挂上')
    } else {
      scoped.effect(() => scoped.gwbSkills.register(dir))
    }
  })

  log.info(`livedoc 件就绪：五条命令（live-doc.*），livedoc 命令行经 node-cli 登记成 ${RAW_CLI_COMMAND}`)
}
