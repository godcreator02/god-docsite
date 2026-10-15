import { useMemo } from 'react'
import { useRouteLoaderData, type LoaderFunctionArgs } from 'react-router'
import { CalendarDays, ListTodo } from 'lucide-react'
import type { SiteIdentity, StoredPerson } from '@godcreator/identity'
import { useSiteFeed, type BaseSiteContext } from '@godcreator/god-docsite/react'
import { calendarUrl, pushedSiteFeedOf, siteFeedChannel, siteFeedOf, tasksPageUrl } from '@godcreator/collab'
import { collabLayoutData, collabMdxComponents, NotificationBar, type CollabLayoutData } from '@godcreator/collab/site'

// 这个文件浏览器侧也会加载（MDX 组件、布局顶部插槽）：只 import 浏览器能用的出口，服务端的东西经 layoutData 的参数传进来

export const mdxComponents = collabMdxComponents

/** 侧栏横排里的「任务」「日历」入口：任务页下的记录页、日历下的日志页上也高亮 */
export const sidebarLinks = [
  { name: '任务', url: tasksPageUrl, icon: <ListTodo /> },
  { name: '日历', url: calendarUrl, icon: <CalendarDays /> },
]

/** 布局 loader 调用，结果进布局数据的 collab 键：公开人员、本机身份、推送来的通知 */
export function layoutData(args: LoaderFunctionArgs, base: BaseSiteContext<StoredPerson, SiteIdentity>): CollabLayoutData {
  return collabLayoutData(args, { people: base.people, identity: base.identity, feed: () => pushedSiteFeedOf(base.feedValue(siteFeedChannel)) })
}

/** 站点模板里整站布局路由的 id（平台约定固定为 routes/layout） */
const layoutRouteId = 'routes/layout'

/** 布局顶部插槽：通知栏。首屏用布局数据里的通知，连上推送通道以后跟着推来的新值变 */
export function LayoutTop() {
  const layout = useRouteLoaderData<{ collab: CollabLayoutData }>(layoutRouteId)
  const pushed = useSiteFeed<unknown>(siteFeedChannel)
  const pushedNotifications = useMemo(() => (pushed === undefined ? undefined : siteFeedOf(pushed).notifications), [pushed])
  if (layout === undefined) throw new Error(`LayoutTop 要放在布局路由 ${layoutRouteId} 里面：协作的布局数据在那个路由的 loader 数据的 collab 键下`)
  return <NotificationBar notifications={pushedNotifications ?? layout.collab.notifications} people={layout.collab.people} />
}
