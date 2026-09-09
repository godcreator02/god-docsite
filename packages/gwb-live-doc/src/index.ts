import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isRecord, requireKernel, type GwbContext } from '@godcreator02/gwb-plugin-api'
// 只为激活那几个件的 `declare module 'cordis'`——它们给 ctx 加上各自那个名字
import type {} from '@godcreator02/gwb-commands'
import type {} from '@godcreator02/gwb-shell'
import type {} from '@godcreator02/gwb-skills'
import type {} from '@godcreator02/gwb-settings'
// 只 import type：运行器的面与一次调用的回执形状（gwbNodeCli 这个名字也由它的 declare module 加上）
import type { CliRunOutcome, GwbNodeCliApi } from '@godcreator02/gwb-node-cli'
// 只 import type：UnitSelection 与它的 `declare module 'cordis'`（gwbUnitFolder 服务名、unit-folder/selection 事件）
import type { UnitSelection } from '@godcreator02/gwb-unit-folder'
import { autoStopMinutes, DEFAULT_AUTO_STOP_MINUTES, TICK_MS } from './deadline.js'
import { inboundPath, parseEntries, readInbound, today, writeFeedback } from './feedback.js'
import { SiteManager, type Phase, type RunInfo, type RunState } from './manager.js'
import { realRunnerDeps } from './runner.js'
import {
  buildState,
  findSitesInUnit,
  hasLivedocConfig,
  hasNodeModules,
  isFumadocsSite,
  isInside,
  pickDocsSite,
  readUnitPurpose,
  rootFromSetting,
  scanUnitsRoot,
  siteLabel,
  type BuildState,
} from './sites.js'
import { collapse, parseCheckJson } from './stale.js'

/**
 * node 半：只剩接线。认站与扫描在 sites.ts，起停状态机在 manager.ts，真进程在 runner.ts，
 * 到点算术在 deadline.ts——那四份全能不起进程单测；这儿把它们挂到命令总线、窗格、设置、
 * 内核事件口上。
 *
 * 目的一句话：坐在工作台里看某个单元时，一键把它的文档站起起来看。等价于 vscode-docs-site
 * 那个扩展在 gwb 里的形态。
 */
export const name = 'gwb-live-doc'

/** 内核事件口上本件的记号：`{ t: EVENT, kind: 'run' | 'selection', … }`，页面 `window.gwb.on` 认它 */
export const EVENT = 'gwb-live-doc'

export const SITES_COMMAND = 'live-doc.sites'
export const START_COMMAND = 'live-doc.start'
export const STOP_COMMAND = 'live-doc.stop'
export const OPEN_COMMAND = 'live-doc.open'
export const EXTEND_COMMAND = 'live-doc.extend'
export const RUNNING_COMMAND = 'live-doc.running'
export const CLI_COMMAND = 'live-doc.cli'
export const RAW_CLI_COMMAND = 'live-doc.cli-raw'
export const STALE_COMMAND = 'live-doc.stale'
export const FEEDBACK_COMMAND = 'live-doc.feedback'
export const FEEDBACK_LIST_COMMAND = 'live-doc.feedback-list'

/**
 * livedoc 那个可执行的绝对路径。`import.meta.resolve` 拿到的是包的主入口 `dist/run.mjs`
 * （`exports` 只开了 `.` 与 `./init`），可执行在它旁边：`dist/cli.mjs`。
 * **不读 `bin` 字段、不查 `.bin` 垫片**——node-cli 登记的是一个绝对路径的 js，
 * 垫片在 Windows 上是 `.cmd`，起不了。解析不到回 null（依赖没装全的 home），调用方 warn 一句、不炸。
 */
function livedocEntry(): string | null {
  try {
    return fileURLToPath(new URL('./cli.mjs', import.meta.resolve('@godcreator02/live-doc-cli')))
  } catch {
    return null
  }
}

/** live-doc-cli 随包发的那三份 skill（`livedoc-docs` / `trajectory` / `spec-grill`）所在的目录 */
function livedocSkillsDir(): URL | null {
  try {
    return new URL('../skills/', import.meta.resolve('@godcreator02/live-doc-cli'))
  } catch {
    return null
  }
}

