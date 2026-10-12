import type { ComponentType } from 'react'
import type { MDXComponents } from 'mdx/types'
import type { TableOfContents } from 'fumadocs-core/toc'
import { DocsBody, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import { notFound } from 'next/navigation'

type PageData = {
  title?: string
  toc: TableOfContents
  body: ComponentType<{ components?: MDXComponents }>
}

type PageSource = {
  getPage(slug?: string[]): { data: PageData } | undefined
  generateParams(): { slug: string[] }[]
}

export function createPage({ source, components }: { source: PageSource; components: MDXComponents }) {
  async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
    const { slug } = await params
    const page = source.getPage(slug)
    if (!page) notFound()
    const MDX = page.data.body
    return (
      <DocsPage toc={page.data.toc}>
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsBody>
          <MDX components={components} />
        </DocsBody>
      </DocsPage>
    )
  }
  return { Page, generateStaticParams: () => source.generateParams() }
}
