import fs from 'node:fs'
import path from 'node:path'
import type { GwbContext } from '@godcreator/gwb-kernel-desktop'
// 只为让这两个插件的 `declare module 'cordis'` 生效，它们给 ctx 加上各自的服务名
import type {} from '@godcreator/gwb-commands'
import type {} from '@godcreator/gwb-skills'
import { attachSite, type AttachResult } from './attach.js'

/**
 * docfirst 插件：一条装配命令 `docfirst.attach`，加 `skills/` 下的说明书。
 *
 * 核对、确认、渲染在仓里发生，归 `@godcreator/docfirst-workflow` 包，agent 在仓里跑 `pnpm doc`；
 * 本插件对那个包零依赖（`tests/artifact.test.ts` 检查）。站的生成、启动、停止、端口与窗格归站点插件
 * `@godcreator/gwb-docs-site`，两个插件互不依赖，只经命令总线通信。
 */
export const name = 'gwb-docfirst-workflow'

export const ATTACH_COMMAND = 'docfirst.attach'

export const inject = ['gwbCommands']

export function apply(ctx: GwbContext): void {
  const log = ctx.logger(name)

  const cli = ctx.gwbCommands
  // inject 保证了它在，这句只是把类型收窄
  if (cli === undefined) return

  /**
   * 目标站要绝对路径：插件跑在工作台主进程里，不知道该相对于哪个目录。
   * 「不是目录」在这里先拦下，错误文本点出最常见的错：dir 给成了仓目录。其余检查归装配模块。
   */
  function siteOf(args: unknown): { ok: true; dir: string } | { ok: false; error: string } {
    const raw = isRecord(args) ? args['dir'] : undefined
    if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, error: `${ATTACH_COMMAND} 要 { dir: string }——目标站目录的绝对路径` }
    if (!path.isAbsolute(raw.trim())) return { ok: false, error: `dir 要是绝对路径（这里不知道该相对于哪个目录），给的是：${raw}` }
    const dir = path.resolve(raw.trim())
    let isDir = false
    try {
      isDir = fs.statSync(dir).isDirectory()
    } catch {
      isDir = false
    }
    if (!isDir) return { ok: false, error: `不是目录：${dir}——装配要在已经生成的 fumadocs 骨架上进行，先用站点插件的 docs-site.create 生成骨架` }
    return { ok: true, dir }
  }

  /** `dir` 之外的字符串参数，空白算没给 */
  function textOf(args: unknown, key: string): string | undefined {
    const raw = isRecord(args) ? args[key] : undefined
    return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined
  }

  /** 装配只写文件，安装依赖、渲染、核对由人或 agent 在那个仓里跑 */
  function nextSteps(result: AttachResult): string[] {
    return [
      `cd ${result.target}`,
      'pnpm install',
      'pnpm doc:render     # 生成仓根 README.md / AGENTS.md / CLAUDE.md（正本在 content/docs/outputs/）',
      'pnpm doc            # docfirst check',
      `pnpm dev            # http://localhost:${String(result.port)}`,
    ]
  }

  ctx.effect(() =>
    cli.register(
      {
        name: ATTACH_COMMAND,
        description: '给一个已经生成的 fumadocs 骨架装上 docfirst',
        usage:
          '{ dir: string, title?: string }。' +
          'dir 是站目录的绝对路径（约定是 <仓>/docs-site，骨架由站点插件的 docs-site.create 生成）。' +
          '写入 content/ 下三个区（docs 现状、trajectory 轨迹、future 未来）的集合、路由、侧栏与骨架页，README / AGENTS / CLAUDE 的正本（content/docs/outputs/），' +
          'docfirst.config.mjs、mdx 接线与组件名册脚本，' +
          '并往站的 package.json 里补 docfirst 的依赖与 doc 脚本。' +
          '只在刚生成的骨架上进行：站里已经有 docfirst.config.*、或 content/ 下有骨架之外的内容，就回「这个站已有内容，请人工接线」，不写任何文件。' +
          '要写的路径被已有的目录或文件挡住时一个文件都不写；写盘途中失败时站恢复原样。' +
          '只写文件：不跑 pnpm install、不 render、不 check。' +
          '回 { dir, repoDir, port, written, replaced, superseded, overwrites, next }——written 是写了哪些文件，replaced 是其中覆盖了站上已有的哪些，' +
          'superseded 是删掉的骨架文件，overwrites 是第一次 render 会覆盖的仓根文件，next 是接着要在那个仓里跑的命令',
        plugin: '@godcreator/gwb-docfirst-workflow',
      },
      (args) => {
        const site = siteOf(args)
        if (!site.ok) return site
        let result: AttachResult
        try {
          result = attachSite({ siteDir: site.dir, title: textOf(args, 'title') })
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) }
        }
        log.info(`${ATTACH_COMMAND}：${site.dir} 写了 ${String(result.written.length)} 个文件`)
        return {
          ok: true,
          data: {
            dir: result.target,
            repoDir: result.repoDir,
            port: result.port,
            written: result.written,
            replaced: result.replaced,
            superseded: result.superseded,
            overwrites: result.overwrites,
            next: nextSteps(result),
            ...(result.overwrites.length > 0
              ? {
                  warn: `仓根已有 ${result.overwrites.join('、')}：docfirst 配置里预置了 outputs 映射，第一次 pnpm doc:render 会覆盖它们——先把内容搬进 content/docs/outputs/ 下对应的 mdx 正本，再 render`,
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

  log.info(`docfirst 插件就绪：命令 ${ATTACH_COMMAND} 与 skills/ 下的说明书，对 @godcreator/docfirst-workflow 零依赖`)
}

/** 命令参数是外部输入：只有普通对象才按键取值 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
