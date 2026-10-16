import { type SiteKind, writeSiteIdentity } from '@godcreator/god-docsite/identity'
import { DocsiteRejected, messageOf } from '../errors.js'
import type { RunPnpm } from '../pnpm.js'
import { checkHomePage, type HomePageCheckDeps } from './home-page-check.js'
import type { PackageSource, PlatformScaffold } from './platform.js'

export type SiteInitOptions = {
  /** 站名，写进 content/meta.json 的 title */
  title: string
  /** 站点类别，写进站点根的 docsite.json：docsite.site.init 建 base，docfirst.create 建 docs，gwb-collab 建 collab */
  kind: SiteKind
}

export type SiteInitResult = {
  dir: string
  /** 平台包（god-docsite、identity、comments）写进站点 package.json 的依赖说明，键是包名 */
  platformDependencies: Record<string, string>
}

export type CreateDocsiteDeps = HomePageCheckDeps & {
  scaffold: () => Promise<PlatformScaffold>
  /** 站点 package.json 里平台包怎么写：托管时是 registry（版本取插件旁边装着的那几个包），测试里用 link 指向本仓 */
  packageSource: PackageSource
  pnpm: RunPnpm
}

/** 新站点的 people.json：模板里那一项 agent，人由 docsite.people.join 把自己加进来 */
const initialPeople = [{ id: 'claude', name: 'Claude', agent: true }]

/**
 * 从空目录建站：平台建站器复制模板、写站名，写身份文件 docsite.json → pnpm install → 补上基础功能（评论的全站评论页与样式）→
 * 起服务检查首页（通过后登记着的站保持运行，没登记的停掉）。平台模板写出的文件写完就归站点；要功能再对它 addFeature
 */
export async function createDocsite(dir: string, { title, kind }: SiteInitOptions, deps: CreateDocsiteDeps): Promise<SiteInitResult> {
  const { createSite, addBaseFeatures } = await deps.scaffold()
  let platformDependencies: Record<string, string>
  try {
    ;({ platformDependencies } = createSite({ dir, siteName: title, people: initialPeople, packageSource: deps.packageSource }))
    writeSiteIdentity(dir, kind)
  } catch (error) {
    throw new DocsiteRejected(`没建成站点：${messageOf(error)}`)
  }
  await deps.pnpm(dir, ['install'], `${dir} 里 pnpm install`)
  try {
    addBaseFeatures({ siteDir: dir })
  } catch (error) {
    throw new DocsiteRejected(`站点建好、依赖装好了，补基础功能时出错：${messageOf(error)}`)
  }
  await checkHomePage(dir, '新站点建好、装好依赖', deps)
  return { dir, platformDependencies }
}
