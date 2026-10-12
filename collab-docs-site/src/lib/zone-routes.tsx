/**
 * 现状区每个分区的页面路由与机读版路由都是同一份写法，按分区 id 取 loader；
 * src/app/<分区>/[[...slug]]/page.tsx 与 src/app/llms.mdx/<分区>/[[...slug]]/route.ts 只各写一行调用
 */
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { getMDXComponents } from '@/components/mdx';
import { currentSources } from './source';
import { getPageMarkdownUrl, type CurrentZoneId } from './shared';

type SlugProps = { params: Promise<{ slug?: string[] }> };

export function zonePage(zone: CurrentZoneId) {
  const { source } = currentSources[zone];

  async function Page(props: SlugProps) {
    const params = await props.params;
    const page = source.getPage(params.slug);
    if (!page) notFound();

    const MDX = page.data.body;
    const markdownUrl = getPageMarkdownUrl(page, zone).url;

    return (
      <DocsPage toc={page.data.toc} full={page.data.full}>
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
        <div className="flex flex-row gap-2 items-center border-b pb-6">
          <MarkdownCopyButton markdownUrl={markdownUrl} />
          <ViewOptionsPopover markdownUrl={markdownUrl} />
        </div>
        <DocsBody>
          <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
        </DocsBody>
      </DocsPage>
    );
  }

  async function generateMetadata(props: SlugProps): Promise<Metadata> {
    const params = await props.params;
    const page = source.getPage(params.slug);
    if (!page) notFound();
    return { title: page.data.title, description: page.data.description };
  }

  return { Page, generateStaticParams: () => source.generateParams(), generateMetadata };
}

export function zoneMarkdownRoute(zone: CurrentZoneId) {
  const { source, llms } = currentSources[zone];

  async function GET(_req: Request, { params }: SlugProps) {
    const { slug } = await params;
    const page = source.getPage(slug?.slice(0, -1));
    if (!page) notFound();

    return new Response(await llms.page(page), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
      },
    });
  }

  function generateStaticParams() {
    return source.getPages().map((page) => ({
      lang: page.locale,
      slug: getPageMarkdownUrl(page, zone).segments,
    }));
  }

  return { GET, generateStaticParams };
}
