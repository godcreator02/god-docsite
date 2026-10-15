import { useMemo, type ReactNode } from 'react'
import { BookOpen } from 'lucide-react'
import { HomeLayout } from '@fumadocs/base-ui/layouts/home'
import type { LinkItemType } from '@fumadocs/base-ui/layouts/shared'
import type { SiteHomeData } from './home.server.js'
import type { SidebarLink } from './sidebar-links.js'

export interface SiteHomeLayoutProps {
  /** 首页路由 loader 里 siteHomeData 的结果 */
  data: SiteHomeData
  /** 功能的侧栏入口（featureRuntime.sidebarLinks）：首页顶栏里排在「文档」后面 */
  sidebarLinks: readonly SidebarLink[]
  children: ReactNode
}

/**
 * 首页布局：fumadocs 的 HomeLayout，顶栏是站名、「文档」与功能入口、搜索、主题切换，下面整页由站点的 home.tsx 自己写；
 * 没有侧栏与本页目录。文档页用 SiteLayout（DocsLayout）
 */
export function SiteHomeLayout({ data, sidebarLinks, children }: SiteHomeLayoutProps) {
  const nav = useMemo(() => ({ title: data.siteName }), [data.siteName])
  const links = useMemo(
    (): LinkItemType[] => [
      { type: 'main', text: '文档', url: data.docsUrl, icon: <BookOpen />, active: 'none' },
      ...sidebarLinks.map((link): LinkItemType => ({ type: 'main', text: link.name, url: link.url, icon: link.icon, active: 'nested-url' })),
    ],
    [data.docsUrl, sidebarLinks],
  )
  return (
    <HomeLayout nav={nav} links={links}>
      {children}
    </HomeLayout>
  )
}
