import type { ReactNode } from 'react'
import type * as PageTree from 'fumadocs-core/page-tree'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'

type TreeSource = { getPageTree(): PageTree.Root }

export function createRootLayout({ title, source }: { title: string; source: TreeSource }) {
  return function RootLayout({ children }: { children: ReactNode }) {
    return (
      <html lang="zh-CN" suppressHydrationWarning>
        <body className="flex flex-col min-h-screen">
          <RootProvider>
            <DocsLayout tree={source.getPageTree()} nav={{ title }}>
              {children}
            </DocsLayout>
          </RootProvider>
        </body>
      </html>
    )
  }
}
