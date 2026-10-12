import type { GwbContext } from '@godcreator/gwb-kernel-desktop'
// 只为让这几个插件的 `declare module 'cordis'` 生效，它们给 ctx 加上各自的服务名
import type {} from '@godcreator/gwb-commands'
import type {} from '@godcreator/gwb-skills'
import type { GwbDocsiteApi } from '@godcreator/gwb-docsite'
import { parseCreateArgs } from './args.js'
import { DOCFIRST_SITE_FEATURE } from './deps.js'
import { pickPort, scanUsedPorts } from './ports.js'
import { readRepoManifest } from './repo-root.js'
import { siteTitle } from './values.js'

/**
 * docfirst 插件：一条建站命令 `docfirst.create`，加 `skills/` 下的说明书。
 * 建站经 gwb-docsite 的服务 gwbDocsite：地基骨架、装依赖、探活都是它的，这条命令只做 docfirst 特有的两件事——
 * 认站名与选端口（4310 起、容器根里查重），再把功能包 `@godcreator/docfirst-site`（版本表在 `src/deps.ts`）
 * 作为 features 交给它。起始物（docfirst.config.mjs、outputs 正本、轨迹与未来区起始页）由功能包的模板带进站。
 *
 * 核对、确认、渲染在仓里发生，归 `@godcreator/docfirst-*` 各包，agent 在站目录运行 `pnpm doc`；
 * 本插件对 npm 包零依赖（`tests/artifact.test.ts` 检查），deps.ts 里的包名只是写进新站 package.json 的字符串。
 */
export const name = 'gwb-docfirst-workflow'

export const CREATE_COMMAND = 'docfirst.create'

export const inject = ['gwbCommands']

const PLUGIN = '@godcreator/gwb-docfirst-workflow'

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function apply(ctx: GwbContext): void {
  const log = ctx.logger(name)

  const cli = ctx.gwbCommands
  // inject 保证了它在，这句只是把类型收窄
  if (cli === undefined) return

  // gwb-docsite 的服务是局部注入：没装它的 home 里本插件照常加载，建站命令明确报缺它
  let docsite: GwbDocsiteApi | undefined
  ctx.inject(['gwbDocsite'], (scoped) => {
    docsite = scoped.gwbDocsite
    scoped.effect(() => () => {
      docsite = undefined
    })
  })

  ctx.effect(() =>
    cli.register(
      {
        name: CREATE_COMMAND,
        description: '建一个接好 docfirst 的文档站（现状、轨迹、未来三个区），地基骨架与依赖由 gwb-docsite 的建站器负责',
        usage:
          '{ dir: string, title?: string, port?: number }。' +
          'dir 是站目录的绝对路径，约定是 <仓>/docs-site：它必须还不存在（或只有 package.json），上一级（仓目录）必须已经存在。' +
          'title 是显示名，不给就依次用仓根 package.json 的 title、包名去掉 scope、仓目录名。' +
          'port 不给就在站目录的祖父目录里找没被别的站脚本占用的，从 4310 起选。' +
          '建站经 gwbDocsite.init：装功能包 @godcreator/docfirst-site 的精确版本（版本表在插件 src/deps.ts）、写骨架与起始物、装依赖、起服务探活。' +
          '仓根已有 README.md / AGENTS.md / CLAUDE.md 时第一次 pnpm doc:render 会覆盖它们，回执 warn 里点名。' +
          '回 { dir, port, title, warn? }',
        plugin: PLUGIN,
        effect: 'write',
      },
      async (raw: unknown) => {
        const parsed = parseCreateArgs(CREATE_COMMAND, raw)
        if (!parsed.ok) return parsed
        const { args } = parsed
        if (docsite === undefined) return { ok: false, error: `${CREATE_COMMAND} 要装 gwb-docsite 插件（它提供建站服务 gwbDocsite）` }
        const manifest = readRepoManifest(args.repoDir)
        const title = siteTitle(args.repoDir, manifest, args.title)
        const scan = scanUsedPorts(args.repoDir)
        const port = pickPort(scan.used, args.port)
        try {
          await docsite.init(args.siteDir, { port, title, features: DOCFIRST_SITE_FEATURE })
        } catch (error) {
          return { ok: false, error: `${CREATE_COMMAND} 没建成：${messageOf(error)}` }
        }
        log.info(`${CREATE_COMMAND}：${args.siteDir} 端口 ${String(port)}`)
        return { ok: true, data: { dir: args.siteDir, port, title } }
      },
    ),
  )

  // 说明书是可选注入：没装 skills 插件的 home 里本插件照常加载。产物在 dist/ 下，包根的 skills/ 是 '../skills/'
  ctx.inject(['gwbSkills'], (scoped) => {
    scoped.effect(() => scoped.gwbSkills.register(new URL('../skills/', import.meta.url)))
  })

  log.info(`docfirst 插件就绪：命令 ${CREATE_COMMAND} 与 skills/ 下的说明书，对 npm 包零依赖`)
}
