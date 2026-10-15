import { useId, useState, type ReactNode } from 'react'

const buttonClassName = 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm font-medium hover:bg-fd-accent'

/** 照 ARIA 写的展开块：按钮带 aria-expanded、aria-controls；收起时内容从页面上拿掉 */
export function AriaToggle({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const contentId = useId()
  return (
    <div className="not-prose my-4 rounded-lg border bg-fd-card">
      <button type="button" aria-expanded={open} aria-controls={contentId} onClick={() => setOpen(!open)} className={buttonClassName}>
        <span>{open ? '▾' : '▸'}</span>
        {title}
      </button>
      {open && (
        <div id={contentId} className="border-t px-3 py-2 text-sm">
          {children}
        </div>
      )}
    </div>
  )
}

/** 没写 ARIA 的展开块：按钮只是一个能点的 div；收起时内容同样从页面上拿掉 */
export function PlainToggle({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="not-prose my-4 rounded-lg border bg-fd-card">
      <div onClick={() => setOpen(!open)} className={`${buttonClassName} cursor-pointer`}>
        <span>{open ? '▾' : '▸'}</span>
        {title}
      </div>
      {open && <div className="border-t px-3 py-2 text-sm">{children}</div>}
    </div>
  )
}
