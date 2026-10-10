import { Outlet } from 'react-router'
import { useFumadocsLoader } from 'fumadocs-core/source/client'
import { DocsLayout } from '@fumadocs/base-ui/layouts/glass'
import { source } from '../lib/source'
import type { Route } from './+types/layout'

export async function loader() {
  return { pageTree: await source.serializePageTree(source.getPageTree()) }
}

export default function Layout({ loaderData }: Route.ComponentProps) {
  const { pageTree } = useFumadocsLoader(loaderData)
  return (
    <DocsLayout tree={pageTree} nav={{ title: pageTree.name }}>
      <Outlet />
    </DocsLayout>
  )
}
