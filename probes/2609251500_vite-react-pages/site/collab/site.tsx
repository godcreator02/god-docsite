import { createBrowserRouter, Outlet } from 'react-router'
import { RootProvider } from 'fumadocs-ui/provider/react-router'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import type * as PageTree from 'fumadocs-core/page-tree'
import { folderTitle, sitePages, type SitePage } from './data'
import { CurrentPageContext } from './page-context'
import { CommentFrame } from './comments'

const siteTitle = '2026 SST 与 MMC 样机设计'

function buildPageTree(pages: SitePage[]): PageTree.Root {
  const root: PageTree.Root = { name: siteTitle, children: [] }
  const folders = new Map<string, PageTree.Folder>()
  const childrenOf = (folderPath: string): PageTree.Node[] => {
    if (folderPath === 'pages') return root.children
    let folder = folders.get(folderPath)
    if (!folder) {
      folder = { type: 'folder', name: folderTitle(folderPath), defaultOpen: true, children: [] }
      folders.set(folderPath, folder)
      childrenOf(folderPath.slice(0, folderPath.lastIndexOf('/'))).push(folder)
    }
    return folder.children
  }
  for (const page of pages) {
    const folderPath = page.key.slice(0, page.key.lastIndexOf('/'))
    childrenOf(folderPath).push({ type: 'page', name: page.title, url: page.url })
  }
  return root
}

function SiteLayout() {
  return (
    <RootProvider search={{ enabled: false }}>
      <DocsLayout tree={buildPageTree(sitePages)} nav={{ title: siteTitle }} searchToggle={{ enabled: false }}>
        <Outlet />
      </DocsLayout>
    </RootProvider>
  )
}

function PageRoute({ page }: { page: SitePage }) {
  const { Component } = page
  return (
    <CurrentPageContext.Provider value={page}>
      <CommentFrame page={page}>
        <Component />
      </CommentFrame>
    </CurrentPageContext.Provider>
  )
}

function NotFound() {
  return <p className="p-8">没有这一页。</p>
}

export const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      ...sitePages.map((page) => ({ path: page.url, element: <PageRoute page={page} /> })),
      { path: '*', element: <NotFound /> },
    ],
  },
])
