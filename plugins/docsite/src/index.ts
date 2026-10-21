import { hostContextFormat, type HostContext } from '@godcreator/god-docsite'
import { siteIdentityOf } from '@godcreator/god-docsite/identity'
import type { GwbContext } from '@godcreator/gwb-kernel-desktop'
// 空的类型 import 只为让这几个包的 `declare module 'cordis'` 生效，ctx 上才有各服务的类型
import type {} from '@godcreator/gwb-commands'
import type {} from '@godcreator/gwb-data'
import type {} from '@godcreator/gwb-settings'
import type { GwbShellApi } from '@godcreator/gwb-shell'
import type {} from '@godcreator/gwb-skills'
import { chromeCandidatesOf, findChrome, openInChromeApp } from './chrome-app.js'
import { registerCommands } from './commands.js'
import { readComments } from './comments.js'
import { registerDocfirstCommands } from './docfirst/commands.js'
import { devServerLauncher } from './dev-server.js'
import { addedByCommand, HostedSites } from './hosted-sites.js'
import { isIdentityCode, joinPeople, newIdentityCode } from './people-file.js'
import { runPnpm } from './pnpm.js'
import { ProvidedSiteDirs } from './provided-dirs.js'
import { listInstalledFontFamilies, readerFontsFrom, readerFontSettings } from './reader-fonts.js'
import { addSiteFeature } from './scaffold/add-feature.js'
import { createDocsite } from './scaffold/create.js'
import type { HomePageCheckDeps } from './scaffold/home-page-check.js'
import { loadPlatformNode, loadPlatformScaffold, pluginDir } from './scaffold/platform.js'
import { DocsiteService, type GwbDocsiteApi } from './service.js'
import { checkSite } from './site-check.js'
import { SiteHost } from './site-host.js'
import { siteDescriptionOf, siteListingsOf } from './site-list.js'
import { SitePorts } from './site-ports.js'

/** 写在包入口：devkit.release 只读类型入口 dist/index.d.ts 认服务由谁提供 */
declare module 'cordis' {
  interface Context {
    gwbDocsite: GwbDocsiteApi
  }
}

export type { GwbDocsiteApi } from './service.js'
export type { SiteAudience, SiteIdentity, SiteKind } from '@godcreator/god-docsite/identity'
export type { SiteStarted, SiteState, SiteStatus } from './site-host.js'
export type { JoiningPerson } from '@godcreator/identity'
export type { SiteInitOptions, SiteInitResult } from './scaffold/create.js'
export type { SiteFeatureAdded, SiteFeatureOptions } from './scaffold/add-feature.js'

export const name = 'gwb-docsite'

export const inject = ['gwbCommands', 'gwbSettings', 'gwbData']

/** 产物在 dist/index.js，说明书目录是它上一级的 skills/ */
const skillsDir = new URL('../skills/', import.meta.url)

/** 站点窗格的浏览器侧与样式表，注册窗格时报给外壳；构建产物里它们与本模块同在 dist/ 下 */
const clientUrl = new URL('./client.js', import.meta.url).href
const styleUrl = new URL('./style.css', import.meta.url).href

const settingDefinitions = [
  {
    key: 'identity-code',
    type: 'string',
    title: '身份码',
    description:
      '本 home 的身份码：站点的 people.json 里按它认出「我是谁」。插件第一次加载时生成 12 个小写字母与数字；换电脑时把旧电脑的码填到这里（8 到 64 个小写字母或数字），改了马上推给在运行的站',
    default: '',
  },
] as const

