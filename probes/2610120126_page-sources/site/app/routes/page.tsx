import type { Route } from './+types/page'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import { useFumadocsLoader } from 'fumadocs-core/source/client'
import { use, useState } from 'react'
import type { TOCItemType } from 'fumadocs-core/toc'
import { contentFileUrlOf, type HtmlHeadingAnchor } from '@probe/page-sources'
import { docs, tsxPageModules } from '@/lib/collections'
import { TsxPageBody, HtmlPageBody } from '@/lib/page-bodies'
import { useMDXComponents } from '@/components/mdx'

type PageKind = 'mdx' | 'tsx' | 'html'

export async function loader({ params }: Route.LoaderArgs) {
  const { source } = await import('@/lib/source.server')
  const slugs = params['*'].split('/').filter((part) => part.length > 0)
  const page = source.getPage(slugs)
  if (!page) throw new Response('Not found', { status: 404 })
  return {
    type: page.type as PageKind,
    path: page.path,
    file: page.type === 'mdx' ? undefined : page.data.file,
    title: page.data.title,
    description: page.data.description ?? null,
    headings: page.type === 'html' ? page.data.headings : [],
    htmlSrc: page.type === 'html' ? contentFileUrlOf(page.data.file) : null,
    pageTree: await source.serializePageTree(source.getPageTree()),
  }
}

function MdxContent({ path, title, description }: { path: string; title: string; description: string | null }) {
  const page = docs.getPage(path)
  if (!page) throw new Error(`unknown mdx page: ${path}`)
  const { toc } = use(page.load())
  const Body = page.body
  return (
    <DocsPage toc={toc}>
      <title>{title}</title>
      <meta name="description" content={description ?? undefined} />
      <DocsTitle>{title}</DocsTitle>
      <DocsDescription>{description}</DocsDescription>
      <DocsBody>
        <Body components={useMDXComponents()} />
      </DocsBody>
    </DocsPage>
  )
}

function TsxContent({ file, title, description }: { file: string; title: string; description: string | null }) {
  const load = tsxPageModules[file]
  if (!load) throw new Error(`unknown tsx page: ${file}`)
  const [toc, setToc] = useState<TOCItemType[]>([])
  return (
    <DocsPage toc={toc} tableOfContentPopover={{ enabled: toc.length > 0 }}>
      <title>{title}</title>
      <meta name="description" content={description ?? undefined} />
      <DocsTitle>{title}</DocsTitle>
      <DocsDescription>{description}</DocsDescription>
      <DocsBody>
        <TsxPageBody load={load} onToc={setToc} />
      </DocsBody>
    </DocsPage>
  )
}

function HtmlContent({
  title,
  description,
  headings,
  src,
}: {
  title: string
  description: string | null
  headings: HtmlHeadingAnchor[]
  src: string
}) {
  const toc = headings.map(({ id, text, level }) => ({ title: text, url: `#${id}`, depth: level }) satisfies TOCItemType)
  return (
    <DocsPage toc={toc} tableOfContentPopover={{ enabled: toc.length > 0 }}>
      <title>{title}</title>
      <meta name="description" content={description ?? undefined} />
      <DocsTitle>{title}</DocsTitle>
      <DocsDescription>{description}</DocsDescription>
      <DocsBody>
        <HtmlPageBody src={src} headings={headings} />
      </DocsBody>
    </DocsPage>
  )
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { type, path, file, title, description, headings, htmlSrc, pageTree } = useFumadocsLoader(loaderData)
  return (
    <DocsLayout tree={pageTree}>
      {type === 'mdx' ? (
        <MdxContent path={path} title={title} description={description} />
      ) : type === 'tsx' ? (
        <TsxContent file={file!} title={title} description={description} />
      ) : (
        <HtmlContent title={title} description={description} headings={headings} src={htmlSrc!} />
      )}
    </DocsLayout>
  )
}
