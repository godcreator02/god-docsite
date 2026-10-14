import { useEffect, type MouseEvent, type ReactNode } from 'react'
import { useFetcher } from 'react-router'
import { FileCode2, TriangleAlert } from 'lucide-react'
import { repoLinkPrefix, repoLinksApiUrl, type RepoLinkCheck } from '../../core/repo-links.js'
import type { WriteResult } from '../page-data.js'
import { writeErrorOf } from '../shared/write-result.js'
import { hasWrittenText, linkChipClassName, linkChipIconClassName } from './link-chip.js'

const mutedChipClassName = `${linkChipClassName} border-dashed border-fd-border text-fd-muted-foreground`
const brokenChipClassName = `${linkChipClassName} border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400`
const plainChipClassName = `${linkChipClassName} border-fd-border bg-fd-muted/60 text-fd-foreground`

function classNameOf(check: RepoLinkCheck | undefined) {
  if (check === undefined || check.state === 'ok') return plainChipClassName
  return check.state === 'no-repo' || check.state === 'read-only' ? mutedChipClassName : brokenChipClassName
}

/**
 * 正文里的 repo:<仓>/<路径> 链接：问站点（repoLinksLoader）能不能打开，点了按它说的打开——PDF、图片在浏览器的新标签页里，
 * 文本文件在 VS Code 里（带 #L 跳到那一行），别的用系统默认程序（经 repoLinkAction）。
 * 本机没克隆那个仓、只读的站点显示成灰色，文件不在、写错了显示成红色，原因写在 title 里
 */
export function RepoLink({ href, children }: { href: string; children?: ReactNode }) {
  const checkFetcher = useFetcher<RepoLinkCheck>({ key: `collab-repo-link:${href}` })
  const openFetcher = useFetcher<WriteResult>()
  useEffect(() => {
    if (checkFetcher.state === 'idle' && checkFetcher.data === undefined) void checkFetcher.load(`${repoLinksApiUrl}?${new URLSearchParams({ target: href })}`)
  }, [checkFetcher, href])
  const check = checkFetcher.data
  const openProblem = writeErrorOf(openFetcher.data)
  const problem = openProblem === null ? (check !== undefined && check.state !== 'ok' ? check.problem : undefined) : `打开失败：${openProblem}`
  const onClick = (event: MouseEvent) => {
    event.preventDefault()
    if (check?.state !== 'ok') return
    if (check.open.how === 'browser') {
      window.open(check.open.url, '_blank', 'noopener')
      return
    }
    void openFetcher.submit({ target: href }, { method: 'post', action: repoLinksApiUrl })
  }
  const Icon = problem === undefined ? FileCode2 : TriangleAlert
  return (
    <a href={href} onClick={onClick} title={problem ?? href} data-repo-link={check?.state ?? 'checking'} className={openProblem === null ? classNameOf(check) : brokenChipClassName}>
      <Icon className={linkChipIconClassName} />
      {hasWrittenText(children) ? children : href.slice(repoLinkPrefix.length)}
    </a>
  )
}
