import { createContext, use, type AnchorHTMLAttributes, type ComponentType, type ReactNode } from 'react'
import Link from 'fumadocs-core/link'
import { usePathname } from 'fumadocs-core/framework'
import { ArrowUpRight, FileText, Paperclip, TriangleAlert } from 'lucide-react'
import { siteAddressOf, siteLinkTargetOf } from '../core/site-link-targets.js'
import { contentFileUrlPrefix } from '../core/content-file-url.js'

/** 站内链接显示成的小卡片；功能包自己的链接种类也用它，和站里其余的链接一个样子 */
export const linkChipClassName =
  'mx-0.5 rounded-md border px-1 py-px font-normal no-underline box-decoration-clone transition-colors hover:bg-fd-accent'
const plainChipClassName = `${linkChipClassName} border-fd-border bg-fd-muted/60 text-fd-foreground`
const brokenChipClassName = `${linkChipClassName} border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400`
/** 卡片里文字前面的图标 */
export const linkChipIconClassName = 'me-1 inline size-[1em] align-[-0.15em] text-fd-muted-foreground'

/**
 * 功能包登记的链接种类：matches 认得这个地址，就由 Chip 显示，排在站点自己的种类前面。
 * children 是正文里写的链接文字，没写时是空的，这时显示地址指向的东西现在的名字
 */
export type SiteLinkKind = {
  matches: (href: string) => boolean
  Chip: ComponentType<{ href: string; children?: ReactNode }>
}

const PageTitlesContext = createContext<Readonly<Record<string, string>> | null>(null)

/** 包住整站布局（SiteLayout 里）与不在布局里的独立页面：正文与评论里的链接从这里查站内地址的标题（loader 里 sitePageTitles 的结果） */
export function SiteLinksProvider({ pageTitles, children }: { pageTitles: Readonly<Record<string, string>>; children: ReactNode }) {
  return <PageTitlesContext value={pageTitles}>{children}</PageTitlesContext>
}

function usePageTitles() {
  const pageTitles = use(PageTitlesContext)
  if (!pageTitles) throw new Error('站内链接要包在 SiteLinksProvider 里：整站布局 SiteLayout 已经包了；不在整站布局里的独立页面自己包一层，pageTitles 在 loader 里用 ./server 的 sitePageTitles 取')
  return pageTitles
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

/** 站里的一页：有标题时显示成带标题的卡片，pageTitle 是 undefined 时标红 */
function PageChip({ href, path, hash, pageTitle, children }: { href: string; path: string; hash: string; pageTitle: string | undefined; children: ReactNode }) {
  const written = hasWrittenText(children)
  if (pageTitle === undefined) {
    return (
      <SiteChip href={href} broken title={`站里没有 ${path} 这一页`} icon={<TriangleAlert className={linkChipIconClassName} />}>
        {written ? children : '找不到的页面'}
      </SiteChip>
    )
  }
  const shown = hash === '' ? pageTitle : `${pageTitle} › ${hash}`
  return (
    <SiteChip href={href} title={shown} icon={<FileText className={linkChipIconClassName} />}>
      {written ? children : shown}
    </SiteChip>
  )
}

/** 站里的一个地址：页面（含页面树里的入口）、内容目录里的文件，都不是就是找不到 */
function SiteTargetChip({ href, path, hash, children }: { href: string; path: string; hash: string; children: ReactNode }) {
  const pageTitle = usePageTitles()[path]
  if (pageTitle === undefined && path.startsWith(contentFileUrlPrefix)) {
    const file = path.slice(contentFileUrlPrefix.length)
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" title={file} className={plainChipClassName}>
        <Paperclip className={linkChipIconClassName} />
        {hasWrittenText(children) ? children : file.split('/').at(-1)}
      </a>
    )
  }
  return (
    <PageChip href={href} path={path} hash={hash} pageTitle={pageTitle}>
      {children}
    </PageChip>
  )
}

/**
 * 功能路由下的一类地址（如轨迹卡页 `/trajectory/<卡身份>`）：这些地址不在页面树里，布局给的页面标题查不到它们，
 * 改由功能自己认——titleOf 收 prefix 后面那段（不带开头的 /），认得就给名字，显示成和站里页面一样的卡片（没写链接文字时显示这个名字），
 * 认不得给 undefined，标红。功能的 feature.tsx 放进 linkKinds 导出；它不读 SiteLinksProvider，独立页面上也能用
 */
export function routeLinkKind({ prefix, titleOf }: { prefix: string; titleOf: (subpath: string) => string | undefined }): SiteLinkKind {
  return {
    matches: (href) => href.startsWith(`${prefix}/`),
    Chip: function RouteLinkChip({ href, children }) {
      const { path, hash } = siteAddressOf(href, prefix)
      return (
        <PageChip href={href} path={path} hash={hash} pageTitle={titleOf(path.slice(prefix.length + 1))}>
          {children}
        </PageChip>
      )
    },
  }
}

/**
 * 正文与评论里的链接（MDX 的 a）：站里的页面与文件显示成带图标的小卡片，没写链接文字时显示它现在的名字，
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
    return <SiteTargetChip href={href} path={target.path} hash={target.hash}>{children}</SiteTargetChip>
  }
}
