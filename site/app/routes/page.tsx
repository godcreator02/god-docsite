import { use, type ReactNode } from 'react'
import type { TOCItemType } from 'fumadocs-core/toc'
import { DocsBody, DocsDescription, DocsPage } from '@fumadocs/base-ui/layouts/docs/page'
import type { Commenter, CommentThread, Person } from '@godcreator/docsite-kit/comments'
import { contentFileUrlOf } from '@godcreator/docsite-kit/page-sources'
import { siteCommenter } from '@godcreator/docsite-kit/server'
import { commentScopeProps, HtmlPageFrame, PageComments, PageTitleWithWideToggle, TsxPageBody } from '@godcreator/docsite-kit/ui'
import { docs, tsxPageModules } from '../lib/collections'
import { allThreads, renderCommentBody, threadsOfPage, type CommentEntry } from '../lib/comment-threads'
import { pageCommentData } from '../lib/commenter.server'
import { mdxComponents } from '../lib/mdx-components'
import { siteName, source } from '../lib/source'
import type { Route } from './+types/page'

export async function loader({ params }: Route.LoaderArgs) {
  const slugs = (params['*'] ?? '').split('/').filter((segment) => segment.length > 0)
  const page = source.getPage(slugs)
  if (!page) throw new Response('没有这一页', { status: 404 })
  const { title, description } = page.data
  const { people, snapshots } = await pageCommentData(allThreads, threadsOfPage.get(page.url) ?? noThreads)
  const shared = { title, description, url: page.url, siteName: siteName(), commenter: siteCommenter(), people, snapshots }
  if (page.type === 'mdx') return { type: 'mdx' as const, ...shared, path: page.path }
  if (page.type === 'tsx') return { type: 'tsx' as const, ...shared, file: page.data.file }
  return { type: 'html' as const, ...shared, src: contentFileUrlOf(page.data.file) }
}

const noThreads: CommentThread<CommentEntry>[] = []

type PageFrameProps = {
  title: string | undefined
  description: string | undefined
  url: string
  siteName: string
  commenter: Commenter | null
  people: Person[]
  snapshots: Record<string, string>
  toc?: TOCItemType[]
  children: ReactNode
}

/** 窗口标题写「页面名 · 站名」：gwb-docsite 按站名认出这个站已经开着的 Chrome 应用窗口 */
function PageFrame({ title, description, url, siteName, commenter, people, snapshots, toc, children }: PageFrameProps) {
  return (
    <DocsPage toc={toc}>
      <title>{`${title} · ${siteName}`}</title>
      <PageTitleWithWideToggle>{title}</PageTitleWithWideToggle>
      <DocsDescription>{description}</DocsDescription>
      <PageComments page={url} threads={threadsOfPage.get(url) ?? noThreads} snapshots={snapshots} commenter={commenter} people={people} renderBody={renderCommentBody}>
        <DocsBody {...commentScopeProps}>{children}</DocsBody>
      </PageComments>
    </DocsPage>
  )
}

function MdxPage({ path, ...frame }: Omit<PageFrameProps, 'children'> & { path: string }) {
  const page = docs.getPage(path)
  if (!page) throw new Error(`没有这一页：${path}`)
  const { body: Mdx, toc } = use(page.load())
  return (
    <PageFrame {...frame} toc={toc}>
      <Mdx components={mdxComponents} />
    </PageFrame>
  )
}

function TsxPage({ file, ...frame }: Omit<PageFrameProps, 'children'> & { file: string }) {
  const load = tsxPageModules[file]
  if (!load) throw new Error(`浏览器端没有这个 TSX 页面：${file}`)
  return (
    <PageFrame {...frame}>
      <TsxPageBody load={load} />
    </PageFrame>
  )
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { title, description, url, siteName, commenter, people, snapshots } = loaderData
  const frame = { title, description, url, siteName, commenter, people, snapshots }
  if (loaderData.type === 'mdx') return <MdxPage path={loaderData.path} {...frame} />
  if (loaderData.type === 'tsx') return <TsxPage file={loaderData.file} {...frame} />
  return (
    <PageFrame {...frame}>
      <HtmlPageFrame src={loaderData.src} title={title ?? ''} />
    </PageFrame>
  )
}
