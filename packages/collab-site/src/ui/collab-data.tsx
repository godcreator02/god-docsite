import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useRevalidator } from 'react-router'
import { siteFeedChannel, type SiteFeed } from '@godcreator/collab-model/notification-model'
import { peopleLookupOf } from '@godcreator/collab-model/task-model'
import { useSiteFeed } from '@godcreator/docsite-kit/ui'
import type { CollabSiteData } from '../site-data.js'

const CollabDataContext = createContext<CollabSiteData | null>(null)

/**
 * 整站布局把 loader 读的协作数据交给下面所有页面。gwb-collab 每次推来新的通知与项目负责人（它检查完协作仓就推一次），
 * 就让 loader 重新读一遍，别人合进 main 的任务这样也会出现；推来的那份在重新读完之前先用上
 */
export function CollabDataProvider({ data, children }: { data: CollabSiteData; children: ReactNode }) {
  const feed = useSiteFeed<SiteFeed>(siteFeedChannel)
  const { revalidate } = useRevalidator()
  useEffect(() => {
    if (feed !== undefined) void revalidate()
  }, [feed])
  const value = useMemo(() => (feed === undefined ? data : { ...data, notifications: feed.notifications, projectLeads: feed.projectLeads }), [data, feed])
  return <CollabDataContext.Provider value={value}>{children}</CollabDataContext.Provider>
}

export function useCollabData(): CollabSiteData {
  const data = useContext(CollabDataContext)
  if (data === null) throw new Error('协作站的组件要放在 CollabDataProvider 里面：整站布局 layout.tsx 用它包住 Outlet')
  return data
}

/** 人员 id 换成显示名；人员列表里没有的原样显示 */
export function useNameOf(): (personId: string) => string {
  const { people } = useCollabData()
  return useMemo(() => peopleLookupOf(people).nameOf, [people])
}

/** 这个人是不是项目负责人（Gitea 上协作仓的协作者，gwb-collab 读来交给站点）；还没读到时谁都不是 */
export function useIsLead(): (personId: string) => boolean {
  const { projectLeads } = useCollabData()
  return useMemo(() => (personId: string) => projectLeads !== null && projectLeads.includes(personId), [projectLeads])
}
