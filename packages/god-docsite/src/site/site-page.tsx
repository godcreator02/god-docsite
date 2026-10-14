import { useState, type FunctionComponent, type ReactNode } from 'react'
import type { TOCItemType } from 'fumadocs-core/toc'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from '@fumadocs/base-ui/layouts/docs/page'
import type { HtmlHeadingAnchor } from '../core/html-text.js'
import { HtmlPageBody, TsxPageBody, type TsxPageModule } from './page-bodies.js'
import type { SitePageData } from './site-context.js'

/** fumadocs-mdx 编译出的一篇 MDX 里平台用到的部分；Components 是站点 MDX 组件表的类型 */
export type CompiledMdxPage<Components> = {
  toc: TOCItemType[]
  frontmatter: { title?: string; description?: string }
  default: FunctionComponent<{ components?: Components }>
}

/** 站点 .source/browser 里的 docs 集合（browserCollections.docs） */
export interface DocsBrowserCollection<Components> {
  createClientLoader(options: { id?: string; component: (loaded: CompiledMdxPage<Components>, props: undefined) => ReactNode }): {
    useContent(path: string): ReactNode
  }
}

export interface SitePageOptions<Components> {
  docs: DocsBrowserCollection<Components>
  /** 站点里 import.meta.glob<TsxPageModule>('/content/**\/*.page.tsx') 的结果：TSX 页面按需加载 */
  tsxPages: Record<string, () => Promise<TsxPageModule>>
  /** MDX 正文不用 import 就能写的组件 */
  components: Components
  /** 正文容器上加的属性，如评论包的 commentScopeProps（评论在这个容器里找被批的原文） */
  bodyProps?: Record<string, string>
}

/**
 * 造页面路由的正文组件：MDX 页由 fumadocs-mdx 的 client loader 在浏览器按路径加载正文，TSX 页按需加载页面模块，
 * HTML 页用 iframe 原样展示。要在站点模块的顶层调用一次（client loader 在这里建，正文缓存跟着它）
 */
export function createSitePage<Components>({ docs, tsxPages, components, bodyProps = {} }: SitePageOptions<Components>) {
  const docsContent = docs.createClientLoader({
    id: 'docs',
    component: ({ toc, frontmatter, default: Mdx }) => (
      <DocsPage toc={toc}>
        <DocsTitle>{frontmatter.title}</DocsTitle>
        {frontmatter.description ? <DocsDescription>{frontmatter.description}</DocsDescription> : null}
        <DocsBody {...bodyProps}>
          <Mdx components={components} />
        </DocsBody>
      </DocsPage>
    ),
  })

  function MdxPage({ path }: { path: string }) {
    return docsContent.useContent(path)
  }

  function TsxPage({ file, title, description }: { file: string; title: string; description: string | undefined }) {
    const load = tsxPages[file]
    if (!load) throw new Error(`浏览器这边没有这个 TSX 页面：${file}`)
    const [toc, setToc] = useState<TOCItemType[]>([])
    return (
      <DocsPage toc={toc} tableOfContentPopover={{ enabled: toc.length > 0 }}>
        <DocsTitle>{title}</DocsTitle>
        {description ? <DocsDescription>{description}</DocsDescription> : null}
        <DocsBody {...bodyProps}>
          <TsxPageBody load={load} onToc={setToc} />
        </DocsBody>
      </DocsPage>
    )
  }

  function HtmlPage({ src, title, description, headings }: { src: string; title: string; description: string | undefined; headings: HtmlHeadingAnchor[] }) {
    const toc = headings.map(({ id, text, level }) => ({ title: text, url: `#${id}`, depth: level }) satisfies TOCItemType)
    return (
      <DocsPage toc={toc} tableOfContentPopover={{ enabled: toc.length > 0 }}>
        <DocsTitle>{title}</DocsTitle>
        {description ? <DocsDescription>{description}</DocsDescription> : null}
        <DocsBody {...bodyProps}>
          <HtmlPageBody src={src} headings={headings} />
        </DocsBody>
      </DocsPage>
    )
  }

  return function SitePage({ page }: { page: SitePageData }) {
    return (
      <>
        <title>{page.siteName === '' ? page.title : `${page.title} · ${page.siteName}`}</title>
        {page.description ? <meta name="description" content={page.description} /> : null}
        {page.type === 'mdx' ? (
          <MdxPage path={page.path} />
        ) : page.type === 'tsx' ? (
          <TsxPage key={page.file} file={page.file} title={page.title} description={page.description} />
        ) : (
          <HtmlPage key={page.src} src={page.src} title={page.title} description={page.description} headings={page.headings} />
        )}
      </>
    )
  }
}
