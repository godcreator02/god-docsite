import fs from 'node:fs'
import path from 'node:path'
import type { GwbContext } from '@godcreator/gwb-kernel-desktop'
// 只为让这三个插件的 `declare module 'cordis'` 生效，它们给 ctx 加上各自的服务名
import type {} from '@godcreator/gwb-commands'
import type {} from '@godcreator/gwb-docs-site'
import type {} from '@godcreator/gwb-skills'
import { planCreate } from './create.js'
import { filesFirstRenderOverwrites, readRepoManifest } from './repo-root.js'
import { readTemplate } from './template.js'

/**
 * docfirst 插件：一条建站命令 `docfirst.create`，加 `skills/` 下的说明书。
 *
 * 核对、确认、渲染在仓里发生，归 `@godcreator/docfirst-*` 四个 npm 包（pin、trajectory、workflow、fumadocs），
 * agent 在仓里跑 `pnpm doc`；本插件对四个包都零依赖（`tests/artifact.test.ts` 检查），建站时只把 workflow 与 fumadocs
 * 两个包名写进站的 devDependencies（`src/deps.ts`）。建站时站点插件 `@godcreator/gwb-docs-site` 跑官方脚手架、
 * 套本机约定并写盘，本插件经命令总线按名字调它的 `docs-site.create`，只提供在官方输出上增、换、删哪些文件。
 */
export const name = 'gwb-docfirst-workflow'

export const CREATE_COMMAND = 'docfirst.create'

/** 站点插件的建站命令：参数形状是它导出的 `CreateSiteArgs` */
const DOCS_SITE_CREATE = 'docs-site.create'

/** `gwbDocsSite` 是站点插件的存在标记：注入它，本插件就只在装了站点插件的 home 里加载 */
export const inject = ['gwbCommands', 'gwbDocsSite']

/** 命令认的参数，多给一个键就报错 */
const CREATE_ARG_KEYS = ['dir', 'title', 'port']

/** 校验过的命令参数 */
interface CreateArgs {
  siteDir: string
  repoDir: string
  title?: string
  port?: number
}

/** `docs-site.create` 成功回执里本插件用到的字段 */
interface DocsSiteCreated {
  dir: string
  port: number
  files: string[]
}

export function apply(ctx: GwbContext): void {
  const log = ctx.logger(name)

  const cli = ctx.gwbCommands
  // inject 保证了它在，这句只是把类型收窄
  if (cli === undefined) return

  ctx.effect(() =>
    cli.register(
      {
        name: CREATE_COMMAND,
        description: '建一个接好 docfirst 的文档站（现状、轨迹、未来三个区）',
        usage:
          '{ dir: string, title?: string, port?: number }。' +
          'dir 是站目录的绝对路径，约定是 <仓>/docs-site：它必须还不存在，上一级（仓目录）必须已经存在。' +
          'title 是显示名，不给就依次用仓根 package.json 的 title、包名去掉 scope、仓目录名；port 不给由站点插件挑。' +
          '站点插件的 docs-site.create 先跑官方脚手架 create-fumadocs-app、套本机约定，再按本插件给的清单改文件并写盘，它失败时目标目录整个删掉。' +
          '本插件的清单：替换 src/lib/source.ts（三个区 docs 现状、trajectory 轨迹、future 未来的集合与 loader）、src/components/mdx.tsx、' +
          'src/app/docs/layout.tsx（侧栏三个根节点）与 content/docs/index.mdx，删掉示例页 content/docs/test.mdx，' +
          '新增轨迹与未来两个区的路由、docfirst.config.mjs、组件名册与名册脚本、样式、各区的起始页与 README / AGENTS / CLAUDE 的正本（content/docs/outputs/），' +
          '外加 docfirst 的依赖（@godcreator/docfirst-workflow 与 @godcreator/docfirst-fumadocs）与 doc 脚本。' +
          '只写文件：不跑 pnpm install、不 render、不 check。' +
          '回 { dir, repoDir, port, written, overwrites, next, warn? }——written 是写了哪些文件（相对站目录），' +
          'overwrites 是仓根已有、第一次 render 会覆盖的文件，next 是接着要在站目录里跑的命令',
        plugin: '@godcreator/gwb-docfirst-workflow',
      },
      async (raw) => {
        const parsed = parseCreateArgs(raw)
        if (!parsed.ok) return parsed
        const args = parsed.args

        const siteArgs = planCreate({
          siteDir: args.siteDir,
          repoManifest: readRepoManifest(args.repoDir),
          template: readTemplate(),
          ...(args.title === undefined ? {} : { title: args.title }),
          ...(args.port === undefined ? {} : { port: args.port }),
        })
        const overwrites = filesFirstRenderOverwrites(args.repoDir)

        const result = await cli.run(DOCS_SITE_CREATE, siteArgs)
        if (!result.ok) return { ok: false, error: `${DOCS_SITE_CREATE} 没建成：${result.error ?? '（它没给错误说明）'}` }
        const created = result.data
        if (!isDocsSiteCreated(created)) {
          return { ok: false, error: `${DOCS_SITE_CREATE} 回了成功，但回执不是 { dir: string, port: number, files: string[] }：${JSON.stringify(created)}` }
        }

        log.info(`${CREATE_COMMAND}：${created.dir} 写了 ${String(created.files.length)} 个文件`)
        return {
          ok: true,
          data: {
            dir: created.dir,
            repoDir: args.repoDir,
            port: created.port,
            written: created.files,
            overwrites,
            next: nextSteps(created.dir, created.port),
            ...(overwrites.length > 0
              ? {
                  warn: `仓根已有 ${overwrites.join('、')}：docfirst 配置里预置了 outputs 映射，第一次 pnpm doc:render 会覆盖它们——先把内容搬进 content/docs/outputs/ 下对应的 mdx 正本，再 render`,
                }
              : {}),
          },
        }
      },
    ),
  )

  // 说明书是可选注入：没装 skills 插件的 home 里本插件照常加载。产物在 dist/ 下，包根的 skills/ 是 '../skills/'
  ctx.inject(['gwbSkills'], (scoped) => {
    scoped.effect(() => scoped.gwbSkills.register(new URL('../skills/', import.meta.url)))
  })

  log.info(`docfirst 插件就绪：命令 ${CREATE_COMMAND} 与 skills/ 下的说明书，对 @godcreator/docfirst-* 四个包零依赖`)
}

