/**
 * 三区合一棵侧栏树：每区一个 `root: true` 的根节点（侧栏分区），URL 仍是三个基座
 * （/docs、/trajectory、/future，路由各走各的 loader）。
 * base-ui 版的 Root 只有单槽 fallback，多棵树切换不稳，所以用根节点分区。
 * 区内的顺序由各区 content/<区>/meta.json 定。
 *
 * 这棵树只给带侧栏的那一组路由用（src/app/(zones)/layout.tsx）。星轨整页 /trajectory
 * 不用它：那条路由整个视口就是星轨盘，没有侧栏。
 */
import { source, sourceFuture, sourceTrajectory } from './source';
import type { Node, Root } from 'fumadocs-core/page-tree';

function zone(name: string, root: Root): Node {
  return {
    type: 'folder',
    name,
    root: true,
    defaultOpen: true,
    children: root.children,
  };
}

export function zoneTree(): Root {
  return {
    name: 'god-live-doc',
    children: [
      zone('现状', source.getPageTree()),
      zone('轨迹', sourceTrajectory.getPageTree()),
      zone('未来', sourceFuture.getPageTree()),
    ],
  };
}
