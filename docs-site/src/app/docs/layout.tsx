/**
 * 各区合成一棵侧栏树：每个区一个 root: true 的根节点（侧栏分区），URL 仍按区分前缀，路由各用各的 loader。
 * base-ui 版的 Root 只有一个 fallback 槽，多棵树切换不稳定，所以用根节点分区。
 * src/app/maintain、src/app/(trajectory-cards)/trajectory、src/app/future 的 layout.tsx 直接用这一份，各区的页共用同一个侧栏。
 * 星轨整页 /trajectory 不用它：那条路由在另一个路由组里，整个视口就是星轨盘，没有侧栏。
 */
import { source, sourceFuture, sourceMaintain, sourceTrajectory } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import type { Node, Root } from 'fumadocs-core/page-tree';
import type { ReactNode } from 'react';
import '../docfirst.css';
import '../site.css';

/**
 * 每个区必须带唯一的 $id：fumadocs 给侧栏的区切换下拉找「这个根节点对应哪个选项」时，除了比对象本身还比 $id，
 * 手工拼的节点都没有 $id 的话 undefined === undefined 成立，各区都会对上第一个选项，下拉里的名字和链接就乱了
 */
function zone(id: string, name: string, root: Root): Node {
  return { $id: `zone:${id}`, type: 'folder', name, root: true, defaultOpen: true, children: root.children };
}

export default function Layout({ children }: { children: ReactNode }) {
  const tree: Root = {
    name: 'god-live-doc',
    children: [
      zone('docs', '现状 · 原理', source.getPageTree()),
      zone('maintain', '现状 · 维护', sourceMaintain.getPageTree()),
      zone('trajectory', '轨迹', sourceTrajectory.getPageTree()),
      zone('future', '未来', sourceFuture.getPageTree()),
    ],
  };
  return (
    <DocsLayout tree={tree} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}
