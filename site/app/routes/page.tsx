import { use, type ReactNode } from 'react'
import type { TOCItemType } from 'fumadocs-core/toc'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from '@fumadocs/base-ui/layouts/spacious/page'
import defaultMdxComponents from '@fumadocs/base-ui/mdx'
import { contentFileUrlOf } from '@godcreator/docsite-kit/page-sources'
import { HtmlPageFrame, TsxPageBody } from '@godcreator/docsite-kit/ui'
import { docs, tsxPageModules } from '../lib/collections'
import { source } from '../lib/source'
import type { Route } from './+types/page'

export async function loader({ params }: Route.LoaderArgs) {
  const slugs = (params['*'] ?? '').split('/').filter((segment) => segment.length > 0)
  const page = source.getPage(slugs)
  if (!page) throw new Response('没有这一页', { status: 404 })
  const { title, description } = page.data
  if (page.type === 'mdx') return { type: 'mdx' as const, title, description, path: page.path }
  if (page.type === 'tsx') return { type: 'tsx' as const, title, description, file: page.data.file }
  return { type: 'html' as const, title, description, src: contentFileUrlOf(page.data.file) }
}

type PageFrameProps = { title: string | undefined; description: string | undefined; toc?: TOCItemType[]; children: ReactNode }

function PageFrame({ title, description, toc, children }: PageFrameProps) {
  return (
    <DocsPage toc={toc}>
      <title>{title}</title>
      <DocsTitle>{title}</DocsTitle>
      <DocsDescription>{description}</DocsDescription>
      <DocsBody>{children}</DocsBody>
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
  const { title, description } = loaderData
  if (loaderData.type === 'mdx') return <MdxPage path={loaderData.path} title={title} description={description} />
  if (loaderData.type === 'tsx') return <TsxPage file={loaderData.file} title={title} description={description} />
  return (
    <PageFrame title={title} description={description}>
      <HtmlPageFrame src={loaderData.src} title={title ?? ''} />
    </PageFrame>
  )
}
