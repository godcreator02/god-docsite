import type { ReactNode } from 'react'

/**
 * 功能的侧栏入口（任务、日历、全站评论、星轨盘这类功能页面），显示在侧栏站名下的一横排里（SidebarLinksRow）：
 * url 是站内地址，要和功能 routes.ts 里声明的一致；横排一格只有四五十像素宽，name 写两个字的短名，icon 必填
 */
export interface SidebarLink {
  name: string
  url: string
  icon: ReactNode
}
