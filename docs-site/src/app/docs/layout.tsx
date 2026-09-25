/**
 * 三个区合成一棵侧栏树：每个区一个 root: true 的根节点（侧栏分区），URL 仍按区分前缀，路由各用各的 loader。
 * base-ui 版的 Root 只有一个 fallback 槽，多棵树切换不稳定，所以用根节点分区。
 * src/app/(trajectory-cards)/trajectory/layout.tsx 与 src/app/future/layout.tsx 直接用这一份，三个区的页共用同一个侧栏。
 * 星轨整页 /trajectory 不用它：那条路由在另一个路由组里，整个视口就是星轨盘，没有侧栏。
 */
import { source, sourceFuture, sourceTrajectory } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import type { Node, Root } from 'fumadocs-core/page-tree';
import type { ReactNode } from 'react';
import '../docfirst.css';
import '../site.css';

function zone(name: string, root: Root): Node {
  return { type: 'folder', name, root: true, defaultOpen: true, children: root.children };
}

export default function Layout({ children }: { children: ReactNode }) {
  const tree: Root = {
    name: 'god-live-doc',
    children: [zone('现状', source.getPageTree()), zone('轨迹', sourceTrajectory.getPageTree()), zone('未来', sourceFuture.getPageTree())],
  };
  return (
    <DocsLayout tree={tree} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}
