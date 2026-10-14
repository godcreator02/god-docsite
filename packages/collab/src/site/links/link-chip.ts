import type { ReactNode } from 'react'

/** 正文里链接卡片的外形：和站点自己的链接卡片同一套类名（Tailwind 与 fumadocs 的颜色变量） */
export const linkChipClassName = 'mx-0.5 rounded-md border px-1 py-px font-normal no-underline box-decoration-clone transition-colors hover:bg-fd-accent'
/** 卡片里文字前面的图标 */
export const linkChipIconClassName = 'me-1 inline size-[1em] align-[-0.15em] text-fd-muted-foreground'

/** 链接里写了文字没有：没写时卡片显示记录的标题、日期或路径 */
export function hasWrittenText(children: ReactNode) {
  return !(children === undefined || children === null || children === '' || (Array.isArray(children) && children.length === 0))
}
