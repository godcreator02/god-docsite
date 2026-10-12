import { createContext, use, type AnchorHTMLAttributes, type ComponentType, type ReactNode } from 'react'
import Link from 'fumadocs-core/link'
import { usePathname } from 'fumadocs-core/framework'
import { ArrowUpRight, FileText, MessageSquare, Paperclip, TriangleAlert } from 'lucide-react'
import { siteLinkTargetOf } from './site-link-targets.js'
import type { SidebarRouteLink } from './sidebar.js'

/** 站内链接显示成的小卡片；功能包自己的链接种类也用它，和站里其余的链接一个样子 */
export const linkChipClassName =
  'mx-0.5 rounded-md border px-1 py-px font-normal no-underline box-decoration-clone transition-colors hover:bg-fd-accent'
const plainChipClassName = `${linkChipClassName} border-fd-border bg-fd-muted/60 text-fd-foreground`
const brokenChipClassName = `${linkChipClassName} border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400`
/** 卡片里文字前面的图标 */
export const linkChipIconClassName = 'me-1 inline size-[1em] align-[-0.15em] text-fd-muted-foreground'

/**
 * 功能包登记的链接种类（FeatureSite.linkKinds）：matches 认得这个地址，就由 Chip 显示，排在站点自己的种类前面。
 * children 是正文里写的链接文字，没写时是空的，这时显示地址指向的东西现在的名字
 */
export type SiteLinkKind = {
  matches: (href: string) => boolean
  Chip: ComponentType<{ href: string; children?: ReactNode }>
}

/** 评论链接要显示的：批的是哪一页、批了什么、解决了没有 */
export type CommentLinkTarget = { page: string | undefined; label: string; resolved: boolean }

export type SiteLinksData = {
  /** 页面地址到标题 */
  pageTitles: Readonly<Record<string, string>>
  /** 页面以外的站点入口（侧栏那一排的任务、评论这类） */
  routeLinks: readonly SidebarRouteLink[]
  /** 评论串到它批的地方 */
  comments: Readonly<Record<string, CommentLinkTarget>>
}

const SiteLinksContext = createContext<SiteLinksData | null>(null)

/** 包住整站布局：正文与评论里的链接从这里查页面标题与评论 */
export function SiteLinksProvider({ value, children }: { value: SiteLinksData; children: ReactNode }) {
  return <SiteLinksContext value={value}>{children}</SiteLinksContext>
}

function useSiteLinks() {
  const data = use(SiteLinksContext)
  if (!data) throw new Error('站内链接要包在 SiteLinksProvider 里：骨架的 layout.tsx 包住整站布局')
  return data
}

/** 评论串到评论链接要显示的；批了元素的没有页面快照，只写元素类别 */
/** 评论链接的目标清单：threads 是站点侧从评论模型组装的串摘要（resolved 状态是评论模型还没收编的能力，先恒为未解决） */
export function commentLinkTargetsOf(threads: ReadonlyArray<{ id: string; page: string; anchor?: string }>): Record<string, CommentLinkTarget> {
  return Object.fromEntries(threads.map((thread) => [thread.id, { page: thread.page, label: thread.anchor ?? '页面评论', resolved: false }]))
}

function hasWrittenText(children: ReactNode) {
  return !(children === undefined || children === null || children === '' || (Array.isArray(children) && children.length === 0))
}

function SiteChip({ href, icon, title, broken, children }: { href: string; icon: ReactNode; title: string; broken?: boolean; children: ReactNode }) {
  return (
    <Link href={href} title={title} className={broken ? brokenChipClassName : plainChipClassName}>
      {icon}
      {children}
    </Link>
  )
}

function ExternalLink({ href, opensNewTab, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; opensNewTab: boolean }) {
  return (
    <a {...rest} href={href} {...(opensNewTab ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>
      {hasWrittenText(children) ? children : href}
      <ArrowUpRight aria-hidden className="ms-0.5 inline size-[0.9em] align-[-0.1em]" />
    </a>
  )
}

const contentFilePrefix = '/api/content/'

/** 站里的一个地址：评论、页面、站点入口、content/ 里的文件，都不是就是找不到 */
function SiteTargetChip({ href, path, hash, commentThread, children }: { href: string; path: string; hash: string; commentThread: string | undefined; children: ReactNode }) {
  const { pageTitles, routeLinks, comments } = useSiteLinks()
  const written = hasWrittenText(children)
  if (commentThread !== undefined) {
    const comment = comments[commentThread]
    if (!comment) return <SiteChip href={href} broken title={`没有评论串 ${commentThread}`} icon={<TriangleAlert className={linkChipIconClassName} />}>{written ? children : '找不到的评论'}</SiteChip>
    const where = comment.page === undefined ? '不挂在页面上的评论' : (pageTitles[comment.page] ?? comment.page)
    const summary = `${where}：${comment.label}${comment.resolved ? '（已解决）' : ''}`
    return (
      <SiteChip href={href} title={`评论 · ${summary}`} icon={<MessageSquare className={linkChipIconClassName} />}>
        {written ? children : summary}
      </SiteChip>
    )
  }
  const pageTitle = pageTitles[path]
  if (pageTitle !== undefined) {
    const shown = hash === '' ? pageTitle : `${pageTitle} › ${hash}`
    return (
      <SiteChip href={href} title={shown} icon={<FileText className={linkChipIconClassName} />}>
        {written ? children : shown}
      </SiteChip>
    )
  }
  const routeLink = routeLinks.find((link) => link.url === path)
  if (routeLink) {
    return (
      <SiteChip href={href} title={routeLink.text} icon={<span data-link-chip-icon="">{routeLink.icon}</span>}>
        {written ? children : routeLink.text}
      </SiteChip>
    )
  }
  if (path.startsWith(contentFilePrefix)) {
    const file = path.slice(contentFilePrefix.length)
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" title={file} className={plainChipClassName}>
        <Paperclip className={linkChipIconClassName} />
        {written ? children : file.split('/').at(-1)}
      </a>
    )
  }
  return (
    <SiteChip href={href} broken title={`站里没有 ${path} 这一页`} icon={<TriangleAlert className={linkChipIconClassName} />}>
      {written ? children : '找不到的页面'}
    </SiteChip>
  )
}

/**
 * 正文与评论里的链接（MDX 的 a）：站里的页面、评论、文件显示成带图标的小卡片，没写链接文字时显示它现在的名字，
 * 页面不存在时标红；站外的链接后面带一个箭头，开新标签页；只跳到本页标题的照常显示
 */
export function siteLinkComponent(linkKinds: readonly SiteLinkKind[]) {
  return function SiteLink({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
    const pathname = usePathname()
    if (href === undefined) return <a {...rest}>{children}</a>
    const kind = linkKinds.find((each) => each.matches(href))
    if (kind) return <kind.Chip href={href}>{children}</kind.Chip>
    const target = siteLinkTargetOf(href, pathname)
    if (target.kind === 'in-page') return <Link {...rest} href={href}>{children}</Link>
    if (target.kind === 'external') return <ExternalLink {...rest} href={href} opensNewTab={target.opensNewTab}>{children}</ExternalLink>
    return <SiteTargetChip href={href} path={target.path} hash={target.hash} commentThread={target.commentThread}>{children}</SiteTargetChip>
  }
}
