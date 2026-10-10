import { useMemo } from 'react'
import { Outlet } from 'react-router'
import { useFumadocsLoader } from 'fumadocs-core/source/client'
import { DocsLayout } from '@fumadocs/base-ui/layouts/docs'
import { siteIdentity } from '@godcreator/docsite-kit/server'
import { themeSwitchWithIdentity } from '@godcreator/docsite-kit/ui'
import { source } from '../lib/source'
import type { Route } from './+types/layout'

export async function loader() {
  return { pageTree: await source.serializePageTree(source.getPageTree()), identity: siteIdentity() }
}

export default function Layout({ loaderData }: Route.ComponentProps) {
  const { pageTree } = useFumadocsLoader(loaderData)
  const { identity } = loaderData
  const themeSwitch = useMemo(() => themeSwitchWithIdentity(identity), [identity.person?.id, identity.reason])
  return (
    <DocsLayout tree={pageTree} nav={{ title: pageTree.name }} links={[{ text: '全部评论', url: '/comments' }]} slots={{ themeSwitch }}>
      <Outlet />
    </DocsLayout>
  )
}
