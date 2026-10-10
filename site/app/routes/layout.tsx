import { useMemo } from 'react'
import { Outlet } from 'react-router'
import { useFumadocsLoader } from 'fumadocs-core/source/client'
import { DocsLayout } from '@fumadocs/base-ui/layouts/docs'
import { siteCommenter } from '@godcreator/docsite-kit/server'
import { themeSwitchWithCommenter } from '@godcreator/docsite-kit/ui'
import { source } from '../lib/source'
import type { Route } from './+types/layout'

export async function loader() {
  return { pageTree: await source.serializePageTree(source.getPageTree()), commenter: siteCommenter() }
}

export default function Layout({ loaderData }: Route.ComponentProps) {
  const { pageTree } = useFumadocsLoader(loaderData)
  const { commenter } = loaderData
  const themeSwitch = useMemo(() => themeSwitchWithCommenter(commenter), [commenter?.name])
  return (
    <DocsLayout tree={pageTree} nav={{ title: pageTree.name }} slots={{ themeSwitch }}>
      <Outlet />
    </DocsLayout>
  )
}
