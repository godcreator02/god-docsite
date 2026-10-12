import { useEffect, useRef, useState, use as useReact, type ComponentType } from 'react'
import type { TOCItemType } from 'fumadocs-core/toc'
import type { HtmlHeadingAnchor } from '../index.js'

/** TSX 页面模块：默认导出页面组件。load 是 import.meta.glob 给的那一项 */
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

/**
 * TSX 页面的正文：按需加载页面模块，渲染它的默认导出。TSX 是互动边界——
 * 页面是 React 组件，进站点的组件树，可以用状态、事件与站点上下文。
 * 渲染出来以后找正文里的二、三级标题交出本页目录；页面组件后来又画出新内容时重新找
 */
export function TsxPageBody({ load, onToc }: { load: () => Promise<TsxPageModule>; onToc?: OnBodyToc }) {
  const { default: Page } = useReact(moduleOf(load))
  const bodyRef = useRef<HTMLDivElement>(null)
  const lastToc = useRef<TOCItemType[]>([])
  useEffect(() => {
    const body = bodyRef.current
    if (!body || !onToc) return
    const collect = () => {
      const toc = Array.from(body.querySelectorAll<HTMLHeadingElement>('h2, h3'), (heading) => ({
        title: heading.textContent ?? '',
        url: `#${heading.id}`,
        depth: Number(heading.tagName.slice(1)),
      }))
      if (JSON.stringify(toc) === JSON.stringify(lastToc.current)) return
      lastToc.current = toc
      onToc(toc)
    }
    collect()
    const observer = new MutationObserver(collect)
    observer.observe(body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [onToc])
  return (
    <div ref={bodyRef}>
      <Page />
    </div>
  )
}

/**
 * HTML 页面的正文：iframe 原样展示（dev 读 content 源、start 读构建产物，页面里的样式、脚本、
 * 相对地址的图片照常工作）——这是展示边界：内容不进站点的组件树，也不参与 React 状态。
 * 标题锚点是 HTML 里标题自带的 id：iframe 文档内用 id 定位标题，外层在对应位置放同 id 的定位点，
 * 目录与搜索结果的 #锚点 落在定位点上（iframe 内部自己的 #id 导航由浏览器原生处理）。
 * 高度与定位点只在必要事件后更新：iframe 加载完成、内容尺寸变化（脚本改 DOM、图片撑高）、字体就绪
 */
export function HtmlPageBody({ src, headings }: { src: string; headings: HtmlHeadingAnchor[] }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const detachRef = useRef<(() => void) | undefined>(undefined)
  const [anchorTops, setAnchorTops] = useState<number[]>(() => headings.map(() => 0))

  const measure = () => {
    const frame = frameRef.current
    const doc = frame?.contentDocument
    if (!frame || !doc?.documentElement) return
    // 每个锚点在 iframe 文档里按 id 找标题（与来源提取共用内容里写的 id）
    const nextTops = headings.map(({ id }) => {
      const element = doc.getElementById(id)
      return element ? frame.offsetTop + element.offsetTop : frame.offsetTop
    })
    frame.style.height = `${doc.documentElement.scrollHeight}px`
    setAnchorTops((previous) => (JSON.stringify(previous) === JSON.stringify(nextTops) ? previous : nextTops))
  }

  function attachFrameListeners(): () => void {
    detachRef.current?.()
    const frame = frameRef.current
    const doc = frame?.contentDocument
    if (!frame || !doc?.documentElement) return () => {}
    measure()
    // 内容尺寸变化（脚本改 DOM、图片加载撑高）触发重测；字体就绪可能改变标题位置
    const observer = new ResizeObserver(measure)
    observer.observe(doc.documentElement)
    doc.fonts?.ready.then(measure).catch(() => {})
    const detach = () => observer.disconnect()
    detachRef.current = detach
    return detach
  }

  useEffect(() => {
    // 服务端渲染出的 iframe 可能在页面接管（hydrate）之前就加载完了，onLoad 不会再触发，
    // 所以挂载时先接线一次；之后跨 iframe 导航由 onLoad 再接（每次接线前先卸掉上一份）
    return attachFrameListeners()
  }, [])

  return (
    <div className="relative">
      {headings.map((heading, index) => (
        <span key={heading.id} id={heading.id} style={{ position: 'absolute', top: anchorTops[index] }} aria-hidden="true" />
      ))}
      <iframe
        ref={frameRef}
        src={src}
        title={src}
        onLoad={attachFrameListeners}
        className="block w-full border-0"
        data-html-page={src}
      />
    </div>
  )
}
