import type { ReferencePlace, SiteReferences } from '../core/site-references.js'
import { siteReferences } from '../node/references.js'

/**
 * 站点上下文的 references()：每次调用都按现在的文件重扫，同时来的调用共用一次扫描。
 * 一次请求里布局 loader 同时调各功能的 sections、页面 loader 也在同时跑，它们都从这一次扫描取
 */
export function siteReferencesForRequests(placeOf: () => ReferencePlace): () => Promise<SiteReferences> {
  let running: Promise<SiteReferences> | undefined
  return () => {
    running ??= siteReferences(placeOf()).finally(() => {
      running = undefined
    })
    return running
  }
}
