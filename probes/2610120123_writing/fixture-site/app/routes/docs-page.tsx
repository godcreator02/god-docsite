import type { ComponentType } from 'react'
import { DocsBody, DocsPage, DocsTitle } from '@fumadocs/base-ui/layouts/docs/page'
import browserCollections from '../../.source/browser'
import { mdxComponents } from '../mdx-components'
import { docsSource } from '../source'
import type { Route } from './+types/docs-page'

/** 集合 A 的浏览器正文入口：组件表在这里给 MDX，客户端按需加载本页正文（官方 createClientLoader） */
const docsContent = browserCollections.docs.createClientLoader({
  component({ default: Mdx }: { default: ComponentType<{ components?: import('mdx/types').MDXComponents }> }) {
    return <Mdx components={mdxComponents} />
  },
})

/** loader 只交本页元数据。目录的标题是 ReactNode，过 React Router 的 loader 序列化前收成字符串 */
function plainToc(toc: { title: unknown; url: string; depth: number }[]) {
  return toc.map((item) => ({ ...item, title: typeof item.title === 'string' ? item.title : '' }))
}

export async function loader({ params }: Route.LoaderArgs) {
  const slugs = (params['*'] ?? '').split('/').filter((segment) => segment.length > 0)
  const page = docsSource.getPage(slugs)
  if (!page) throw new Response('没有这一页', { status: 404 })
  const { toc } = await page.data.load()
  await docsContent.preload(page.path)
  return { title: page.data.title, toc: plainToc(toc), path: page.path }
}

export default function DocsPageRoute({ loaderData }: Route.ComponentProps) {
  return (
    <DocsPage toc={loaderData.toc} tableOfContent={{ header: '本页目录' }}>
      <title>{`${loaderData.title} · 写作能力样本`}</title>
      <DocsTitle>{loaderData.title}</DocsTitle>
      <DocsBody>{docsContent.useContent(loaderData.path)}</DocsBody>
    </DocsPage>
  )
}
