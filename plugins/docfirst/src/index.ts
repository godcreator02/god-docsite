import type { GwbContext } from '@godcreator/gwb-kernel-desktop'
// 只为让这两个插件的 `declare module 'cordis'` 生效，它们给 ctx 加上各自的服务名
import type {} from '@godcreator/gwb-commands'
import type {} from '@godcreator/gwb-skills'
import { parseCreateArgs, type CreateArgs } from './args.js'
import { planCreate } from './create.js'
import { filesFirstRenderOverwrites, readRepoManifest } from './repo-root.js'
import { createSite, type SiteOptions, type SiteResult } from './scaffold.js'
import { readTemplate } from './template.js'
import { rootFromSetting } from './units-root.js'

/**
 * docfirst 插件：两条建站命令，加 `skills/` 下的说明书。
 * `docfirst.create` 建接好 docfirst 的站，`docfirst.create-plain` 建不接 docfirst 的普通 fumadocs 站；
 * 两条都调用 `scaffold.ts` 的 `createSite`：运行官方脚手架、应用本机约定、写盘。
 *
 * 核对、确认、渲染在仓里发生，归 `@godcreator/docfirst-*` 四个 npm 包（pin、trajectory、workflow、fumadocs），
 * agent 在仓里运行 `pnpm doc`；本插件对四个包都零依赖（`tests/artifact.test.ts` 检查），建站时只把 workflow 与 fumadocs
 * 两个包名写进站的 devDependencies（`src/deps.ts`）。
 */
export const name = 'gwb-docfirst-workflow'

export const CREATE_COMMAND = 'docfirst.create'
export const CREATE_PLAIN_COMMAND = 'docfirst.create-plain'

export const inject = ['gwbCommands']

const PLUGIN = '@godcreator/gwb-docfirst-workflow'

/** 容器根的设置归单元文件夹插件，经命令总线现读 */
const UNITS_ROOT_SETTING = { section: 'unit-folder', key: 'units-root' }

/** 读容器根设置的结果：读到了就是路径，读不到或没配就是原因，写进回执 */
type UnitsRootLookup = { root: string } | { missing: string }

/** 端口在哪儿查的重、查得全不全，给回执用的说明；没什么要说就是空数组 */
function portScanNotes(site: SiteResult, lookup: UnitsRootLookup): string[] {
  const notes: string[] = []
  if (!site.portScan.coversUnitsRoot) {
    const why = 'missing' in lookup ? lookup.missing : `站目录不在容器根 ${lookup.root} 里`
    notes.push(`${why}，端口只在站目录的祖父目录 ${site.portScan.root} 里查了重`)
  }
  if (site.portScan.incomplete.length > 0) {
    notes.push(`端口查重不完整：${String(site.portScan.incomplete.length)} 处没读成（见 portScanIncomplete），选出的端口可能与那里的站重复`)
  }
  if (site.portTakenBy !== undefined) notes.push(`端口 ${String(site.port)} 已被 ${site.portTakenBy} 的脚本占用，照给的端口写了`)
  return notes
}

