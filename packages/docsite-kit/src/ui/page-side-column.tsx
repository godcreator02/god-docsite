import { useState, type FocusEvent, type ReactNode } from 'react'
import { useItems } from '@fumadocs/base-ui/components/toc'

/** 二级标题的横线最长，每低一级短 4px */
function barWidthOfDepth(depth: number) {
  return Math.max(6, 18 - (depth - 2) * 4)
}

/**
 * 本页目录的窄条（照 Notion）：每个标题一根短横线，读到的那几根亮起来；鼠标移上去或用 Tab 键移进来，左边弹出完整目录。
 * 标题与「读到哪」用 fumadocs 的 useItems()，要放在 DocsPage 里面
 */
export function TocStrip() {
  const items = useItems()
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  const closeWhenFocusLeaves = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }
  return (
    <nav aria-label="本页目录" className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={closeWhenFocusLeaves}>
      <div className="flex flex-col items-end gap-2.5 py-2 ps-4" aria-hidden="true">
        {items.map((item) => (
          <span
            key={item.id}
            className={`h-0.5 rounded-full transition-colors ${item.active ? 'bg-fd-foreground' : 'bg-fd-muted-foreground/40'}`}
            style={{ width: barWidthOfDepth(item.original.depth) }}
          />
        ))}
      </div>
      {/* 弹出的目录和窄条之间用 padding 隔开，不用 margin：鼠标从窄条移到目录上的途中不能离开 nav */}
      <div className={`absolute end-full top-0 z-20 pe-2 ${open ? '' : 'hidden'}`}>
        <ul className="max-h-[70vh] w-64 overflow-y-auto rounded-xl border bg-fd-popover p-2 text-sm text-fd-popover-foreground shadow-lg">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={item.original.url}
                onClick={() => setOpen(false)}
                className={`block rounded-md py-1.5 pe-2 transition-colors hover:bg-fd-accent ${item.active ? 'text-fd-primary' : 'text-fd-muted-foreground hover:text-fd-accent-foreground'}`}
                style={{ paddingInlineStart: 8 + (item.original.depth - 2) * 12 }}
              >
                {item.original.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

/**
 * 正文右边那一列：评论栏（有评论的页面才有）加最右边的目录窄条，两者并排、互不遮挡。
 * 传给 docs 布局的 DocsPage：<DocsPage {...docsPagePropsWithSideColumn(commentColumn)}>。窄屏不显示这一列，本页目录用 fumadocs 正文上方的下拉条
 */
export function docsPagePropsWithSideColumn(commentColumn?: ReactNode) {
  const width = commentColumn ? 'xl:layout:[--fd-toc-width:376px]' : 'xl:layout:[--fd-toc-width:64px]'
  return {
    tableOfContent: {
      component: (
        <div className={`flex [grid-area:toc] w-(--fd-toc-width) max-xl:hidden ${width}`}>
          {commentColumn}
          <div className="sticky top-0 ms-auto h-fit self-start pe-4 pt-24">
            <TocStrip />
          </div>
        </div>
      ),
    },
  }
}
