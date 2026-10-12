import { useMemo, type ReactNode } from 'react'
import { Outlet } from 'react-router'
import { MessageSquare } from 'lucide-react'
import { useFumadocsLoader } from 'fumadocs-core/source/client'
import { DocsLayout } from '@fumadocs/base-ui/layouts/docs'
import { commentLinkTargetsOf, groupKeepingSidebar, routeLinksSearchTrigger, SidebarRouteLinks, SiteLinksProvider, themeSwitchWithIdentity } from '@godcreator/docsite-ui'
import { siteIdentity } from '../lib/identity.server'
import { allPageThreads } from '../lib/comments.server'
import { sitePageRefs, source } from '../lib/source.server'
import { featureServers } from '../site/data.server'
import { featureSites } from '../site/ui'
import type { Route } from './+types/layout'

/** 各功能包的 layoutData 也在这里读：它们的数据每一页都要用（比如正文里引用任务）。评论链接的目标也在服务端算好带下来：客户端不许 import .server 模块 */
export async function loader() {
  const pages = sitePageRefs()
  const featureData: Record<string, unknown> = {}
  for (const { name, layoutData } of featureServers) featureData[name] = layoutData ? await layoutData({ pages }) : null
  const pageTitles = Object.fromEntries(pages.map((page) => [page.url, page.title]))
  return {
    pageTree: await source.serializePageTree(source.getPageTree()),
    identity: siteIdentity(),
    featureData,
    pageTitles,
    comments: commentLinkTargetsOf([...allPageThreads().values()].flat()),
  }
}

const routeLinkList = [...featureSites.flatMap((feature) => feature.routeLinks ?? []), { text: '评论', url: '/comments', icon: <MessageSquare /> }]
const routeLinks = <SidebarRouteLinks links={routeLinkList} />

export default function Layout({ loaderData }: Route.ComponentProps) {
  const { pageTree } = useFumadocsLoader(loaderData)
  const { identity, featureData, pageTitles, comments } = loaderData
  const themeSwitch = useMemo(() => themeSwitchWithIdentity(identity), [identity.person?.id, identity.reason])
  const siteLinks = useMemo(() => ({ pageTitles, routeLinks: routeLinkList, comments }), [pageTitles, comments])
  const docsLayout = (
    <SiteLinksProvider value={siteLinks}>
      <DocsLayout tree={pageTree} nav={{ title: pageTree.name }} sidebar={{ banner: routeLinks }} slots={{ themeSwitch, sidebar: groupKeepingSidebar, searchTrigger: routeLinksSearchTrigger }}>
        {featureSites.map(({ name, PageTop }) => PageTop && <PageTop key={name} />)}
        <Outlet />
      </DocsLayout>
    </SiteLinksProvider>
  )
  return featureSites.reduceRight<ReactNode>((children, { name, Provider }) => (Provider ? <Provider data={featureData[name]}>{children}</Provider> : children), docsLayout)
}
