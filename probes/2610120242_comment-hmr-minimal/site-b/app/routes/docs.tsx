import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useFumadocsLoader } from 'fumadocs-core/source/client';
import { docsContent } from '~/lib/docs-entry';
import { docsRaw } from '~/lib/content-loaders';
import { docsSource } from '~/lib/source.server';
import type { Node as PageTreeNode, Root as PageTreeRoot } from 'fumadocs-core/page-tree';

// 客户端模块求值计数：HMR 重求值时 window 保留
declare global {
  interface Window {
    __docsModuleEvals?: number;
  }
}
if (typeof window !== 'undefined') {
  window.__docsModuleEvals = (window.__docsModuleEvals ?? 0) + 1;
}

/**
 * 新增正文基线路由：无评论、无 action、无 fetcher。
 * 页面状态探针：页面计数器、未提交输入（受控/非受控）；正文内自带本地 TSX 计数器与图片（content 里）。
 */
export async function loader({ params }: { params: { [key: string]: string | undefined } }) {
  const slugs = (params['*'] ?? '').split('/').filter((v) => v.length > 0);
  const page = docsSource.getPage(slugs);
  if (!page) throw new Response('Not Found', { status: 404 });
  return {
    docsPath: page.path,
    pageTree: await docsSource.serializePageTree(docsSource.getPageTree()),
  };
}

export default function DocsRoute({ loaderData }: { loaderData: { docsPath: string; pageTree: PageTreeRoot } }) {
  // pageTree 经 fumadocs 的自定义流序列化传给浏览器（$fumadocs_loader 标记），
  // 必须经官方 useFumadocsLoader 解包；SSR 直连 loader 的原始树则原样通过
  const { docsPath, pageTree } = useFumadocsLoader(loaderData);
  const [pageIdentity] = useState(() => `docs-${Math.random().toString(36).slice(2, 8)}`);
  const [pageCount, setPageCount] = useState(0);
  const [draft, setDraft] = useState('');
  const [clientEvals, setClientEvals] = useState<number | null>(null);
  useEffect(() => {
    setClientEvals(window.__docsModuleEvals ?? null);
  }, []);

  return (
    <main data-probe="docs-page" data-identity={pageIdentity} style={{ maxWidth: '48rem', margin: '2rem auto', display: 'grid', gap: '1rem' }}>
      <h1>正文站：新增页面基线</h1>
      <p data-probe="module-evals" data-module-evals={clientEvals ?? ''}>
        docs 路由模块求值次数：{clientEvals ?? '（水合中）'}
      </p>
      <div data-probe="page-counter">
        <button type="button" data-page-count={pageCount} onClick={() => setPageCount((c) => c + 1)}>
          页面组件计数：{pageCount}
        </button>
      </div>
      <label data-probe="draft">
        未提交输入（受控）：
        <input value={draft} onChange={(event) => setDraft(event.target.value)} data-draft />
      </label>
      <label data-probe="draft-uncontrolled">
        未提交输入（非受控，纯 DOM）：
        <input data-draft-uncontrolled />
      </label>
      <nav data-docs-nav data-nav-count={countPages(pageTree)}>
        {pageTree.children.map((node, i) => (
          <NavNode key={i} node={node} />
        ))}
      </nav>
      <article data-probe="docs-body">
        <DocsBody path={docsPath} />
      </article>
    </main>
  );
}

/** 官方 client loader 渲染正文；入口未到（raw 无此路径）先显示占位，不 throw */
function DocsBody({ path }: { path: string }) {
  const hasEntry = path in docsRaw || `./${path}` in docsRaw;
  if (!hasEntry) {
    return <p data-docs-pending>页面正文准备中（浏览器编译入口未到）</p>;
  }
  return docsContent.useContent(path);
}

function countPages(node: PageTreeNode | PageTreeRoot): number {
  if (node.type === 'folder') return node.children.reduce<number>((sum, child) => sum + countPages(child), 0);
  return node.type === 'page' ? 1 : 0;
}

function NavNode({ node }: { node: PageTreeNode }) {
  if (node.type === 'page') {
    return (
      <div>
        <Link to={node.url} data-nav-page={node.url}>
          {node.name}
        </Link>
      </div>
    );
  }
  if (node.type === 'folder') {
    return (
      <div data-nav-folder={node.name}>
        {node.children.map((child, i) => (
          <NavNode key={i} node={child} />
        ))}
      </div>
    );
  }
  return null;
}
