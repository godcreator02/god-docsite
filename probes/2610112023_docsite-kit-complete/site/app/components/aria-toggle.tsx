import { useState, type ReactNode } from 'react';

/**
 * 照 ARIA 写的自定义展开块：按钮带 aria-expanded，收起时内容 hidden。
 * 评论定位按这些属性认「收着的内容」和「打开它的按钮」——这是原正式站 collapse-test 里自定义组件的等价样本
 */
export function AriaToggle({ title, children }: { title: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="aria-toggle">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? '收起' : '展开'}：{title}
      </button>
      <div hidden={!open}>{children}</div>
    </div>
  )
}
