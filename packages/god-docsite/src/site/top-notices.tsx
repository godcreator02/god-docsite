import type { ReactNode } from 'react'

/**
 * 页面顶上正中的一行：平台的问题按钮在前，各功能的 LayoutTop（如协作的提示栏）跟在后面，挨着排、放不下就折行。
 * 不变式：这一行是撑满视口宽、不接鼠标的 fixed 容器——里面的按钮自己写 pointer-events-auto；
 * 按钮点开的列表写 absolute inset-x-0 top-full mx-auto，挂在这一行正下方、按视口居中，不挤动旁边的按钮
 */
export function TopNotices({ children }: { children: ReactNode }) {
  return (
    <div data-top-notices className="not-prose pointer-events-none fixed inset-x-0 top-2.5 z-50 flex flex-wrap items-start justify-center gap-2 px-4 text-left">
      {children}
    </div>
  )
}
