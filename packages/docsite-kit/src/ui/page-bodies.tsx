import { use, useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import type { TOCItemType } from 'fumadocs-core/toc'
import { bodyHeadingsOf, sameToc } from './body-headings.js'

/** TSX 页面模块：默认导出页面组件。load 是项目里 import.meta.glob('/content/**\/*.page.tsx') 给的那一项 */
export type TsxPageModule = { default: ComponentType }

/** 正文渲染出来以后交出本页目录：页面路由放进 DocsPage 的 toc */
export type OnBodyToc = (toc: TOCItemType[]) => void

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

/** 只在目录真的变了时交出去 */
function useTocReporter(onToc: OnBodyToc | undefined) {
  const lastToc = useRef<TOCItemType[]>([])
  return useCallback(
    (toc: TOCItemType[]) => {
      if (!onToc || sameToc(lastToc.current, toc)) return
      lastToc.current = toc
      onToc(toc)
    },
    [onToc],
  )
}

/**
 * TSX 页面的正文：按需加载页面模块，渲染它的默认导出。
 * 渲染出来以后找正文里的二、三级标题交出本页目录；页面组件后来又画出新内容（如图表加载完）时重新找
 */
export function TsxPageBody({ load, onToc }: { load: () => Promise<TsxPageModule>; onToc?: OnBodyToc }) {
  const { default: Page } = use(moduleOf(load))
  const bodyRef = useRef<HTMLDivElement>(null)
  const reportToc = useTocReporter(onToc)
  useEffect(() => {
    const body = bodyRef.current!
    const collect = () => reportToc(bodyHeadingsOf(body, new Set()).toc)
    collect()
    const observer = new MutationObserver(collect)
    observer.observe(body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [reportToc])
  return (
    <div ref={bodyRef}>
      <Page />
    </div>
  )
}

type HeadingMarker = { id: string; top: number }

/**
 * HTML 页面的正文：放进 iframe，由 /api/content/ 原样送出，页面里相对路径的图片、样式照常能用。
 * 和站点同源，站点能读到 iframe 里的内容；高度跟着 iframe 里的文档走，不出现第二条滚动条。
 * 本页目录：iframe 里的标题外层页面找不到，所以在 iframe 上面对准每个标题放一个看不见的定位点（id 按序号起，不和外层页面的撞），
 * fumadocs 的目录照常按 #id 跳转、高亮读到的那一节；iframe 高度变了重新对准
 */
export function HtmlPageFrame({ src, title, onToc }: { src: string; title: string; onToc?: OnBodyToc }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const [markers, setMarkers] = useState<HeadingMarker[]>([])
  const reportToc = useTocReporter(onToc)
  const placeMarkers = useCallback(() => {
    const frameDocument = frameRef.current?.contentDocument
    if (!frameDocument?.body) return
    const { headings, toc } = bodyHeadingsOf(frameDocument.body, new Set())
    const placed = headings.map((heading, index) => ({ id: `docsite-html-heading-${index}`, top: heading.getBoundingClientRect().top }))
    setMarkers(placed)
    reportToc(toc.map((item, index) => ({ ...item, url: `#${placed[index]!.id}` })))
  }, [reportToc])
  const fitHeight = useCallback(() => {
    const frame = frameRef.current
    const frameDocument = frame?.contentDocument
    if (!frame || !frameDocument?.documentElement) return
    frame.style.height = `${frameDocument.documentElement.scrollHeight}px`
    placeMarkers()
  }, [placeMarkers])
  const watchHeight = useCallback(() => {
    observerRef.current?.disconnect()
    const frameDocument = frameRef.current?.contentDocument
    if (!frameDocument?.documentElement) return
    observerRef.current = new ResizeObserver(fitHeight)
    observerRef.current.observe(frameDocument.documentElement)
    fitHeight()
  }, [fitHeight])
  // 服务端渲染出的 iframe 可能在页面接管（hydrate）之前就加载完了，onLoad 不会再触发
  useEffect(() => {
    if (frameRef.current?.contentDocument?.readyState === 'complete') watchHeight()
    return () => observerRef.current?.disconnect()
  }, [watchHeight])
  return (
    <div className="relative">
      <iframe ref={frameRef} src={src} title={title} onLoad={watchHeight} className="block w-full border-0" data-html-page={src} />
      {markers.map((marker) => (
        <div key={marker.id} id={marker.id} aria-hidden className="pointer-events-none absolute left-0 h-px w-px scroll-mt-24" style={{ top: marker.top }} />
      ))}
    </div>
  )
}
