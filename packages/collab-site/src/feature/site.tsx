import type { ReactNode } from 'react'
import { CalendarDays, ListTodo } from 'lucide-react'
import type { FeatureSite } from '@godcreator/docsite-kit/feature'
import type { CollabSiteData } from '../site-data.js'
import { CollabDataProvider } from '../ui/collab-data.js'
import { NotificationBar } from '../ui/notification-bar.js'
import { collabLinkKinds, collabMdxComponents } from '../ui/record-link.js'

/** data 是 ./site-server 的 layoutData 读出的协作数据 */
function CollabProvider({ data, children }: { data: unknown; children: ReactNode }) {
  return <CollabDataProvider data={data as CollabSiteData}>{children}</CollabDataProvider>
}

/** 侧栏的「任务」「日历」入口，页面里不用 import 就能写的 RecordLink，正文里任务、日志、repo: 链接的卡片，包住整站的协作数据，每一页正文上的通知栏 */
const site: FeatureSite = {
  routeLinks: [
    { text: '任务', url: '/tasks', icon: <ListTodo /> },
    { text: '日历', url: '/calendar', icon: <CalendarDays /> },
  ],
  mdxComponents: collabMdxComponents,
  linkKinds: collabLinkKinds,
  Provider: CollabProvider,
  PageTop: NotificationBar,
}

export default site