/** 装配：身份码、托管站点（常驻登记与每个站上次的端口都记在 gwb-data 里）、服务 gwbDocsite、命令（含建 docfirst 站的 docfirst.create、用 Chrome 应用窗口打开站点的 docsite.site.open）、站点窗格与说明书 */
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

  // 阅读字体：三项设置的清单是本机字体
  for (const { key, title, description } of readerFontSettings) {
    ctx.effect(() => settings.define({ key, type: 'string', title, description, options: listInstalledFontFamilies }))
  }

  const dataStore = { readDoc: (doc: string) => ctx.gwbData.readDoc(doc), writeDoc: (doc: string, value: unknown) => ctx.gwbData.writeDoc(doc, value) }
  const ports = new SitePorts(dataStore, async (port) => (await loadPlatformScaffold()).isPortFree(port))
  const providedDirs = new ProvidedSiteDirs(() => void host.pushHostContext())
  // 托管方上下文：身份码、阅读字体与插件提供的本机目录，本机目录只给个人站
  const hostContextOf = (dir: string): HostContext => {
    const identity = siteIdentityOf(dir)
    if (identity === null) throw new Error(`${dir} 下没有身份文件 docsite.json，算不出要不要给它本机目录`)
    return {
      format: hostContextFormat,
      identityCode: identityCode(),
      ...(identity.audience === 'personal' ? { dirs: providedDirs.all() } : {}),
      readerFonts: readerFontsFrom((key) => settings.get(key)),
    }
  }
  const host = new SiteHost({ log, launchDevServer: devServerLauncher(ctx.logger('gwb-docsite-dev')), hostContextOf, ports })
  for (const key of ['identity-code', ...readerFontSettings.map((setting) => setting.key)]) ctx.effect(() => settings.watch(key, () => void host.pushHostContext()))

  // 内核不等卸载回调里的异步操作，工作台退出时异步的停止来不及跑完：卸载时同步停；没经卸载就退出的，在退出事件里同步停
  const stopSitesNow = () => host.stopAllNow()
  ctx.effect(() => {
    process.once('exit', stopSitesNow)
    return () => {
      process.off('exit', stopSitesNow)
      stopSitesNow()
    }
  })

  const hosted = new HostedSites(dataStore, host)

  const homePageCheck: HomePageCheckDeps = {
    isRegistered: (siteDir) => hosted.isRegistered(siteDir),
    start: (siteDir) => host.start(siteDir),
    stop: (siteDir) => host.stop(siteDir),
    pageStatus: async (url) => (await fetch(new URL('/', url))).status,
  }
  const scaffold = () => loadPlatformScaffold()

  const api: GwbDocsiteApi = {
    identityCode,
    siteIdentity: (dir) => siteIdentityOf(dir),
    add: (dir, options) => hosted.add(dir, options?.by ?? addedByCommand),
    remove: (dir) => hosted.remove(dir),
    start: (dir) => host.start(dir),
    stop: (dir) => host.stop(dir),
    status: (dir) => host.statusOf(dir),
    push: (dir, channel, data) => host.push(dir, channel, data),
    subscribe: (dir, channel, listener) => host.subscribe(dir, channel, listener),
    join: (dir, person) => joinPeople(dir, identityCode(), person),
    provideSiteDir: (name, dir) => providedDirs.provide(name, dir),
    checkMdx: async (file, options) => (await loadPlatformNode()).checkMdx(file, options),
    checkSite,
    readComments,
    onStatus: (listener) => host.onStatus(listener),
    init: (dir, options) => createDocsite(dir, options, { ...homePageCheck, scaffold, pnpm: runPnpm, packageSource: { kind: 'registry', resolveFrom: pluginDir } }),
    addFeature: (dir, options) =>
      addSiteFeature(dir, options, { ...homePageCheck, scaffold, pnpm: runPnpm, versionsFrom: pluginDir, isRunning: (siteDir) => host.statusOf(siteDir).state === 'running' }),
  }
  new DocsiteService(ctx, api)

  hosted.startAll((message) => log.warn(message))

  const list = async () => siteListingsOf(await hosted.list(), host.list(), (dir) => host.statusOf(dir), siteDescriptionOf)
  const openSiteWindow = (url: string, siteTitle: string | null) => openInChromeApp(findChrome(chromeCandidatesOf(process.env)), url, siteTitle)
  registerCommands({ commands, docsite: api, isRegistered: (dir) => hosted.isRegistered(dir), list, openSiteWindow })
  registerDocfirstCommands({ commands, docsite: api, packagesFrom: pluginDir, log })

  ctx.inject(['gwbSkills'], (scoped) => {
    scoped.effect(() => scoped.gwbSkills.register(skillsDir))
  })

  // 没装外壳只是没有窗格
  ctx.inject(['gwbShell'], (scoped) => {
    scoped.effect(() => {
      const shellApi = scoped.gwbShell as GwbShellApi
      const unregisterPane = shellApi.registerPane({ id: 'sites', title: '站点', icon: 'globe', client: clientUrl, style: styleUrl })
      const undescribeSelf = shellApi.describeSelf({ title: '站点', icon: 'globe' })
      return () => {
        undescribeSelf()
        unregisterPane()
      }
    })
  })
}
