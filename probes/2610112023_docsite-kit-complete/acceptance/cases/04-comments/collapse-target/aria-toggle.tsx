import { useState } from 'react'

// 照 ARIA 写的展开块：按钮带 aria-expanded 与指着内容块 id 的 aria-controls，
// 所以评论发起时能记下按钮位置（openers），收起后点评论会自动展开。
// 收起时内容整个从页面上拿掉（open 为 false 渲染 null）。
export function AriaToggle({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls="aria-toggle-panel" onClick={() => setOpen(!open)}>
        {title}
      </button>
      {open ? <div id="aria-toggle-panel">{children}</div> : null}
    </div>
  )
}
