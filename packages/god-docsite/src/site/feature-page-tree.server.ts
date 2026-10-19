import type * as PageTree from 'fumadocs-core/page-tree'
import type { LoaderFunctionArgs } from 'react-router'
import type { BaseSiteContext } from './site-context.js'

/**
 * 功能目录 app/features/<功能名>/layout.server.ts 可以导出的，可选。只在服务端运行，可以读文件、数据库。
 * pageTreeNodes 在布局 loader 里每次请求都调，返回的节点接在页面树（content/ 的那棵）的末尾：
 * 侧栏要随功能自己的数据现算时用它，不必把侧栏写成 content/ 下的 meta.json 再等它刷新
 */
export interface FeatureLayoutServerModule {
  pageTreeNodes?(args: LoaderFunctionArgs, base: BaseSiteContext): readonly PageTree.Node[] | Promise<readonly PageTree.Node[]>
}

export interface FeaturePageTreeNodesLoader {
  feature: string
  load(args: LoaderFunctionArgs, base: BaseSiteContext): readonly PageTree.Node[] | Promise<readonly PageTree.Node[]>
}

/** 全部功能 layout.server.ts 合在一起，给布局路由的 loader 用 */
export interface SiteFeatureLayoutServer {
  pageTreeNodes: FeaturePageTreeNodesLoader[]
}

/** 建站器生成的 app/features/layout.generated.server.ts 调它：键是功能名，值是那个功能的 layout.server.ts（import * as） */
export function siteFeatureLayoutServer(features: Readonly<Record<string, FeatureLayoutServerModule>>): SiteFeatureLayoutServer {
  const pageTreeNodes: FeaturePageTreeNodesLoader[] = []
  for (const [feature, featureModule] of Object.entries(features)) {
    const { pageTreeNodes: load } = featureModule
    if (load !== undefined) pageTreeNodes.push({ feature, load: (args, base) => load.call(featureModule, args, base) })
  }
  return { pageTreeNodes }
}

/** 各功能这次请求给的页面树节点，按功能名的先后接在一起 */
export async function featurePageTreeNodes(server: SiteFeatureLayoutServer, args: LoaderFunctionArgs, base: BaseSiteContext): Promise<PageTree.Node[]> {
  const nodesOfFeatures = await Promise.all(server.pageTreeNodes.map(async ({ load }) => load(args, base)))
  return nodesOfFeatures.flat()
}
