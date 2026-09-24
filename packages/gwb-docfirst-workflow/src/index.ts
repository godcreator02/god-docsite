import fs from 'node:fs'
import path from 'node:path'
import type { GwbContext } from '@godcreator/gwb-kernel-desktop'
// 只为让这两个插件的 `declare module 'cordis'` 生效——它们给 ctx 加上各自的服务名
import type {} from '@godcreator/gwb-commands'
import type {} from '@godcreator/gwb-skills'
import { attachSite, type AttachResult } from './attach.js'

/**
 * docfirst 插件：**一条装六区的命令，加六份说明书**。
 *
 * 判据是「这件事在哪儿发生」——要在**仓**里发生的（核对、确认、渲染，门禁与站构建要跑的那些）
 * 归 `@godcreator/docfirst-workflow` 那个包，agent 自己 `cd` 到仓里跑 `pnpm doc`；只在 **agent** 手上
 * 发生一次的（读说明书、给一个新骨架装一次六区）归插件。于是**插件对那个包零依赖**：不启动子进程、
 * 不登记 node CLI、不查 home 里的路径，装了插件不必再装什么包，说明书就能注册上。
 * 这条边界由 `tests/artifact.test.ts` 检查。
 *
 * **本插件不管站的启动、停止与端口**——扫站、启停、端口、到时间关闭、那个窗格全在站点插件
 * （`@godcreator/gwb-docs-site`）。两个插件互不依赖，各带各的模板：站点插件生成标准 fumadocs 骨架，
 * 本插件在骨架上装六区。
 */
export const name = 'gwb-docfirst-workflow'

export const ATTACH_COMMAND = 'docfirst.attach'

/** 缺哪个服务都不调 apply——inject 是 cordis 的等待机制，不是建议 */
export const inject = ['gwbCommands']

export function apply(ctx: GwbContext): void {
  const log = ctx.logger(name)

  const cli = ctx.gwbCommands
  // inject 保证了它在，这句只是把类型收窄
  if (cli === undefined) return

  /**
   * 目标站要**绝对路径**：插件跑在工作台主进程里，不知道该相对于哪个目录。存不存在、是不是刚生成的
   * 骨架归装配那头判（它的错误文本就是文档），只有「不是目录」这一条先拦下——那句话点得出
   * 「dir 给成仓目录了」这个最常犯的错。
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

  /** 收 `{ dir }` 之外的字符串参数，空白算没给 */
  function textOf(args: unknown, key: string): string | undefined {
    const raw = isRecord(args) ? args[key] : undefined
    return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined
  }

  /** 装完接着做什么。装配**只写文件**，安装依赖、渲染、核对三步都得人或 agent 自己在那个仓里跑 */
  function nextSteps(result: AttachResult): string[] {
    return [
      `cd ${result.target}`,
      'pnpm install',
      'pnpm doc:render     # 摆出仓根 AGENTS.md / README.md（正本在 content/outputs/）',
      'pnpm doc            # docfirst check',
      `pnpm dev            # http://localhost:${String(result.port)}`,
    ]
  }

  // register 返回注销函数，包进 ctx.effect 在本插件卸载时注销；命令总线 0.4.6 起自己也随调用方卸载注销命令
  ctx.effect(() =>
    cli.register(
      {
        name: ATTACH_COMMAND,
        description: '给一个建好的 fumadocs 骨架装上 docfirst 的六区',
        usage:
          '{ dir: string, title?: string }。' +
          'dir 是**站目录**的绝对路径（约定是 <仓>/docs-site，骨架由站件 docs-site.create 铺）。' +
          '装六个集合、六条路由、侧栏六个根节、docfirst.config.mjs、mdx 接线、投影块与术语组件、名册脚本、五个区的骨架页，' +
          'package.json 里补上 docfirst 的依赖与 doc 脚本。' +
          '**只在刚铺好的骨架上跑**：站里已经有 docfirst.config.mjs、或 content/ 下已经有骨架之外的内容，就回一句「这个站已有内容，请人工接线」，不改写任何东西。' +
          '**只写文件**：不跑 pnpm install、不 render、不 check。' +
          '回 { dir, repoDir, port, written, superseded, overwrites, next }——written 是铺了哪些文件，next 是接着要在那个仓里跑的几条',
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
        log.info(`${ATTACH_COMMAND}：${site.dir} 铺了 ${String(result.written.length)} 个文件`)
        return {
          ok: true,
          data: {
            dir: result.target,
            repoDir: result.repoDir,
            port: result.port,
            written: result.written,
            superseded: result.superseded,
            overwrites: result.overwrites,
            next: nextSteps(result),
            ...(result.overwrites.length > 0
              ? {
                  warn: `仓根已有 ${result.overwrites.join('、')}：站里 outputs 预置了映射，第一次 pnpm doc:render 会覆盖它们——先把内容搬进 content/outputs/ 下对应的 mdx（那是正本），再 render`,
                }
              : {}),
          },
        }
      },
    ),
  )

  // 说明书用局部注入：没装 skills 插件的 home 里本插件照常加载。产物在 dist/ 下，包根的 skills/ 是 '../skills/'
  // 六份都随本插件发：三份讲这套机制（`docfirst` / `docfirst-docs` / `trajectory`），三份讲通用开发纪律
  // （`spec-grill` / `parallel-by-module` / `docs-governance`）——agent 读得到它们，全靠插件 register 这个目录
  ctx.inject(['gwbSkills'], (scoped) => {
    scoped.effect(() => scoped.gwbSkills.register(new URL('../skills/', import.meta.url)))
  })

  log.info(`docfirst 件就绪：一条命令（${ATTACH_COMMAND}）加六份说明书，对 @godcreator/docfirst-workflow 零依赖`)
}

/** 命令参数是外部输入：只有普通对象才按键取值 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
