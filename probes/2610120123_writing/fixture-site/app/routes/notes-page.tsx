import type { ComponentType } from 'react'
import { DocsBody, DocsPage, DocsTitle } from '@fumadocs/base-ui/layouts/docs/page'
import browserCollections from '../../.source/browser'
import { mdxComponents } from '../mdx-components'
import { notesSource } from '../source'
import type { Route } from './+types/notes-page'

/** 集合 B 的浏览器正文入口：与集合 A 同样的渲染，差别只在集合配置没启用术语插件 */
const notesContent = browserCollections.notes.createClientLoader({
  component({ default: Mdx }: { default: ComponentType<{ components?: import('mdx/types').MDXComponents }> }) {
    return <Mdx components={mdxComponents} />
  },
})

function plainToc(toc: { title: unknown; url: string; depth: number }[]) {
  return toc.map((item) => ({ ...item, title: typeof item.title === 'string' ? item.title : '' }))
}

export async function loader({ params }: Route.LoaderArgs) {
  const slugs = (params['*'] ?? '').split('/').filter((segment) => segment.length > 0)
  const page = notesSource.getPage(slugs)
  if (!page) throw new Response('没有这一页', { status: 404 })
  const { toc } = await page.data.load()
  await notesContent.preload(page.path)
  return { title: page.data.title, toc: plainToc(toc), path: page.path }
}

export default function NotesPageRoute({ loaderData }: Route.ComponentProps) {
  return (
    <DocsPage toc={loaderData.toc} tableOfContent={{ header: '本页目录' }}>
      <title>{`${loaderData.title} · 写作能力样本`}</title>
      <DocsTitle>{loaderData.title}</DocsTitle>
      <DocsBody>{notesContent.useContent(loaderData.path)}</DocsBody>
    </DocsPage>
  )
}
