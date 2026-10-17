import { createContext, use, useMemo, type ReactNode } from 'react'
import { useFumadocsLoader } from 'fumadocs-core/source/client'
import { DocsLayout } from '@fumadocs/base-ui/layouts/docs'
import { getLayoutTabs } from '@fumadocs/base-ui/layouts/shared'
import { ThemeSwitch, type ThemeSwitchProps } from '@fumadocs/base-ui/layouts/shared/slots/theme-switch'
import { DevIssuesButton, DevSiteUpdates } from './dev-updates.js'
import type { SiteLayoutData } from './site-context.js'
import type { SidebarLink } from './sidebar-links.js'
import { groupKeepingSidebar, rowSearchTrigger, SidebarLinksRow } from './sidebar.js'
import { withGroupLandingPages, withLoosePagesGrouped } from './sidebar-tree.js'
import { SiteLinksProvider } from './site-links.js'
import { TopNotices } from './top-notices.js'
import { WidePageToggle } from './wide-page.js'

const SidebarFooterStartContext = createContext<ReactNode>(null)

/** 侧栏底部那一栏：站点放进来的东西（如当前身份）在左，主题切换与全宽切换在右 */
function SiteThemeSwitch(props: ThemeSwitchProps) {
  const footerStart = use(SidebarFooterStartContext)
  return (
    <>
      {footerStart}
      <ThemeSwitch {...props} />
      <WidePageToggle />
    </>
  )
}

// 插槽组件要是模块级的同一个函数：每次渲染新建一个组件，侧栏底部会整个重新挂载
const siteSlots = { themeSwitch: SiteThemeSwitch, sidebar: groupKeepingSidebar, searchTrigger: rowSearchTrigger }

export interface SiteLayoutProps {
  /** 布局 loader 里 siteLayoutData 的结果 */
  data: SiteLayoutData
  /** 功能的侧栏入口（featureRuntime.sidebarLinks）：排在站名下那一横排里搜索按钮的后面，在入口地址下面的页面上也高亮 */
  sidebarLinks: readonly SidebarLink[]
  /** 侧栏底部左边放的东西，如 identity 包的 IdentityBadge */
  sidebarFooterStart?: ReactNode
  /** 顶上正中那一行（TopNotices）里排在问题按钮后面的东西，如各功能的 LayoutTop；不占 DocsLayout 的网格 */
  top?: ReactNode
  children: ReactNode
}

/**
 * 整站布局：fumadocs 的 DocsLayout，站名作标题；站名下是搜索按钮与功能入口的一横排，在功能页面上侧栏停在最近看过的那一组；
 * 侧栏底部加全宽切换。目录切换按钮按 meta.json 写了 root: true 的文件夹生成：页面树先把组外的页面收成以站名命名的一组
 * （withLoosePagesGrouped），每一页都有按钮；按钮列表由 fumadocs 的 getLayoutTabs 算，只有子文件夹的组先补上首页（withGroupLandingPages）
 */
export function SiteLayout({ data, sidebarLinks, sidebarFooterStart, top, children }: SiteLayoutProps) {
  const { pageTree } = useFumadocsLoader(data)
  const tree = useMemo(() => withLoosePagesGrouped(pageTree), [pageTree])
  const tabs = useMemo(() => getLayoutTabs(withGroupLandingPages(tree)), [tree])
  const nav = useMemo(() => ({ title: data.siteName }), [data.siteName])
  const sidebar = useMemo(() => ({ banner: <SidebarLinksRow links={sidebarLinks} /> }), [sidebarLinks])
  return (
    <SiteLinksProvider pageTitles={data.pageTitles}>
      <DevSiteUpdates />
      <TopNotices>
        <DevIssuesButton />
        {top}
      </TopNotices>
      <SidebarFooterStartContext value={sidebarFooterStart}>
        <DocsLayout tree={tree} tabs={tabs} nav={nav} sidebar={sidebar} slots={siteSlots}>
          {children}
        </DocsLayout>
      </SidebarFooterStartContext>
    </SiteLinksProvider>
  )
}
