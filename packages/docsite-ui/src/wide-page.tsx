import { useEffect, useState } from 'react'

/** 全宽时 <html> 上的属性：styles.css 据此放开正文的最大宽度 */
const wideAttribute = 'data-docsite-wide'
/** 浏览器里记下的开关：全站一个，'1' 是全宽 */
const wideStorageKey = 'docsite-wide'

/**
 * 放进 root.tsx 的 <head>：页面画出来之前，按浏览器里记下的开关给 <html> 打上全宽标记，
 * 打开页面时不会先按正常宽度画一遍再变宽
 */
export const widePageScript = `if(localStorage.getItem('${wideStorageKey}')==='1')document.documentElement.setAttribute('${wideAttribute}','')`

/** 侧栏底部那一栏（主题切换边上）的「全宽」按钮：点了正文铺满中间那一列，再点恢复；记在浏览器里，全站的页面一起变 */
export function WidePageToggle() {
  const [wide, setWide] = useState(false)
  useEffect(() => setWide(document.documentElement.hasAttribute(wideAttribute)), [])
  const toggle = () => {
    const next = !wide
    document.documentElement.toggleAttribute(wideAttribute, next)
    localStorage.setItem(wideStorageKey, next ? '1' : '0')
    setWide(next)
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={wide}
      aria-label="全宽"
      title={wide ? '恢复正常宽度' : '正文铺满整个中间区域'}
      className="inline-flex shrink-0 items-center rounded-lg border bg-fd-secondary/50 p-2 text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground aria-pressed:bg-fd-primary/10 aria-pressed:text-fd-primary"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m18 8 4 4-4 4" />
        <path d="M2 12h20" />
        <path d="m6 8-4 4 4 4" />
      </svg>
    </button>
  )
}
