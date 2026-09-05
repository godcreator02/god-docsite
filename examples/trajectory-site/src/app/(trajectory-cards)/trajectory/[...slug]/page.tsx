import { trajectorySource } from '@/lib/trajectory-source';
import { DocsBody, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { getMDXComponents } from '@/components/mdx';
import { notFound } from 'next/navigation';

// 卡页：元信息那行后跟一条「回到盘」。slug 必选——空 slug 是整页盘那条路由（另一个路由组）。
export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const page = trajectorySource.getPage(slug);
  if (!page) notFound();

  const { title, type, domain, parent, ['born-at']: bornAt } = page.data;
  const MDX = page.data.body;
  // 回到盘：带上第一个 parent 当盘身份（它不是根卡时组件退回第一张盘），没有 parent 就不带
  const backHref =
    parent && parent.length > 0 ? `/trajectory?disk=${encodeURIComponent(parent[0])}` : '/trajectory';
  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{title}</DocsTitle>
      <div style={{ fontSize: 13, opacity: 0.7, margin: '-8px 0 4px' }}>
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
      <div style={{ fontSize: 13, margin: '0 0 16px' }}>
        <a href={backHref}>← 回到盘</a>
      </div>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

// 只出卡，不出空 slug——空 slug 归整页盘那条路由
export function generateStaticParams() {
  return trajectorySource.generateParams().filter((p) => p.slug.length > 0);
}
