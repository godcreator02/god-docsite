/**
 * 各区合成一棵侧栏树：每个区一个 root: true 的根节点，就是侧栏顶上下拉里的一项；URL 仍按区分前缀，路由各用各的 loader。
 * base-ui 版的 Root 只有一个 fallback 槽，多棵树切换不稳定，所以用根节点分区。
 * 现状区的其余分区、轨迹卡页（src/app/(trajectory-cards)/trajectory/layout.tsx）与 src/app/future/layout.tsx 直接用这一份，各区的页共用同一个侧栏；
 * 整页星轨盘在另一个路由组里，不用侧栏。
 */
import { currentSources, sourceFuture, sourceTrajectory } from '@/lib/source';
import { currentZones } from '@/lib/shared';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import type { LayoutTab } from 'fumadocs-ui/layouts/shared';
import type { Folder, Node, Root } from 'fumadocs-core/page-tree';
import type { ReactNode } from 'react';
import '../docfirst.css';

/**
 * 每个区必须带唯一的 $id：fumadocs 给侧栏的区切换下拉找「这个根节点对应哪个选项」时，除了比对象本身还比 $id，
 * 手工拼的节点都没有 $id 的话 undefined === undefined 成立，几个区都会对上第一个选项，下拉里的名字和链接就乱了
 */
function zone(id: string, name: string, root: Root): Folder {
  return { $id: `zone:${id}`, type: 'folder', name, root: true, defaultOpen: true, children: root.children };
}

/** 按侧栏顺序找到的第一页：目录自己的页（index）算在它的子项前面 */
function firstPageUrl(nodes: Node[]): string {
  for (const node of nodes) {
    if (node.type === 'page') return node.url;
    if (node.type === 'folder') {
      if (node.index) return node.index.url;
      const nested = firstPageUrl(node.children);
      if (nested !== '') return nested;
    }
  }
  return '';
}

/** 下拉里的各项显式给出：fumadocs 自动生成时只在根节点的 index 与第一层子项里找地址，第一层全是目录的区会被整项丢掉 */
function zoneTab(folder: Folder): LayoutTab {
  const url = firstPageUrl(folder.children);
  if (url === '') throw new Error(`侧栏的「${folder.name}」区里一页都没有`);
  return { title: folder.name, url, $folder: folder };
}

export default function Layout({ children }: { children: ReactNode }) {
  const zones = [
    ...currentZones.map(({ id, title }) => zone(id, title, currentSources[id].source.getPageTree())),
    zone('trajectory', '轨迹', sourceTrajectory.getPageTree()),
    zone('future', '未来', sourceFuture.getPageTree()),
  ];
  const tree: Root = { name: '协作站框架', children: zones };
  return (
    <DocsLayout tree={tree} tabs={zones.map(zoneTab)} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}
