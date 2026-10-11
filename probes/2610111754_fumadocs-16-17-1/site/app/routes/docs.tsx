import type { Route } from './+types/docs';
import { DocsLayout } from '@/layouts/docs';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from '@/layouts/docs/page';
import { docs, feeds, source } from '@/lib/source';
import { baseOptions } from '@/lib/layout.shared';
import { useFumadocsLoader } from 'fumadocs-core/source/client';
import { useMDXComponents } from '@/components/mdx';
import { use, useState } from 'react';
import { getPageImageUrl, getPageMarkdownUrl, gitConfig } from '@/lib/shared';

export async function loader({ params }: Route.LoaderArgs) {
  const slugs = params['*'].split('/').filter((v) => v.length > 0);
  const page = source.getPage(slugs);
  if (!page) throw new Response('Not found', { status: 404 });

  return {
    path: page.path,
    markdownUrl: getPageMarkdownUrl(page).url,
    pageTree: await source.serializePageTree(source.getPageTree()),
    imagePath: getPageImageUrl(page).url,
    feedMessage: feeds.entries.find((e) => e.info.path.endsWith('/demo.json'))?.message ?? '(missing)',
  };
}

function Content({
  path,
  markdownUrl,
  imagePath,
}: {
  path: string;
  markdownUrl: string;
  imagePath: string;
}) {
  const page = docs.getPage(path);
  if (!page) throw new Error(`unknown page: ${path}`);

  // content is loaded lazily, call `page.preload()` in your loader to avoid suspending
  const { toc } = use(page.load());
  const Mdx = page.body;

  // E-6：全宽模式开关——正文占满、隐藏右侧目录
  const [full, setFull] = useState(false);

  return (
    <DocsPage toc={toc} full={full}>
      <title>{page.title}</title>
      <meta name="description" content={page.description} />
      <meta property="og:image" content={imagePath} />
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <div className="flex flex-row gap-2 items-center border-b -mt-4 pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          markdownUrl={markdownUrl}
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/content/docs/${path}`}
        />
        <button
          type="button"
          data-probe="full-toggle"
          aria-pressed={full}
          onClick={() => setFull((v) => !v)}
          className="rounded-md border px-2 py-1 text-sm"
        >
          {full ? '退出全宽' : '全宽'}
        </button>
      </div>
      <DocsBody>
        <Mdx components={useMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

/** E-7：feeds 数据显示 + 计数器（计数器归零说明整页刷新了） */
function FeedProbe({ feedMessage }: { feedMessage: string }) {
  const [count, setCount] = useState(0);
  return (
    <div data-probe="feed-panel" className="fixed bottom-4 right-4 z-50 rounded border bg-fd-card p-2 text-sm shadow">
      <div data-probe="feed-value">{feedMessage}</div>
      <button data-probe="feed-counter" type="button" onClick={() => setCount((c) => c + 1)}>
        计数器：{count}
      </button>
    </div>
  );
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { path, pageTree, imagePath, markdownUrl, feedMessage } = useFumadocsLoader(loaderData);

  return (
    <DocsLayout {...baseOptions()} tree={pageTree}>
      <Content path={path} markdownUrl={markdownUrl} imagePath={imagePath} />
      <FeedProbe feedMessage={feedMessage} />
    </DocsLayout>
  );
}
