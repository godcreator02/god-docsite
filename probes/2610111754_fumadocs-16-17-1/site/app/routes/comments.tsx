import type { Route } from './+types/comments';
import { use } from 'react';
import { comments, source } from '@/lib/source';
import { DocsLayout } from '@/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { useFumadocsLoader } from 'fumadocs-core/source/client';

/**
 * E-3 / E-6：渲染评论集合的整页。不在 docs 页面树里，地址 /comments；
 * E-6 里也用它验证「打开不在页面树里的地址时，侧栏停在最近看过的那一组」，所以挂在 DocsLayout 下
 */
export const meta: Route.MetaFunction = () => [{ title: '评论探针' }];

export async function loader() {
  return {
    pageTree: await source.serializePageTree(source.getPageTree()),
  };
}

function CommentBody({ entry }: { entry: (typeof comments.entries)[number] }) {
  const { body: Mdx } = use(entry.load());
  return <Mdx />;
}

export default function CommentsPage({ loaderData }: Route.ComponentProps) {
  const { pageTree } = useFumadocsLoader(loaderData);

  return (
    <DocsLayout {...baseOptions()} tree={pageTree}>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold">评论探针（E-3）</h1>
        {comments.entries.map((entry) => (
          <section key={entry.info?.path ?? String(entry.author)} className="mt-6 border-t pt-4">
            <h2 className="font-semibold">
              {entry.info?.path} — {entry.author}
            </h2>
            <CommentBody entry={entry} />
          </section>
        ))}
      </main>
    </DocsLayout>
  );
}
