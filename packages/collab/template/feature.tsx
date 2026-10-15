import { useMemo } from 'react'
import { useRouteLoaderData, type LoaderFunctionArgs } from 'react-router'
import type { LoaderPlugin } from 'fumadocs-core/source'
import type { Person, SiteIdentity } from '@godcreator/identity'
import { useSiteFeed } from '@godcreator/god-docsite/react'
import { calendarUrl, pushedSiteFeedOf, siteFeedChannel, siteFeedOf, tasksPageUrl } from '@godcreator/collab'
import { collabLayoutData, collabMdxComponents, NotificationBar, type CollabLayoutData } from '@godcreator/collab/site'

// 这个文件浏览器侧也会加载（MDX 组件、布局顶部插槽）：只 import 浏览器能用的出口，服务端的东西经 layoutData 的参数传进来

export const mdxComponents = collabMdxComponents

const sidebarLinks = [
  { name: '任务', url: tasksPageUrl },
  { name: '日历', url: calendarUrl },
]

/** 侧栏根部末尾的「任务」「日历」入口；不用平台的 pageTreeLinksPlugin，它只在平台的服务端出口里 */
export const pageTreePlugins: LoaderPlugin[] = [
  {
    name: 'collab:sidebar-links',
    transformPageTree: {
      root(root) {
        root.children.push(...sidebarLinks.map((link) => ({ type: 'page' as const, name: link.name, url: link.url, $id: `collab-link:${link.url}` })))
        return root
      },
    },
  },
]

/** 布局 loader 传进来的站点上下文里，协作的布局数据要用的几项 */
export type CollabLayoutBase = {
  people: () => readonly Person[]
  identity: () => SiteIdentity
  /** 推送通道某个频道现在的值，还没推过是 undefined（平台的 siteFeedValue） */
  feedValue: (channel: string) => unknown
}

/** 布局 loader 调用，结果进布局数据的 collab 键：公开人员、本机身份、推送来的通知 */
export function layoutData(args: LoaderFunctionArgs, base: CollabLayoutBase): CollabLayoutData {
  return collabLayoutData(args, { people: base.people, identity: base.identity, feed: () => pushedSiteFeedOf(base.feedValue(siteFeedChannel)) })
}

/** 站点模板里整站布局路由的 id（app/routes.ts 的 layout('routes/layout.tsx', …)） */
const layoutRouteId = 'routes/layout'

/** 布局顶部插槽：通知栏。首屏用布局数据里的通知，连上推送通道以后跟着推来的新值变 */
export function LayoutTop() {
  const layout = useRouteLoaderData<{ collab: CollabLayoutData }>(layoutRouteId)
  const pushed = useSiteFeed<unknown>(siteFeedChannel)
  const pushedNotifications = useMemo(() => (pushed === undefined ? undefined : siteFeedOf(pushed).notifications), [pushed])
  if (layout === undefined) throw new Error(`LayoutTop 要放在布局路由 ${layoutRouteId} 里面：协作的布局数据在那个路由的 loader 数据的 collab 键下`)
  return <NotificationBar notifications={pushedNotifications ?? layout.collab.notifications} people={layout.collab.people} />
}