/**
 * 跑一趟 livedoc 给多久。顶到运行器的上限（110 秒）：`check` 要 load 整个项目、
 * 对每处引用问一次 git，站大了六十秒不够；再长运行器也不收。
 */
const CLI_TIMEOUT_MS = 110_000

/** 浏览器半与样式表的地址，注册窗格时报给外壳。dist/ 下三个文件是邻居，从本模块算 */
const CLIENT_URL = new URL('./client.js', import.meta.url).href
const STYLE_URL = new URL('./style.css', import.meta.url).href

/** 缺哪个都不挂——inject 是 cordis 的等待机制，不是建议 */
export const inject = ['gwbShell', 'gwbCommands']

/**
 * 缺配置时回的那句话。界面不认这段文字，认的是回执上的 `code: 'unconfigured'`。
 * 容器根两条路：本件设置 `units-root`，空着就借 gwb-unit-folder 那份（经 settings.get 按位置读）
 */
const MISSING_ROOT =
  '未配置单元容器根——到「设置」给文档站填 units-root，或者给单元文件夹（条目 unit-folder）填，本件会借它那份'

/** `live-doc.sites` 回包里的一条 */
export interface SiteInfo {
  dir: string
  label: string
  unit: string
  unitPath: string
  unitPurpose?: string
  /** 站根有 livedoc.config.mjs */
  livedoc: boolean
  buildState: BuildState
  nodeModules: boolean
  phase: Phase
  running?: RunInfo
  lastError?: string
  lastExit?: number | null
}

