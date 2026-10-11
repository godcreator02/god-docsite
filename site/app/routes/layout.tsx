import { useMemo, type ReactNode } from 'react'
import { Outlet } from 'react-router'
import { MessageSquare } from 'lucide-react'
import { useFumadocsLoader } from 'fumadocs-core/source/client'
import { DocsLayout } from '@fumadocs/base-ui/layouts/docs'
import { siteIdentity } from '@godcreator/docsite-kit/server'
import { groupKeepingSidebar, routeLinksSearchTrigger, SidebarRouteLinks, themeSwitchWithIdentity } from '@godcreator/docsite-kit/ui'
import { sitePageRefs, source } from '../lib/source'
import { featureServers } from '../site/data.server'
import { featureSites } from '../site/ui'
import type { Route } from './+types/layout'

/** 各功能包的 layoutData 也在这里读：它们的数据每一页都要用（比如正文里引用任务） */
export async function loader() {
  const pages = sitePageRefs()
  const featureData: Record<string, unknown> = {}
  for (const { name, layoutData } of featureServers) featureData[name] = layoutData ? await layoutData({ pages }) : null
  return { pageTree: await source.serializePageTree(source.getPageTree()), identity: siteIdentity(), featureData }
}

const routeLinks = <SidebarRouteLinks links={[...featureSites.flatMap((feature) => feature.routeLinks ?? []), { text: '评论', url: '/comments', icon: <MessageSquare /> }]} />

export default function Layout({ loaderData }: Route.ComponentProps) {
  const { pageTree } = useFumadocsLoader(loaderData)
  const { identity, featureData } = loaderData
  const themeSwitch = useMemo(() => themeSwitchWithIdentity(identity), [identity.person?.id, identity.reason])
  const docsLayout = (
    <DocsLayout tree={pageTree} nav={{ title: pageTree.name }} sidebar={{ banner: routeLinks }} slots={{ themeSwitch, sidebar: groupKeepingSidebar, searchTrigger: routeLinksSearchTrigger }}>
      {featureSites.map(({ name, PageTop }) => PageTop && <PageTop key={name} />)}
      <Outlet />
    </DocsLayout>
  )
  return featureSites.reduceRight<ReactNode>((children, { name, Provider }) => (Provider ? <Provider data={featureData[name]}>{children}</Provider> : children), docsLayout)
}