/** 建站只写文件，安装依赖、渲染、核对由人或 agent 在那个站目录里运行 */
function nextSteps(siteDir: string, port: number): string[] {
  return [
    `cd ${siteDir}`,
    'pnpm install',
    'pnpm doc:render     # 生成仓根 README.md / AGENTS.md / CLAUDE.md（正本在 content/docs/outputs/）',
    'pnpm doc            # docfirst check',
    'pnpm build',
    `pnpm start          # http://127.0.0.1:${String(port)}`,
  ]
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function apply(ctx: GwbContext): void {
  const log = ctx.logger(name)

  const cli = ctx.gwbCommands
  // inject 保证了它在，这句只是把类型收窄
  if (cli === undefined) return

  /** 容器根每次现读：设置可能随时改 */
  const lookupUnitsRoot = async (): Promise<UnitsRootLookup> => {
    const reply = await cli.run('settings.get', UNITS_ROOT_SETTING)
    if (!reply.ok) return { missing: `读不到单元文件夹插件的设置 unit-folder.units-root（${reply.error ?? '没给原因'}）` }
    const root = rootFromSetting(reply.data)
    return root === undefined ? { missing: '没配容器根（单元文件夹插件的设置 unit-folder.units-root）' } : { root }
  }

  /** 两条命令共用：校验参数 → 读容器根 → 组选项 → 建站。出错时补上命令名 */
  const runCreate = async <T>(
    command: string,
    raw: unknown,
    optionsFor: (args: CreateArgs) => SiteOptions,
    receipt: (args: CreateArgs, site: SiteResult, lookup: UnitsRootLookup) => T,
  ): Promise<{ ok: true; data: T } | { ok: false; error: string }> => {
    const parsed = parseCreateArgs(command, raw)
    if (!parsed.ok) return parsed
    const lookup = await lookupUnitsRoot()
    let site: SiteResult
    try {
      const options = optionsFor(parsed.args)
      site = await createSite('root' in lookup ? { ...options, unitsRoot: lookup.root } : options)
    } catch (error) {
      return { ok: false, error: `${command} 没建成：${messageOf(error)}` }
    }
    log.info(`${command}：${site.target} 端口 ${String(site.port)}，写了 ${String(site.written.length)} 个文件`)
    return { ok: true, data: receipt(parsed.args, site, lookup) }
  }

  const portRule =
    'port 不给就在整个容器根（单元文件夹插件的设置 unit-folder.units-root；读不到或站不在它里面时是站目录的祖父目录）里找没被别的站脚本占用的，从 4310 起选；' +
    '查重时读不成的目录或 package.json 列在 portScanIncomplete（[{ path, reason }]）里，不影响建站。'
  const scaffoldRule =
    '先运行官方脚手架 create-fumadocs-app（版本写死，要联网）生成，再应用本机约定：加 pnpm-workspace.yaml 放行 esbuild、dev / start 脚本写端口并只监听 127.0.0.1、' +
    '不从 Google 加载字体改用 Sarasa Mono SC、页面语言 zh-CN、站名、去掉指向 GitHub 的链接、删掉分享图路由 src/app/og/ 与落地页 src/app/(home)/ 并把 / 跳到 /docs、' +
    '.gitignore 排除 next dev 在站根生成的 AGENTS.md 与 CLAUDE.md、每页 md 的 Content-Type 带 charset=utf-8。' +
    '有问题一次列全、一个文件不写；写到一半失败就删掉新建的目录。只写文件，不运行 pnpm install。'

  ctx.effect(() =>
    cli.register(
      {
        name: CREATE_COMMAND,
        description: '建一个接好 docfirst 的文档站（现状、轨迹、未来三个区）',
        usage:
          '{ dir: string, title?: string, port?: number }。' +
          'dir 是站目录的绝对路径，约定是 <仓>/docs-site：它必须还不存在，上一级（仓目录）必须已经存在。' +
          'title 是显示名，不给就依次用仓根 package.json 的 title、包名去掉 scope、仓目录名。' +
          portRule +
          scaffoldRule +
          '在此之上：替换 src/lib/source.ts（三个区 docs 现状、trajectory 轨迹、future 未来的集合与 loader）、src/components/mdx.tsx、' +
          'src/app/docs/layout.tsx（侧栏三个根节点）与 content/docs/index.mdx，删掉示例页 content/docs/test.mdx，' +
          '新增轨迹与未来两个区的路由（轨迹区是整页星轨盘 /trajectory 加卡页 /trajectory/<卡身份>）、docfirst.config.mjs、组件名册与名册脚本、样式、' +
          '现状与未来两区的起始页、轨迹区的侧栏（第一条链到星轨盘，卡由人或 agent 以后写）与 README / AGENTS / CLAUDE 的正本（content/docs/outputs/），' +
          '外加 docfirst 的依赖（@godcreator/docfirst-workflow）与 doc 脚本。不 render、不 check。' +
          '回 { dir, repoDir, port, written, overwrites, portScanIncomplete, next, warn? }——written 是写了哪些文件（相对站目录），' +
          'overwrites 是仓根已有、第一次 render 会覆盖的文件，next 是接着要在站目录里运行的命令，warn 汇总要人注意的事（覆盖、端口查重）',
        plugin: PLUGIN,
        effect: 'write',
      },
      (raw) =>
        runCreate(
          CREATE_COMMAND,
          raw,
          (args) =>
            planCreate({
              siteDir: args.siteDir,
              repoManifest: readRepoManifest(args.repoDir),
              template: readTemplate(),
              ...(args.title === undefined ? {} : { title: args.title }),
              ...(args.port === undefined ? {} : { port: args.port }),
            }),
          (args, site, lookup) => {
            const overwrites = filesFirstRenderOverwrites(args.repoDir)
            const warnings = portScanNotes(site, lookup)
            if (overwrites.length > 0) {
              warnings.unshift(
                `仓根已有 ${overwrites.join('、')}：docfirst 配置里预置了 outputs 映射，第一次 pnpm doc:render 会覆盖它们——先把内容搬进 content/docs/outputs/ 下对应的 mdx 正本，再 render`,
              )
            }
            return {
              dir: site.target,
              repoDir: args.repoDir,
              port: site.port,
              written: site.written,
              overwrites,
              portScanIncomplete: site.portScan.incomplete,
              next: nextSteps(site.target, site.port),
              ...(warnings.length > 0 ? { warn: warnings.join('；') } : {}),
            }
          },
        ),
    ),
  )

  ctx.effect(() =>
    cli.register(
      {
        name: CREATE_PLAIN_COMMAND,
        description: '建一个不接 docfirst 的普通 fumadocs 站',
        usage:
          '{ dir: string, title?: string, port?: number }。' +
          'dir 是站目录的绝对路径（约定是 <仓>/docs-site），必须还不存在、上一级得存在。' +
          'title 不给就依次用仓根 package.json 的 title、包名去掉 scope、仓目录名。' +
          portRule +
          scaffoldRule +
          '回 { dir, port, portTakenBy?, title, files: string[], usedPorts: [{ port, dir }], portScanIncomplete: [{ path, reason }], note }',
        plugin: PLUGIN,
        effect: 'write',
      },
      (raw) =>
        runCreate(
          CREATE_PLAIN_COMMAND,
          raw,
          (args) => ({
            dir: args.siteDir,
            ...(args.title === undefined ? {} : { title: args.title }),
            ...(args.port === undefined ? {} : { port: args.port }),
          }),
          (_args, site, lookup) => ({
            dir: site.target,
            port: site.port,
            ...(site.portTakenBy === undefined ? {} : { portTakenBy: site.portTakenBy }),
            title: site.title,
            files: site.written,
            usedPorts: [...site.used].map(([port, dir]) => ({ port, dir })),
            portScanIncomplete: site.portScan.incomplete,
            note: [
              ...portScanNotes(site, lookup),
              `只写了文件。接着在 ${site.target} 运行 pnpm install，再 pnpm build，看页面用 pnpm start（http://127.0.0.1:${String(site.port)}）`,
            ].join('。'),
          }),
        ),
    ),
  )

  // 说明书是可选注入：没装 skills 插件的 home 里本插件照常加载。产物在 dist/ 下，包根的 skills/ 是 '../skills/'
  ctx.inject(['gwbSkills'], (scoped) => {
    scoped.effect(() => scoped.gwbSkills.register(new URL('../skills/', import.meta.url)))
  })

  log.info(`docfirst 插件就绪：命令 ${CREATE_COMMAND}、${CREATE_PLAIN_COMMAND} 与 skills/ 下的说明书，对 @godcreator/docfirst-* 四个包零依赖`)
}
