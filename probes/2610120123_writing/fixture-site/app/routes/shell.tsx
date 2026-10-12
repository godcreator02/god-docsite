import { Outlet } from 'react-router'
import { useFumadocsLoader } from 'fumadocs-core/source/client'
import { DocsLayout } from '@fumadocs/base-ui/layouts/docs'
import { docsSource } from '../source'
import type { Route } from './+types/shell'

export async function loader() {
  return { pageTree: await docsSource.serializePageTree(docsSource.getPageTree()) }
}

/** 集合 A 的页面树给侧栏；集合 B（notes）不在侧栏里，从首页与页内链接进 */
export default function Shell({ loaderData }: Route.ComponentProps) {
  const { pageTree } = useFumadocsLoader(loaderData)
  return (
    <DocsLayout tree={pageTree} nav={{ title: '写作能力样本' }}>
      <Outlet />
    </DocsLayout>
  )
}
