import type { SiteAudience } from './site-audience.js'

/** 引用扫描在哪个站上跑：shared 站只在站点目录里找条目，个人站在托管方提供的目录里找 */
export interface ReferencePlace {
  siteDir: string
  audience: SiteAudience
  /** 托管方提供的本机目录（名字到绝对路径），只有个人站有 */
  providedDirs: Readonly<Record<string, string>>
}

/** 一处引用：from 文件里写的 <component id="id" …> */
export interface SiteReference {
  component: string
  id: string
  from: string
}

/** 扫不出的引用：id 没写、写成表达式，或文件解析不了 */
export interface SiteReferenceProblem {
  from: string
  message: string
}

export interface SiteReferences {
  /** 本站有的条目的引用 */
  references: SiteReference[]
  /** 登记组件的功能包说本站没有这一条 */
  missing: SiteReference[]
  problems: SiteReferenceProblem[]
}

/** 在 package.json 的 godDocsite.references.components 里登记了组件的功能包，./node 出口要导出的两个函数 */
export interface ReferenceResolverModule {
  /** 这一条在本站的 mdx 文件（绝对路径）；本站没有这一条回 undefined */
  resolveReference(id: string, place: ReferencePlace): readonly string[] | undefined
  /** 本站缺这一条时告诉人怎么补的那一行，如 papers.publish { id, site } */
  publishHint(id: string, siteDir: string): string
}
