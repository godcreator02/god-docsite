import { createContext, use, useMemo, type ReactNode } from 'react'
import { peopleLookupOf } from '../../core/people.js'
import type { CollabViewer } from '../page-data.js'

const CollabViewerContext = createContext<CollabViewer | null>(null)

/** 页面把 loader 交来的人员、本机身份与项目负责人交给下面的组件 */
export function CollabViewerProvider({ viewer, children }: { viewer: CollabViewer; children: ReactNode }) {
  return <CollabViewerContext value={viewer}>{children}</CollabViewerContext>
}

export function useCollabViewer(): CollabViewer {
  const viewer = use(CollabViewerContext)
  if (viewer === null) throw new Error('协作页的组件要放在 CollabViewerProvider 里面：页面组件用 loader 数据包住它们')
  return viewer
}

/** 人员 id 换成显示名；人员列表里没有的原样显示 */
export function useNameOf(): (personId: string) => string {
  const { people } = useCollabViewer()
  return useMemo(() => peopleLookupOf(people).nameOf, [people])
}

/** 这个人是不是项目负责人；推送通道还没交来负责人名单时谁都不是 */
export function useIsLead(): (personId: string) => boolean {
  const { projectLeads } = useCollabViewer()
  return useMemo(() => (personId: string) => projectLeads !== null && projectLeads.includes(personId), [projectLeads])
}

/** 本机能不能写任务与模块：站点有本机身份才能写 */
export function useCanWrite(): boolean {
  return useCollabViewer().person !== null
}