/**
 * 命令参数是外部输入。站目录要绝对路径：插件跑在工作台主进程里，不知道该相对于哪个目录。
 * 站目录还不能存在由站点插件检查，这里只查它的上一级（仓目录）在不在。
 */
function parseCreateArgs(raw: unknown): { ok: true; args: CreateArgs } | { ok: false; error: string } {
  const shape = `${CREATE_COMMAND} 要 { dir: string, title?: string, port?: number }`
  if (!isRecord(raw)) return { ok: false, error: `${shape}，给的不是对象` }
  const unknownKeys = Object.keys(raw).filter((key) => !CREATE_ARG_KEYS.includes(key))
  if (unknownKeys.length > 0) return { ok: false, error: `${shape}，不认识的参数：${unknownKeys.join('、')}` }

  const dir = raw['dir']
  if (typeof dir !== 'string' || dir.trim() === '') return { ok: false, error: `${shape}，dir 是站目录的绝对路径` }
  if (!path.isAbsolute(dir)) return { ok: false, error: `dir 要是绝对路径（这里不知道该相对于哪个目录），给的是：${dir}` }
  const siteDir = path.resolve(dir)
  const repoDir = path.dirname(siteDir)
  if (fs.statSync(repoDir, { throwIfNoEntry: false })?.isDirectory() !== true) {
    return { ok: false, error: `站目录的上一级要是已经存在的仓目录，没有这个目录：${repoDir}` }
  }

  const title = raw['title']
  if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) return { ok: false, error: `${shape}，title 给了就要是非空字符串` }
  const port = raw['port']
  if (port !== undefined && (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535)) {
    return { ok: false, error: `${shape}，port 给了就要是 1 到 65535 之间的整数，给的是：${String(port)}` }
  }

  return {
    ok: true,
    args: {
      siteDir,
      repoDir,
      ...(title === undefined ? {} : { title: title.trim() }),
      ...(port === undefined ? {} : { port }),
    },
  }
}

/** `docs-site.create` 的回执来自另一个插件：按它的契约检查本插件要用的几个字段 */
function isDocsSiteCreated(data: unknown): data is DocsSiteCreated {
  return (
    isRecord(data) &&
    typeof data['dir'] === 'string' &&
    typeof data['port'] === 'number' &&
    Array.isArray(data['files']) &&
    data['files'].every((file) => typeof file === 'string')
  )
}

/** 建站只写文件，安装依赖、渲染、核对由人或 agent 在那个站目录里跑 */
function nextSteps(siteDir: string, port: number): string[] {
  return [
    `cd ${siteDir}`,
    'pnpm install',
    'pnpm doc:render     # 生成仓根 README.md / AGENTS.md / CLAUDE.md（正本在 content/docs/outputs/）',
    'pnpm doc            # docfirst check',
    `pnpm dev            # http://127.0.0.1:${String(port)}`,
  ]
}

/** 命令参数是外部输入：只有普通对象才按键取值 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
