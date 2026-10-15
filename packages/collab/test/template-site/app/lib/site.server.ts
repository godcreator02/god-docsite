import type { BaseSiteContext } from '@godcreator/god-docsite/server'
import type { SiteIdentity, StoredPerson } from '@godcreator/identity'

/** 模板类型检查用：站点 app/lib/site.server.ts 的 site，照平台模板里的类型（人员与身份是 identity 包的形状） */
export declare const site: BaseSiteContext<StoredPerson, SiteIdentity>
