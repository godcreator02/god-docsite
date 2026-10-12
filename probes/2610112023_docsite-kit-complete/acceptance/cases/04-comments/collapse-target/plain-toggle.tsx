import { useState } from 'react'

// 故意没写 ARIA 的展开块：能点的只是一个 div，评论认不出打开按钮，
// 发起时记不下 openers，收起以后这条评论注定「原文找不到了」。这是反面样本。
export function PlainToggle({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div
        onClick={() => setOpen(!open)}
        style={{ cursor: 'pointer', fontWeight: 600 }}
      >
        {title}
      </div>
      {open ? <div>{children}</div> : null}
    </div>
  )
}
