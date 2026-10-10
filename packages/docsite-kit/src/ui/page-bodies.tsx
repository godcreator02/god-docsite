import { use, useCallback, useEffect, useRef, type ComponentType } from 'react'

/** TSX 页面模块：默认导出页面组件。load 是项目里 import.meta.glob('/content/**\/*.page.tsx') 给的那一项 */
export type TsxPageModule = { default: ComponentType }

const loadingModules = new WeakMap<() => Promise<TsxPageModule>, Promise<TsxPageModule>>()

/** 同一个 load 只加载一次：use() 要求每次渲染拿到同一个 promise */
function moduleOf(load: () => Promise<TsxPageModule>) {
  let loading = loadingModules.get(load)
  if (!loading) {
    loading = load()
    loadingModules.set(load, loading)
  }
  return loading
}

/** TSX 页面的正文：按需加载页面模块，渲染它的默认导出 */
export function TsxPageBody({ load }: { load: () => Promise<TsxPageModule> }) {
  const { default: Page } = use(moduleOf(load))
  return <Page />
}

/**
 * HTML 页面的正文：放进 iframe，由 /api/content/ 原样送出，页面里相对路径的图片、样式照常能用。
 * 和站点同源，站点能读到 iframe 里的内容；高度跟着 iframe 里的文档走，不出现第二条滚动条
 */
export function HtmlPageFrame({ src, title }: { src: string; title: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const fitHeight = useCallback(() => {
    const frame = frameRef.current
    const document = frame?.contentDocument
    if (!frame || !document?.documentElement) return
    frame.style.height = `${document.documentElement.scrollHeight}px`
  }, [])
  const watchHeight = useCallback(() => {
    observerRef.current?.disconnect()
    const document = frameRef.current?.contentDocument
    if (!document?.documentElement) return
    observerRef.current = new ResizeObserver(fitHeight)
    observerRef.current.observe(document.documentElement)
    fitHeight()
  }, [fitHeight])
  // 服务端渲染出的 iframe 可能在页面接管（hydrate）之前就加载完了，onLoad 不会再触发
  useEffect(() => {
    if (frameRef.current?.contentDocument?.readyState === 'complete') watchHeight()
    return () => observerRef.current?.disconnect()
  }, [watchHeight])
  return <iframe ref={frameRef} src={src} title={title} onLoad={watchHeight} className="block w-full border-0" data-html-page={src} />
}
