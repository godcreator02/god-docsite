import type { GwbContext } from '@godcreator/gwb-kernel-desktop'
// 只为让这几个插件的 `declare module 'cordis'` 生效，它们给 ctx 加上各自的服务名
import type {} from '@godcreator/gwb-commands'
import type {} from '@godcreator/gwb-skills'
import type { GwbDocsiteApi } from '@godcreator/gwb-docsite'
import { parseCreateArgs } from './args.js'
import { createDocfirstSite, DOCFIRST_FEATURES, DOCFIRST_PACKAGE, PLUGIN_DIR } from './docfirst-site.js'
import { pickPort, scanUsedPorts } from './ports.js'
import { filesFirstRenderOverwrites, readRepoManifest } from './repo-root.js'
import { siteTitle } from './values.js'

/**
 * docfirst 插件：一条建站命令 `docfirst.create`，加 `skills/` 下的说明书。
 * 建站与加功能经 gwb-docsite 的服务 gwbDocsite：骨架、装依赖、探活都是它的，这条命令只做 docfirst 特有的几件事——
 * 认站名与选端口（4310 起、容器根里查重），叠 `@godcreator/docfirst` 的起始物、写 doc 系列脚本，加钉码、轨迹卡、讲解组件三个功能包。
 *
 * 核对、确认、渲染在仓里发生，归 `@godcreator/docfirst` 命令行，agent 在站目录运行 `pnpm doc`；
 * 本插件不 import 任何包（`tests/artifact.test.ts` 检查），那几个包在 dependencies 里只为按路径读版本与起始物。
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
        description: '建一个接好 docfirst 的文档站（现状、轨迹、未来三个区）：基础站与功能包由 gwb-docsite 建、加，本命令叠 docfirst 的起始物与脚本',
        usage:
          '{ dir: string, title?: string, port?: number }。' +
          'dir 是站目录的绝对路径，约定是 <仓>/docs-site：它必须还不存在（或是空目录），上一级（仓目录）必须已经存在。' +
          'title 是显示名，不给就依次用仓根 package.json 的 title、包名去掉 scope、仓目录名。' +
          'port 不给就在站目录的祖父目录里找没被别的站脚本占用的，从 4310 起选。' +
          `先经 gwbDocsite.init 建基础站（装依赖、起服务检查）；再把 ${DOCFIRST_PACKAGE} 的 template/（docfirst.config.mjs、outputs 正本、未来区起始页、第一张轨迹卡）叠到站点根（已有的文件不覆盖），` +
          `往站点 package.json 写脚本 doc / doc:confirm / doc:render 与 devDependencies 里的 ${DOCFIRST_PACKAGE}；最后经 gwbDocsite.addFeature 逐个加 ${DOCFIRST_FEATURES.join('、')}（每加一个起服务检查一次）。` +
          '这几个包的版本都是本插件旁边装着的那一版写 ^<版本>。中途失败时前面做完的不回退，报错写明卡在哪一步。' +
          '仓根已有 README.md / AGENTS.md / CLAUDE.md 时第一次 pnpm doc:render 会覆盖它们，回执 warn 里点名。' +
          '回 { dir, port, title, features, warn? }',
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
        const overwritten = filesFirstRenderOverwrites(args.repoDir)
        let features: string[]
        try {
          ;({ features } = await createDocfirstSite(args.siteDir, { port, title }, { docsite, packagesFrom: PLUGIN_DIR }))
        } catch (error) {
          return { ok: false, error: `${CREATE_COMMAND} 没建成：${messageOf(error)}` }
        }
        log.info(`${CREATE_COMMAND}：${args.siteDir} 端口 ${String(port)}`)
        const warn = overwritten.length > 0 ? `仓根已有 ${overwritten.join('、')}：第一次 pnpm doc:render 会用 content/docs/outputs/ 里的正本覆盖它们，要留的内容先搬进正本` : undefined
        return { ok: true, data: { dir: args.siteDir, port, title, features, ...(warn === undefined ? {} : { warn }) } }
      },
    ),
  )

  // 说明书是可选注入：没装 skills 插件的 home 里本插件照常加载。产物在 dist/ 下，包根的 skills/ 是 '../skills/'
  ctx.inject(['gwbSkills'], (scoped) => {
    scoped.effect(() => scoped.gwbSkills.register(new URL('../skills/', import.meta.url)))
  })

  log.info(`docfirst 插件就绪：命令 ${CREATE_COMMAND} 与 skills/ 下的说明书`)
}
