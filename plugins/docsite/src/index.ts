import type { GwbContext } from '@godcreator/gwb-kernel-desktop'
// 空的类型 import 只为让这几个包的 `declare module 'cordis'` 生效，ctx 上才有各服务的类型
import type {} from '@godcreator/gwb-commands'
import type {} from '@godcreator/gwb-settings'
import type {} from '@godcreator/gwb-skills'
import { siteProblems } from '@godcreator/docsite-kit/files'
import { shell } from 'electron'
import { registerCommands } from './commands.js'
import { launchDevServer, siteTitleOf } from './dev-server.js'
import { chromeCandidatesOf, findChrome, openInChromeApp, siteWindowModeOf } from './open-site.js'
import { isIdentityCode, joinPeople, newIdentityCode } from './people-file.js'
import { DocsiteService, type GwbDocsiteApi } from './service.js'
import { SiteHost } from './site-host.js'

/** 写在包入口：devkit.release 只读类型入口 dist/index.d.ts 认服务由谁提供 */
declare module 'cordis' {
  interface Context {
    gwbDocsite: GwbDocsiteApi
  }
}

export type { GwbDocsiteApi } from './service.js'
export type { SiteStarted, SiteStatus } from './site-host.js'
export type { JoiningPerson } from './people-file.js'

export const name = 'gwb-docsite'

export const inject = ['gwbCommands', 'gwbSettings']

/** 产物在 dist/index.js，说明书目录是它上一级的 skills/ */
const skillsDir = new URL('../skills/', import.meta.url)

/** 站点意外退出后隔多久再启动：等上一个进程放开端口 */
const siteRestartDelayMilliseconds = 3_000

const settingDefinitions = [
  {
    key: 'identity-code',
    type: 'string',
    title: '身份码',
    description:
      '本 home 的身份码：站点的 people.json 里按它认出「我是谁」。插件第一次加载时生成 12 个小写字母与数字；换电脑时把旧电脑的码填到这里（8 到 64 个小写字母或数字），改了以后新启动的开发服务才用新的码',
    default: '',
  },
  { key: 'sites', type: 'string-list', title: '托管的站点', description: 'docsite.site.add 登记的站点目录，一行一个绝对路径；插件每次加载时启动它们。别的插件（如 gwb-collab）托管的站点不在这里', default: [] },
  {
    key: 'site-window',
    type: 'string',
    title: '站点用什么窗口打开',
    description: 'chrome-app 用 Chrome 的应用窗口（--app），独立窗口，没有标签栏和地址栏，要装 Chrome；default-browser 在系统默认浏览器里开新标签页',
    default: 'chrome-app',
  },
] as const

function stringList(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new Error(`设置 sites 要是字符串列表，读到 ${JSON.stringify(value)}`)
  return value
}

/** 装配：身份码、托管站点、服务 gwbDocsite、命令与说明书 */
export function apply(ctx: GwbContext): void {
  const log = ctx.logger(name)
  const commands = ctx.gwbCommands
  if (commands === undefined) throw new Error('ctx.gwbCommands 不在：inject 里写了它，cordis 本不该调用 apply')
  const settings = ctx.gwbSettings

  for (const definition of settingDefinitions) ctx.effect(() => settings.define({ ...definition }))

  // 身份码第一次加载时生成；之后一直用设置里的，写错了就报错、不替人改
  if (settings.get('identity-code') === '') {
    void settings.set('identity-code', newIdentityCode()).then(() => log.info('生成了本 home 的身份码'))
  }
  const identityCode = () => {
    const code = settings.get('identity-code')
    if (!isIdentityCode(code)) throw new Error(`设置 identity-code 要是 8 到 64 个小写字母或数字，读到 ${JSON.stringify(code)}`)
    return code
  }

  const host = new SiteHost({ log, launchDevServer, identityCode, siteProblems, now: () => Date.now(), restartDelayMilliseconds: siteRestartDelayMilliseconds })
  ctx.effect(() => () => host.stopAll())

  const openInBrowser = (dir: string, url: string) => {
    if (siteWindowModeOf(settings.get('site-window')) === 'default-browser') return shell.openExternal(url)
    return openInChromeApp(findChrome(chromeCandidatesOf(process.env)), url, siteTitleOf(dir))
  }

  const api: GwbDocsiteApi = {
    identityCode,
    keep: (dir) => host.keep(dir),
    forget: (dir) => host.forget(dir),
    start: (dir) => host.start(dir),
    open: async (dir) => {
      const started = await host.start(dir)
      await openInBrowser(dir, started.url)
      return started
    },
    stop: (dir) => host.stop(dir),
    status: (dir) => host.statusOf(dir),
    whileStopped: (dir, work) => host.whileStopped(dir, work),
    push: (dir, channel, data) => host.push(dir, channel, data),
    join: (dir, person) => joinPeople(dir, identityCode(), person),
    onStatus: (listener) => host.onStatus(listener),
  }
  new DocsiteService(ctx, api)

  const sitesSetting = { get: () => stringList(settings.get('sites')), set: (dirs: string[]) => settings.set('sites', dirs) }
  for (const dir of sitesSetting.get()) void host.keep(dir)

  registerCommands({ commands, docsite: api, sitesSetting, list: () => host.list() })

  ctx.inject(['gwbSkills'], (scoped) => {
    scoped.effect(() => scoped.gwbSkills.register(skillsDir))
  })
}
