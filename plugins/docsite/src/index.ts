import type { GwbContext } from '@godcreator/gwb-kernel-desktop'
// 空的类型 import 只为让这几个包的 `declare module 'cordis'` 生效，ctx 上才有各服务的类型
import type {} from '@godcreator/gwb-commands'
import type {} from '@godcreator/gwb-data'
import type {} from '@godcreator/gwb-settings'
import type {} from '@godcreator/gwb-skills'
import { registerCommands } from './commands.js'
import { registerDocfirstCommands } from './docfirst/commands.js'
import { launchDevServer } from './dev-server.js'
import { HostedSites } from './hosted-sites.js'
import { isIdentityCode, joinPeople, newIdentityCode } from './people-file.js'
import { runPnpm } from './pnpm.js'
import { addSiteFeature } from './scaffold/add-feature.js'
import { createDocsite } from './scaffold/create.js'
import type { HomePageCheckDeps } from './scaffold/home-page-check.js'
import { loadPlatformScaffold, pluginDir } from './scaffold/platform.js'
import { DocsiteService, type GwbDocsiteApi } from './service.js'
import { SiteHost } from './site-host.js'
import { SitePorts } from './site-ports.js'

/** 写在包入口：devkit.release 只读类型入口 dist/index.d.ts 认服务由谁提供 */
declare module 'cordis' {
  interface Context {
    gwbDocsite: GwbDocsiteApi
  }
}

export type { GwbDocsiteApi } from './service.js'
export type { SiteStarted, SiteState, SiteStatus } from './site-host.js'
export type { JoiningPerson } from '@godcreator/identity'
export type { SiteInitOptions, SiteInitResult } from './scaffold/create.js'
export type { SiteFeatureAdded, SiteFeatureOptions } from './scaffold/add-feature.js'

export const name = 'gwb-docsite'

export const inject = ['gwbCommands', 'gwbSettings', 'gwbData']

/** 产物在 dist/index.js，说明书目录是它上一级的 skills/ */
const skillsDir = new URL('../skills/', import.meta.url)

const settingDefinitions = [
  {
    key: 'identity-code',
    type: 'string',
    title: '身份码',
    description:
      '本 home 的身份码：站点的 people.json 里按它认出「我是谁」。插件第一次加载时生成 12 个小写字母与数字；换电脑时把旧电脑的码填到这里（8 到 64 个小写字母或数字），改了以后新启动的开发服务才用新的码',
    default: '',
  },
  { key: 'sites', type: 'string-list', title: '托管的站点', description: '常驻的站点目录，一行一个绝对路径；插件每次加载时启动它们。docsite.site.add 登记的，和别的插件经服务登记的（如 gwb-collab 的项目站点，加进项目列表时登记、移出时去掉）都在这里', default: [] },
] as const

function stringList(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new Error(`设置 sites 要是字符串列表，读到 ${JSON.stringify(value)}`)
  return value
}

/** 装配：身份码、托管站点（每个站上次的端口记在 gwb-data 里）、服务 gwbDocsite、命令（含建 docfirst 站的 docfirst.create）与说明书 */
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

  const ports = new SitePorts({ readDoc: (doc) => ctx.gwbData.readDoc(doc), writeDoc: (doc, value) => ctx.gwbData.writeDoc(doc, value) }, async (port) => (await loadPlatformScaffold()).isPortFree(port))
  const host = new SiteHost({ log, launchDevServer, identityCode, ports })
  ctx.effect(() => () => void host.stopAll())

  const hosted = new HostedSites({ get: () => stringList(settings.get('sites')), set: (dirs: string[]) => settings.set('sites', dirs) }, host)

  const homePageCheck: HomePageCheckDeps = {
    isRegistered: (siteDir) => hosted.isRegistered(siteDir),
    start: (siteDir) => host.start(siteDir),
    stop: (siteDir) => host.stop(siteDir),
    pageStatus: async (url) => (await fetch(new URL('/', url))).status,
  }
  const scaffold = () => loadPlatformScaffold()

  const api: GwbDocsiteApi = {
    identityCode,
    add: (dir) => hosted.add(dir),
    remove: (dir) => hosted.remove(dir),
    start: (dir) => host.start(dir),
    stop: (dir) => host.stop(dir),
    status: (dir) => host.statusOf(dir),
    push: (dir, channel, data) => host.push(dir, channel, data),
    join: (dir, person) => joinPeople(dir, identityCode(), person),
    onStatus: (listener) => host.onStatus(listener),
    init: (dir, options) => createDocsite(dir, options, { ...homePageCheck, scaffold, pnpm: runPnpm, packageSource: { kind: 'registry', resolveFrom: pluginDir } }),
    addFeature: (dir, options) =>
      addSiteFeature(dir, options, { ...homePageCheck, scaffold, pnpm: runPnpm, versionsFrom: pluginDir, isRunning: (siteDir) => host.statusOf(siteDir).state === 'running' }),
  }
  new DocsiteService(ctx, api)

  hosted.startAll((message) => log.warn(message))

  registerCommands({ commands, docsite: api, isRegistered: (dir) => hosted.isRegistered(dir), list: () => host.list() })
  registerDocfirstCommands({ commands, docsite: api, packagesFrom: pluginDir, log })

  ctx.inject(['gwbSkills'], (scoped) => {
    scoped.effect(() => scoped.gwbSkills.register(skillsDir))
  })
}
