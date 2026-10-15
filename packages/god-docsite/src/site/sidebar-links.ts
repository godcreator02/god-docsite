import type { ReactNode } from 'react'
import type { LinkItemType } from '@fumadocs/base-ui/layouts/shared'

/** 功能的侧栏入口（全站评论、任务、日历、星轨盘这类功能页面）：url 是站内地址，要和功能 routes.ts 里声明的一致 */
export interface SidebarLink {
  name: string
  url: string
  icon?: ReactNode
}

/**
 * 侧栏入口交给 DocsLayout 的 links：只进侧栏（on: 'menu'），按地址前缀高亮（active: 'nested-url'），
 * 在 /calendar/<日期>、/tasks/<记录>、/trajectory/<卡> 这类功能的下级页面上，对应入口也高亮。
 * 不放进页面树：fumadocs 侧栏里页面树的项只在地址完全相同时高亮，没有按前缀的写法
 */
export function sidebarLayoutLinksOf(links: readonly SidebarLink[]): LinkItemType[] {
  return links.map((link) => ({ type: 'main', text: link.name, url: link.url, icon: link.icon, active: 'nested-url', on: 'menu' }))
}
