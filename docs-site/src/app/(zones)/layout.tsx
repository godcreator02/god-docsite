import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { zoneTree } from '@/lib/tree';
import type { ReactNode } from 'react';

// 带侧栏的那一组：三区的页共用同一棵树（三个根节点），URL 基座各是各的。
// 星轨整页 /trajectory 不在这一组里（它是另一个路由组，整个视口就是星轨盘）。
export default function Layout({ children }: { children: ReactNode }) {
  return <DocsLayout tree={zoneTree()}>{children}</DocsLayout>;
}
