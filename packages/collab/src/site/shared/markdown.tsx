import type { ComponentProps } from 'react'
import { Link } from 'react-router'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** 站内链接走路由，不整页刷新；站外链接在新标签页打开。react-markdown 多传一个 node 属性，解构掉不进 DOM */
function Anchor({ href = '', node: _node, ...props }: ComponentProps<'a'> & { node?: unknown }) {
  if (href.startsWith('/')) return <Link to={href} {...props} />
  return <a href={href} target="_blank" rel="noreferrer" {...props} />
}

/**
 * 任务、模块的内容按 Markdown 排版：表格、任务列表、删除线按 GFM。内容是网页上写的，不能当代码执行，所以不用 MDX；
 * 里面的 HTML 原样显示成文字。放在 fumadocs 的正文排版（prose）里，标题、列表、代码块用正文的样式
 */
export function MarkdownContent({ text }: { text: string }) {
  return (
    <div className="prose min-w-0 break-words">
      <Markdown remarkPlugins={[remarkGfm]} components={{ a: Anchor }}>
        {text}
      </Markdown>
    </div>
  )
}