export function apply(ctx: GwbContext): void {
  const log = ctx.logger(name)
  const kernel = requireKernel(ctx)

  // 注册在 apply 里，同步的，不用自己包 effect（服务内部挂在调用方的 effect 上了）
  ctx.gwbShell.registerPane({ id: 'main', title: '文档站', icon: 'book-open', client: CLIENT_URL, style: STYLE_URL })
  ctx.gwbShell.describeSelf({ title: '文档站', icon: 'book-open' })

  /**
   * 两项设置，**局部注入**：设置件不在的 home 里本件照常挂，只是 `settings` 一直是 undefined
   * ——容器根读不到、自动关用缺省两小时。`define` 回的注销函数已经挂在调用方的 effect 上了
   */
  let settings: { get(key: string): unknown } | undefined
  ctx.inject(['gwbSettings'], (scoped) => {
    scoped.gwbSettings.define({
      key: 'units-root',
      title: '单元容器根',
      type: 'string',
      description:
        '装单元目录的那个根的绝对路径（如 D:\\unitfolders）。留空就借单元文件夹件（条目 unit-folder）的同名设置——两个件看的是同一个根，不必填两遍',
    })
    scoped.gwbSettings.define({
      key: 'auto-stop-minutes',
      title: '自动关（分钟）',
      type: 'number',
      default: DEFAULT_AUTO_STOP_MINUTES,
      description: '起来的站多少分钟后自动关，到点前五分钟界面上给「延长」。0 = 不自动关。改了只对之后起的与延长的生效',
    })
    settings = scoped.gwbSettings
    scoped.effect(() => () => {
      settings = undefined
    })
  })

  const cli = ctx.gwbCommands
  // inject 保证了它在，这句只是把类型收窄
  if (cli === undefined) return

  /**
   * 容器根：**用时现读**。本件自己那项优先；空着就经命令总线按位置读 unit-folder 那份
   * （`settings.get { section: 'unit-folder', key: 'units-root' }`——分区名是条目 id 的末段，
   * 所以那条条目得叫 unit-folder，default home 里正是）。设置件不在时两条路都没有。
   */
  const resolveUnitsRoot = async (): Promise<string | undefined> => {
    const own = rootFromSetting(settings?.get('units-root'))
    if (own !== undefined || settings === undefined) return own
    const reply = await cli.run('settings.get', { section: 'unit-folder', key: 'units-root' })
    return reply.ok ? rootFromSetting(reply.data) : undefined
  }

  const manager = new SiteManager({
    deps: realRunnerDeps(),
    autoStopMinutes: () => autoStopMinutes(settings?.get('auto-stop-minutes')),
    log: (line) => log.info(line),
    // build 与 next 的输出话多，压到 debug；出事时日志文件里照样有
    output: (line) => log.debug(line),
    onChange: (state, event) => {
      kernel.emit({ t: EVENT, kind: 'run', event, state })
      if (event === 'failed') log.warn(`${state.dir}：${state.lastError ?? '起失败'}`)
    },
  })

  // 对表：绝对到期时刻，每半分钟比一次（setTimeout 睡眠后会漂）。effect 包着，条目停了定时器跟着停
  ctx.effect(() => {
    const timer = setInterval(() => manager.tick(), TICK_MS)
    return () => clearInterval(timer)
  })
  // **件 dispose 时杀光自己起的站**：工作台关了还留着 node 才是爆内存的路
  ctx.effect(() => () => {
    void manager.disposeAll().catch((err: unknown) => log.warn(`收尾时杀站失败：${String(err)}`))
  })

  /**
   * 当前选中的单元，来自 gwb-unit-folder（**局部注入**：没装它本件照常工作，只是没有置顶）。
   * 挂上时读一次 `current()`，之后订 cordis 事件 `unit-folder/selection`；变了就经内核事件口
   * 推给页面——页面不直接认识 unit-folder，只认本件的记号
   */
  let currentUnit: UnitSelection | undefined
  const pushSelection = (): void => {
    kernel.emit({ t: EVENT, kind: 'selection', currentUnit: currentUnit?.unitName ?? null })
  }
  ctx.inject(['gwbUnitFolder'], (scoped) => {
    currentUnit = scoped.gwbUnitFolder.current()
    pushSelection()
    scoped.on('unit-folder/selection', (selection) => {
      currentUnit = selection
      pushSelection()
    })
    scoped.effect(() => () => {
      currentUnit = undefined
      pushSelection()
    })
    log.info('接上了 unit-folder 的选中：当前单元的站置顶')
  })

  function describe(found: { dir: string; unit: string; unitPath: string }, run: RunState): SiteInfo {
    const info: SiteInfo = {
      dir: found.dir,
      label: siteLabel(found.dir),
      unit: found.unit,
      unitPath: found.unitPath,
      livedoc: hasLivedocConfig(found.dir),
      buildState: buildState(found.dir),
      nodeModules: hasNodeModules(found.dir),
      phase: run.phase,
    }
    const purpose = readUnitPurpose(found.unitPath)
    if (purpose !== undefined) info.unitPurpose = purpose
    if (run.run !== undefined) info.running = run.run
    if (run.lastError !== undefined) info.lastError = run.lastError
    if (run.lastExit !== undefined) info.lastExit = run.lastExit
    return info
  }

  /** 总线递来的参数是 unknown：收 `{ dir, rebuild? }` */
  function dirOf(args: unknown): string {
    const dir = isRecord(args) ? args['dir'] : undefined
    if (typeof dir !== 'string' || dir.trim() === '') throw new Error('参数要是 { dir: string }——站目录的绝对路径')
    return path.resolve(dir.trim())
  }

  // **每条 register 都包 ctx.effect**：回的是注销函数，不包的话条目停了名字还留在表上
  ctx.effect(() =>
    cli.register(
      {
        name: SITES_COMMAND,
        description:
          '扫一遍 units-root，回全部 fumadocs 站：{ root, rootExists, currentUnit, retired: { count, units }, sites: [{ dir, label, unit, unitPath, unitPurpose?, livedoc, buildState: missing|fresh|stale, nodeModules, phase: idle|building|starting|running|stopping, running?: { port, pid, deadline, url, startedAt }, lastError? }] }。出生证 unit.json 写了 retired: true 的单元整个不扫，跳了几个看 retired。没配容器根回 code: unconfigured。无参数',
        plugin: name,
      },
      async () => {
        const root = await resolveUnitsRoot()
        if (root === undefined) return { ok: false, code: 'unconfigured', error: MISSING_ROOT }
        const started = Date.now()
        const scanned = scanUnitsRoot(root)
        const sites = scanned.sites.map((found) => describe(found, manager.state(found.dir)))
        // 在跑但已不在清单里的（站目录刚被删、根被改了）也要列出来，不然停不掉
        for (const run of manager.all()) {
          if (sites.some((s) => s.dir === run.dir)) continue
          const unitPath = path.dirname(run.dir)
          sites.push(describe({ dir: run.dir, unit: path.basename(unitPath), unitPath }, run))
        }
        log.info(
          `${SITES_COMMAND}：${sites.length} 个站，跳过 ${scanned.retired.length} 个退役单元，耗时 ${Date.now() - started}ms`,
        )
        return {
          ok: true,
          data: {
            root,
            rootExists: scanned.rootExists,
            currentUnit: currentUnit?.unitName ?? null,
            // 跳了哪几个也说出来：静默少几条站比多几条更难查
            retired: { count: scanned.retired.length, units: scanned.retired },
            sites,
          },
        }
      },
    ),
  )

  ctx.effect(() =>
    cli.register(
      {
        name: START_COMMAND,
        description:
          '起一个站：{ dir: string, rebuild?: boolean }——dir 是站目录的绝对路径（要在 units-root 内）。没 build 过的先 pnpm run build；rebuild: true 强制重建；源比产物新（stale）不传 rebuild 就直接起旧产物、回执 note 里说明。没 node_modules 回 code: no-node-modules。端口现挑，回 { dir, port, url, pid, deadline, buildState, built, alreadyRunning, note? }',
        plugin: name,
      },
      async (args) => {
        const target = dirOf(args)
        const rebuild = isRecord(args) && args['rebuild'] === true
        const root = await resolveUnitsRoot()
        if (root === undefined) return { ok: false, code: 'unconfigured', error: MISSING_ROOT }
        if (!isInside(root, target)) return { ok: false, error: `目录不在容器根内：${target}` }
        let pkgText: string
        try {
          pkgText = fs.readFileSync(path.join(target, 'package.json'), 'utf8')
        } catch {
          return { ok: false, error: `不是站：${target} 下没有 package.json` }
        }
        if (!isFumadocsSite(pkgText)) return { ok: false, error: `不是 fumadocs 站：${target} 的依赖里没有 fumadocs-core / -mdx / -ui` }
        if (!hasNodeModules(target)) {
          return { ok: false, code: 'no-node-modules', error: `站目录里没有 node_modules，先在 ${target} 跑一遍 pnpm install` }
        }
        const before = buildState(target)
        const build = rebuild || before === 'missing'
        const outcome = await manager.start(target, { build })
        if (!outcome.ok) return { ok: false, error: outcome.error }
        const after = buildState(target)
        const note =
          after === 'stale' && !outcome.alreadyRunning
            ? '源比上次 build 的产物新，起的是旧产物；要看新内容先停、再传 rebuild: true 起'
            : undefined
        return {
          ok: true,
          data: { dir: target, ...outcome.run, buildState: after, built: outcome.built, alreadyRunning: outcome.alreadyRunning, note },
        }
      },
    ),
  )

  ctx.effect(() =>
    cli.register(
      {
        name: STOP_COMMAND,
        description: '停一个本件起的站（杀整棵进程树）：{ dir: string }。正在 build / 起的也停得了。回 { dir, stopped }——没在跑 stopped 是 false',
        plugin: name,
      },
      async (args) => {
        const target = dirOf(args)
        const stopped = await manager.stop(target)
        return { dir: target, stopped }
      },
    ),
  )

  ctx.effect(() =>
    cli.register(
      {
        name: OPEN_COMMAND,
        description: '在系统浏览器里打开一个在跑的站（shell.openExternal）：{ dir: string }。回 { url }',
        plugin: name,
      },
      async (args) => {
        const target = dirOf(args)
        const state = manager.state(target)
        if (state.phase !== 'running' || state.run === undefined) return { ok: false, error: `站没在跑：${target}（先 ${START_COMMAND}）` }
        await openExternal(state.run.url)
        return { url: state.run.url }
      },
    ),
  )

  ctx.effect(() =>
    cli.register(
      {
        name: EXTEND_COMMAND,
        description: '给一个在跑的站延长：到期时刻从此刻按设置 auto-stop-minutes 重算。{ dir: string }。回 { dir, deadline }',
        plugin: name,
      },
      (args) => {
        const target = dirOf(args)
        const run = manager.extend(target)
        if (run === undefined) return { ok: false, error: `站没在跑：${target}` }
        return { dir: target, deadline: run.deadline ?? null }
      },
    ),
  )

  ctx.effect(() =>
    cli.register(
      {
        name: RUNNING_COMMAND,
        description: '此刻不在 idle 的站（在跑的、正在 build / 起 / 停的）：[{ dir, phase, run?: { port, pid, deadline, url, startedAt } }]。无参数',
        plugin: name,
      },
      () => manager.all(),
    ),
  )

  // ── livedoc 命令行 ──────────────────────────────────────────────────────────

  /**
   * livedoc 是个 CLI 包、不是件，自己挂不上工作台。**CLI 形态的东西一律经 `gwbNodeCli`
   * 登记，不做总线命令、不进程内调**（devkit 手册的红线）——局部注入 = 可选依赖：
   * node-cli 件不在的 home 里本件照常挂，只是这四条跟 livedoc 打交道的命令回「没登记」。
   *
   * 登记出来的 `live-doc.cli-raw` 是**裸口**：cwd 不给就落在 cli 包自己旁边，那儿没有
   * `livedoc.config.mjs`。缺省要落到「选中单元的站」得在调用那一刻算，而运行器的缺省 cwd
   * 是登记时定死的一个字符串——所以缺省那一层是本件自己的命令 `live-doc.cli`，它算好 cwd
   * 再经 `run` 递给运行器。两条同名不可能：运行器登记什么名字就往总线上挂同一个名字。
   */
  let nodeCli: GwbNodeCliApi | undefined
  ctx.inject(['gwbNodeCli'], (scoped) => {
    const entry = livedocEntry()
    if (entry === null) {
      log.warn(`@godcreator02/live-doc-cli 解析不到——${RAW_CLI_COMMAND} 没登记，${CLI_COMMAND} / ${STALE_COMMAND} 也就跑不了`)
      return
    }
    // register 不用自己包 effect：运行器内部已经挂在调用方的 effect 上了
    scoped.gwbNodeCli.register({
      name: RAW_CLI_COMMAND,
      description: `livedoc 命令行的裸口，cwd 必须自己给（不给落在 cli 包自己旁边，那儿没有 livedoc.config.mjs）。一般用 ${CLI_COMMAND}——它把 cwd 缺省成选中单元的站`,
      entry,
      timeoutMs: CLI_TIMEOUT_MS,
    })
    nodeCli = scoped.gwbNodeCli
    // 服务撤了就把这一格还回去：留着一个已经死掉的引用，失败会发生在很远的地方
    scoped.effect(() => () => {
      nodeCli = undefined
    })
  })

  /** 没装 node-cli 件时那四条命令回的话。名字点出来，人一看就知道装哪个件 */
  const MISSING_NODE_CLI = '跑不了 livedoc：这个 home 里没装 node-cli 件（@godcreator02/gwb-node-cli），或者解析不到 @godcreator02/live-doc-cli'

  /** 跑一趟 livedoc。运行器不在回 undefined；cwd 的存在性校验在运行器那头（错误文本就是文档） */
  async function runLivedoc(args: readonly string[], cwd: string): Promise<CliRunOutcome | undefined> {
    return nodeCli === undefined ? undefined : nodeCli.run(RAW_CLI_COMMAND, args, { cwd })
  }

  /**
   * 不给 cwd 时落在哪：**选中单元的站**。挑不出就报清楚，不替人猜——
   * 猜错的代价是在错误的仓里跑了一次 confirm。
   */
  function selectedSite(): { ok: true; dir: string } | { ok: false; error: string } {
    const unit = currentUnit
    if (unit === undefined) {
      return {
        ok: false,
        error: `没有选中的单元（这个 home 里没装 gwb-unit-folder，或者还没在单元树里点过）——给 cwd 指明站目录，${SITES_COMMAND} 回包里的 dir 就是`,
      }
    }
    const found = findSitesInUnit(unit.unitPath, unit.unitName)
    const dir = pickDocsSite(found)
    if (dir !== undefined) return { ok: true, dir }
    if (found.length === 0) {
      return { ok: false, error: `选中的单元 ${unit.unitName}（${unit.unitPath}）里没有 fumadocs 站——给 cwd 指明站目录` }
    }
    return {
      ok: false,
      error: `选中的单元 ${unit.unitName} 里有 ${String(found.length)} 个站，挑不出缺省的：${found.map((s) => s.dir).join('、')}——给 cwd 指明要哪一个`,
    }
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

  ctx.effect(() =>
    cli.register(
      {
        name: CLI_COMMAND,
        description:
          `livedoc 的命令行：{ args: string[], cwd?: string }。args 原样递给 livedoc——check（核对，有红退 1）、check --json（机读报告，${STALE_COMMAND} 吃的就是它）、confirm（确认、换记号；先 commit）、render --target ai（重摆 outputs 生成物）、init --dir <仓>（给一个还没有站的仓铺一个）、trajectory。` +
          `cwd 是站目录的绝对路径（那儿有 livedoc.config.mjs），**不给就落在选中单元的站**；选中的单元没有站、或有好几个，就回一句让你给 cwd。` +
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
          const picked = selectedSite()
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

  ctx.effect(() =>
    cli.register(
      {
        name: STALE_COMMAND,
        description:
          '一个站里哪几页的现状漂了：{ dir: string }——dir 是站目录的绝对路径（`live-doc.sites` 回包里 livedoc: true 的那些）。' +
          '内部跑 livedoc check --json，收敛成 { dir, ok, red, docs, pages: [{ doc, red, pins: [{ target, kind, status: changed|missing, line, lines, reason?, diff? }], outputs: [{ to, status: missing|stale|no-frontmatter, missing? }] }], others: [{ doc, orphans, components }], strays, trajectory }。' +
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

  /** 收 `{ dir }` 之外的字符串参数，空白算没给 */
  function textOf(args: unknown, key: string): string | undefined {
    const raw = isRecord(args) ? args[key] : undefined
    return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined
  }

  /** 站得有 content 目录才往里写——挡住把反馈落进一个随手给的目录 */
  function isSiteDir(dir: string): boolean {
    try {
      return fs.statSync(path.join(dir, 'content')).isDirectory()
    } catch {
      return false
    }
  }

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
    // **livedoc 随包的三份也从这儿挂**（`livedoc-docs` / `trajectory` / `spec-grill`）：
    // 文档怎么写、卡怎么记、需求怎么盘归 livedoc，但连着工作台的 agent 得读得到它们，
    // 而 livedoc 是个 cli 包、不是件、自己挂不上。解析不到只 warn——那三份不是本件能不能干活的前提
    const dir = livedocSkillsDir()
    if (dir === null) {
      log.warn('@godcreator02/live-doc-cli 解析不到——livedoc 随包那三份 skill（livedoc-docs / trajectory / spec-grill）没挂上')
    } else {
      scoped.effect(() => scoped.gwbSkills.register(dir))
    }
  })

  log.info(`文档站件就绪：一格窗格、十条命令（live-doc.*），livedoc 命令行经 node-cli 登记成 ${RAW_CLI_COMMAND}`)
}

/**
 * 系统浏览器打开一个 URL。件跑在 Electron 主进程里，`import('electron')` 够得着
 * （件仓 AGENTS「开窗、菜单、对话框归件」）。**说明符走变量**，不让 tsc 去解析 electron 这个
 * 模块——不为一个 openExternal 把整个 electron 装进 devDependencies（照 gwb-shell 的 reload.ts）。
 * electron 是 CJS 包，ESM 里 `import()` 回的命名空间把整个 API 挂在 `default` 上，先看它。
 */
async function openExternal(url: string): Promise<void> {
  const spec = 'electron'
  const mod: unknown = await import(spec)
  const api = isRecord(mod) && isRecord(mod['default']) ? mod['default'] : mod
  const shell = isRecord(api) ? api['shell'] : undefined
  const open = isRecord(shell) ? shell['openExternal'] : undefined
  if (typeof open !== 'function') {
    throw new Error('import("electron") 里没有 shell.openExternal（default 上也没有）——不在 Electron 主进程里')
  }
  await (open as (target: string) => Promise<void>).call(shell, url)
}
