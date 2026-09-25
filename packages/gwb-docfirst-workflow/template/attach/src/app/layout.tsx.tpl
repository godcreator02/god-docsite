/**
 * 所有内容集合合成一棵侧栏树：每个集合一个 root: true 的根节点（侧栏分区），URL 仍按集合分前缀，
 * 路由各用各的 loader。base-ui 版的 Root 只有一个 fallback 槽，多棵树切换不稳定，所以用根节点分区。
 */
import { RootProvider } from 'fumadocs-ui/provider/next'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { source, sourceFuture, sourceTrajectory } from '@/lib/source'
import type { Node, Root } from 'fumadocs-core/page-tree'
import type { ReactNode } from 'react'
import './global.css'

function zone(name: string, root: Root): Node {
  return {
    type: 'folder',
    name,
    root: true,
    defaultOpen: true,
    children: root.children,
  }
}

export default function Layout({ children }: { children: ReactNode }) {
  const tree: Root = {
    name: '{{title}}',
    children: [
      zone('现状', source.getPageTree()),
      zone('轨迹', sourceTrajectory.getPageTree()),
      zone('未来', sourceFuture.getPageTree()),
    ],
  }

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>
          <DocsLayout tree={tree} nav={{ title: '{{title}}' }}>
            {children}
          </DocsLayout>
        </RootProvider>
      </body>
    </html>
  )
}
