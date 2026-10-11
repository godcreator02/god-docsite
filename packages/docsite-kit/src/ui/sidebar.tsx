import { useRef, type ReactNode } from 'react'
import Link from 'fumadocs-core/link'
import { usePathname } from 'fumadocs-core/framework'
import { TreeContextProvider, useTreeContext } from '@fumadocs/base-ui/contexts/tree'
import { Sidebar, SidebarProvider, SidebarTrigger, useSidebar, type SidebarProps } from '@fumadocs/base-ui/layouts/docs/slots/sidebar'
import { SearchTrigger } from '@fumadocs/base-ui/layouts/shared/slots/search-trigger'
import { sidebarTreeOf } from '../sidebar-tree.js'

/** 塞进分组里的那条页面项的名字带这个属性，styles.css 据此把它藏起来 */
const hiddenPageAttribute = 'data-docsite-sidebar-hidden-page'
const hiddenPage = { type: 'page' as const, $id: 'docsite-sidebar-hidden-page', name: <span {...{ [hiddenPageAttribute]: '' }} /> }

/** 只有侧栏用 sidebarTreeOf 算出的页面树：正文里的面包屑、上一页下一页仍按真实的页面树 */
function GroupKeepingSidebar(props: SidebarProps) {
  const { full } = useTreeContext()
  const pathname = usePathname()
  const lastGroupId = useRef<string | undefined>(undefined)
  const { tree, groupId } = sidebarTreeOf(full, pathname, lastGroupId.current, hiddenPage)
  lastGroupId.current = groupId
  return (
    <TreeContextProvider tree={tree}>
      <Sidebar {...props} />
    </TreeContextProvider>
  )
}

/**
 * DocsLayout 的 slots.sidebar：侧栏在不在页面树里的页面（全部评论、任务这类站点自己的页面）上停在最近看过的那一组，
 * 切换按钮与页面列表不变；其余和 fumadocs 的侧栏一样
 */
export const groupKeepingSidebar = { provider: SidebarProvider, root: GroupKeepingSidebar, trigger: SidebarTrigger, useSidebar }

/** DocsLayout 的 slots.searchTrigger：侧栏里不再有整行的搜索框（搜索按钮在 SidebarRouteLinks 那一排里），窄屏顶栏的搜索按钮照旧 */
export const routeLinksSearchTrigger = { sm: SearchTrigger, full: () => null }

export type SidebarRouteLink = { text: string; url: string; icon: ReactNode }

/** 一横排里的一格：各格等宽，格与格之间是 nav 的 divide-x 画的竖线 */
const routeCellClassName = 'flex min-w-0 flex-1 px-0.5'
const routeLinkClassName =
  'flex w-full items-center justify-center gap-1 rounded-md px-0.5 py-1.5 text-nowrap text-fd-muted-foreground transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 data-[active=true]:bg-fd-primary/10 data-[active=true]:text-fd-primary [&_svg]:size-4 [&_svg]:shrink-0'

/**
 * 侧栏切换按钮下的一横排：最左边是搜索按钮（只有图标，Ctrl K 照样能打开搜索），后面是站点自己的页面的入口，
 * 当前地址就是它或在它下面时高亮。各格等宽，中间有竖线隔开。放在 DocsLayout 的 sidebar.banner，slots.searchTrigger 用 routeLinksSearchTrigger
 */
export function SidebarRouteLinks({ links }: { links: SidebarRouteLink[] }) {
  const pathname = usePathname()
  return (
    <nav className="flex divide-x divide-fd-border rounded-lg border bg-fd-secondary/50 py-0.5 text-sm">
      <span title="搜索（Ctrl K）" className={routeCellClassName}>
        <SearchTrigger hideIfDisabled className={`${routeLinkClassName} h-auto`} />
      </span>
      {links.map((link) => (
        <span key={link.url} className={routeCellClassName}>
          <Link href={link.url} data-active={pathname === link.url || pathname.startsWith(`${link.url}/`)} className={routeLinkClassName}>
            {link.icon}
            {link.text}
          </Link>
        </span>
      ))}
    </nav>
  )
}
