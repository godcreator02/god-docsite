import { trajectorySource } from '@/lib/trajectory-source';
import { DocsBody, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { getMDXComponents } from '@/components/mdx';
import { notFound } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const page = trajectorySource.getPage(slug);
  if (!page) notFound();

  const { title, type, domain, parent, ['born-at']: bornAt } = page.data;
  const MDX = page.data.body;
  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{title}</DocsTitle>
      <div style={{ fontSize: 13, opacity: 0.7, margin: '-8px 0 16px' }}>
        {bornAt}
        {type ? ` · ${type}` : ''}
        {domain ? ` · ${domain}` : ''}
        {parent && parent.length > 0 ? (
          <>
            {' · 父卡：'}
            {parent.map((id: string, i: number) => (
              <span key={id}>
                {i > 0 ? '、' : ''}
                <a href={`/trajectory/${encodeURIComponent(id)}`}>{id}</a>
              </span>
            ))}
          </>
        ) : null}
      </div>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return trajectorySource.generateParams();
}
