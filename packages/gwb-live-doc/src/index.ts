import fs from 'node:fs'
import path from 'node:path'
import { isRecord, requireKernel, type GwbContext } from '@godcreator02/gwb-plugin-api'
// 只为激活那几个件的 `declare module 'cordis'`——它们给 ctx 加上各自那个名字
import type {} from '@godcreator02/gwb-commands'
import type {} from '@godcreator02/gwb-shell'
import type {} from '@godcreator02/gwb-skills'
import type {} from '@godcreator02/gwb-settings'
// 只 import type：UnitSelection 与它的 `declare module 'cordis'`（gwbUnitFolder 服务名、unit-folder/selection 事件）
import type { UnitSelection } from '@godcreator02/gwb-unit-folder'
import { autoStopMinutes, DEFAULT_AUTO_STOP_MINUTES, TICK_MS } from './deadline.js'
import { SiteManager, type Phase, type RunInfo, type RunState } from './manager.js'
import { realRunnerDeps } from './runner.js'
import {
  buildState,
  hasLivedocConfig,
  hasNodeModules,
  isFumadocsSite,
  isInside,
  readUnitPurpose,
  rootFromSetting,
  scanUnitsRoot,
  siteLabel,
  type BuildState,
} from './sites.js'

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
          '扫一遍 units-root，回全部 fumadocs 站：{ root, rootExists, currentUnit, sites: [{ dir, label, unit, unitPath, unitPurpose?, livedoc, buildState: missing|fresh|stale, nodeModules, phase: idle|building|starting|running|stopping, running?: { port, pid, deadline, url, startedAt }, lastError? }] }。没配容器根回 code: unconfigured。无参数',
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
        log.info(`${SITES_COMMAND}：${sites.length} 个站，耗时 ${Date.now() - started}ms`)
        return {
          ok: true,
          data: { root, rootExists: scanned.rootExists, currentUnit: currentUnit?.unitName ?? null, sites },
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

  // 说明书那一格，局部注入：没装 skills 件的 home 里本件照常挂。产物在 dist/ 下，包根的 skills/ 是 '../skills/'
  ctx.inject(['gwbSkills'], (scoped) => {
    scoped.effect(() => scoped.gwbSkills.register(new URL('../skills/', import.meta.url)))
  })

  log.info('文档站件就绪：一格窗格、六条命令（live-doc.*）')
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
