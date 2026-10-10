import { use, type ReactNode } from 'react'
import type { TOCItemType } from 'fumadocs-core/toc'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from '@fumadocs/base-ui/layouts/docs/page'
import defaultMdxComponents from '@fumadocs/base-ui/mdx'
import { commentThreadsOf, type CommentThread } from '@godcreator/docsite-kit/comments'
import { contentFileUrlOf } from '@godcreator/docsite-kit/page-sources'
import { CommentColumn, CommentList, commentScopeProps, docsPagePropsWithSideColumn, HtmlPageFrame, TsxPageBody } from '@godcreator/docsite-kit/ui'
import { comments, docs, tsxPageModules } from '../lib/collections'
import { source } from '../lib/source'
import type { Route } from './+types/page'

export async function loader({ params }: Route.LoaderArgs) {
  const slugs = (params['*'] ?? '').split('/').filter((segment) => segment.length > 0)
  const page = source.getPage(slugs)
  if (!page) throw new Response('没有这一页', { status: 404 })
  const { title, description } = page.data
  const shared = { title, description, url: page.url }
  if (page.type === 'mdx') return { type: 'mdx' as const, ...shared, path: page.path }
  if (page.type === 'tsx') return { type: 'tsx' as const, ...shared, file: page.data.file }
  return { type: 'html' as const, ...shared, src: contentFileUrlOf(page.data.file) }
}

type CommentEntry = (typeof comments.entries)[number]

const threadsOfPage = new Map<string, CommentThread<CommentEntry>[]>()
for (const thread of commentThreadsOf(comments.entries)) threadsOfPage.set(thread.head.page, [...(threadsOfPage.get(thread.head.page) ?? []), thread])

/** 不用 entry.body：它加载完后不再调用 use()，React 报 conditional use of use() */
function CommentBody({ entry }: { entry: CommentEntry }) {
  const { body: Mdx } = use(entry.load())
  return <Mdx components={defaultMdxComponents} />
}

function renderCommentBody(entry: CommentEntry) {
  return <CommentBody entry={entry} />
}

type PageFrameProps = { title: string | undefined; description: string | undefined; url: string; toc?: TOCItemType[]; children: ReactNode }

function PageFrame({ title, description, url, toc, children }: PageFrameProps) {
  const threads = threadsOfPage.get(url) ?? []
  const commentColumn = threads.length > 0 ? <CommentColumn threads={threads} renderBody={renderCommentBody} /> : undefined
  return (
    <DocsPage toc={toc} {...docsPagePropsWithSideColumn(commentColumn)}>
      <title>{title}</title>
      <DocsTitle>{title}</DocsTitle>
      <DocsDescription>{description}</DocsDescription>
      <DocsBody {...commentScopeProps}>{children}</DocsBody>
      <CommentList threads={threads} renderBody={renderCommentBody} />
    </DocsPage>
  )
}

function MdxPage({ path, ...frame }: Omit<PageFrameProps, 'children'> & { path: string }) {
  const page = docs.getPage(path)
  if (!page) throw new Error(`没有这一页：${path}`)
  const { body: Mdx, toc } = use(page.load())
  return (
    <PageFrame {...frame} toc={toc}>
      <Mdx components={defaultMdxComponents} />
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
  const { title, description, url } = loaderData
  if (loaderData.type === 'mdx') return <MdxPage path={loaderData.path} title={title} description={description} url={url} />
  if (loaderData.type === 'tsx') return <TsxPage file={loaderData.file} title={title} description={description} url={url} />
  return (
    <PageFrame title={title} description={description} url={url}>
      <HtmlPageFrame src={loaderData.src} title={title ?? ''} />
    </PageFrame>
  )
}
