import type { ProcessorOptions } from '@mdx-js/mdx'
import type { ComponentType, ReactNode } from 'react'
import type { SidebarRouteLink } from './ui/sidebar.js'
import type { SiteLinkKind } from './ui/site-links.js'

/**
 * 功能包（如协作站的 @godcreator/collab-site）往基础骨架上添加的东西。站点 package.json 的 docsite.features 列出用到的功能包，
 * 初始化（./init 的 writeSiteSkeleton）照它生成 app/site/ 下的几个文件，骨架只读那几个文件。
 * 每个功能包都要有这几个出口：./routes（FeatureRoutes）、./site（FeatureSite）、./site-server（FeatureSiteServer）、./styles.css；
 * ./content（FeatureContent）可以没有。
 * 包根下的 template/ 是要复制进站点的文件（集合定义只能写在项目里），没有就不复制
 */

/** ./content 出口的默认导出：只在构建页面时在 Node 里执行（骨架的 source.config.ts 引入），content/ 下的页面与 comments/ 下的评论正文都经过它 */
export type FeatureContent = {
  /** 接在 fumadocs 默认的 remark 插件后面，按 docsite.features 的顺序。插件从 vfile 的路径区分页面与评论 */
  remarkPlugins?: NonNullable<ProcessorOptions['remarkPlugins']>
}

/** 一条路由：file 相对功能包的包根。layout 为 false 的放在整站布局外面（接口这类不出页面的） */
export type FeatureRoute = { path: string; file: string; layout?: false } | { index: true; file: string }

/** ./routes 出口的默认导出：在 Node 里读路由表时用，不能引用 React 组件 */
export type FeatureRoutes = { routes: readonly FeatureRoute[] }

/** ./site 出口的默认导出：浏览器端也用 */
export type FeatureSite = {
  /** 侧栏那一排的入口，排在「评论」前面 */
  routeLinks?: readonly SidebarRouteLink[]
  /** MDX 页面与评论正文里不用 import 就能写的组件 */
  mdxComponents?: Readonly<Record<string, ComponentType<any>>>
  /** 正文与评论里这个功能包自己的链接（如协作站的任务、日志）怎么显示，排在站点自己的链接种类前面 */
  linkKinds?: readonly SiteLinkKind[]
  /** 包在整站布局外面的组件；data 是 ./site-server 的 layoutData 读出的那一份 */
  Provider?: ComponentType<{ data: unknown; children: ReactNode }>
  /** 放在每一页正文最上面的组件 */
  PageTop?: ComponentType
}

/** 整站布局的 loader 交给 layoutData 的站点信息 */
export type FeatureLayoutContext = { pages: ReadonlyArray<{ url: string; title: string }> }

/** ./site-server 出口的默认导出：只在服务端运行 */
export type FeatureSiteServer = {
  /** 整站布局的 loader 多读的一份数据，交给 FeatureSite 的 Provider */
  layoutData?: (context: FeatureLayoutContext) => Promise<unknown>
}
