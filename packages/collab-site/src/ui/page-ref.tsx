import { Link } from 'react-router'
import { FileText } from 'lucide-react'
import { useCollabData } from './collab-data.js'

/** 任务链接的那一页：显示那一页当前的标题，点了过去；页面后来挪走、删掉了写「找不到的页面」 */
export function PageRef({ url }: { url: string }) {
  const page = useCollabData().pages.find((entry) => entry.url === url)
  if (!page) {
    return (
      <span title={`站里没有地址是 ${url} 的页面，可能挪走或删掉了`} className="inline-flex items-center gap-1 text-fd-muted-foreground">
        <FileText size={12} />
        找不到的页面 {url}
      </span>
    )
  }
  return (
    <Link to={page.url} onClick={(event) => event.stopPropagation()} title={`打开「${page.title}」`} className="inline-flex min-w-0 items-center gap-1 text-fd-muted-foreground hover:text-fd-foreground">
      <FileText size={12} className="shrink-0" />
      <span className="truncate">{page.title}</span>
    </Link>
  )
}
