import { useEffect, useState, use, type ReactNode } from 'react'
import * as reactJsxRuntime from 'react/jsx-runtime'
import type { CompiledCommentEntry } from './comment-entry'

/**
 * 在浏览器里运行服务端编译好的评论正文（@mdx-js/mdx compile 的 function-body 产物）。
 * 官方 run 的实现就是把代码放进 AsyncFunction 执行（@mdx-js/mdx 3.1.1 lib/run.js 一行）；
 * 这里按同样行为内联，避免从包入口 import run 把整个 MDX 编译器拉进浏览器 bundle（包没有独立的 run 子出口）。
 * import（同目录组件引用）由编译产物相对 baseUrl 动态加载：dev 下经 Vite 按需转换
 */
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
function runMdxBody(code: string, options: unknown) {
  return new AsyncFunction(String(code))(options)
}

/** 每条评论的模块 promise 按 info.path 缓存：use() 要求同一条评论每次渲染拿到同一个 promise */
const bodyModules = new Map<string, Promise<{ default: React.ComponentType<{ components?: Record<string, unknown> }> }>>()

function threadBaseUrl(entry: CompiledCommentEntry) {
  return new URL(`/comments/${entry.info.path.split('/')[0]}/`, window.location.origin)
}

function moduleOf(entry: CompiledCommentEntry) {
  let module = bodyModules.get(entry.info.path)
  if (!module) {
    module = runMdxBody(entry.body, { ...reactJsxRuntime, baseUrl: threadBaseUrl(entry) }) as Promise<{ default: React.ComponentType<{ components?: Record<string, unknown> }> }>
    bodyModules.set(entry.info.path, module)
  }
  return module
}

/** 评论里的图片写的是相对这一串文件夹的地址（![](./paste-x.png)），解析成评论串自己的 URL，不然会按页面地址找 */
function relativeImgOf(entry: CompiledCommentEntry) {
  const base = threadBaseUrl(entry)
  return function CommentImg({ src = '', ...rest }: React.ImgHTMLAttributes<HTMLImageElement>) {
    const resolved = src.startsWith('/') || src.startsWith('http:') || src.startsWith('https:') ? src : new URL(src, base).href
    return <img {...rest} src={resolved} />
  }
}

const loadingFallback = <p className="text-[var(--docsite-comments-muted-foreground)] text-sm">正在加载……</p>

/**
 * 渲染一条评论的正文：run 编译产物得到 MDX 组件，图片组件换成相对本串解析的版本。
 * 只在浏览器里 run（run 会用到 window，评论组件也不在服务器上执行）；服务端渲染与水合的第一帧都输出占位，
 * 挂载后下一帧渲染正文，所以没有水合不一致
 */
export function CommentBody({ entry }: { entry: CompiledCommentEntry }) {
  const [inBrowser, setInBrowser] = useState(false)
  useEffect(() => setInBrowser(true), [])
  if (!inBrowser) return loadingFallback
  const { default: Mdx } = use(moduleOf(entry))
  return <Mdx components={{ img: relativeImgOf(entry) }} />
}

export function renderCommentBody(entry: CompiledCommentEntry): ReactNode {
  return <CommentBody entry={entry} />
}
