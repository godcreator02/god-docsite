import type { Route } from './+types/layout'
import { Outlet, useLoaderData } from 'react-router'
import { siteLayoutData, withContentDigestId, withFeatureLayoutData } from '@godcreator/god-docsite/server'
import { SiteLayout } from '@godcreator/god-docsite/react'
import { publicPeopleWithAvatars } from '@godcreator/identity/node'
import { IdentityBadge, IdentityProvider } from '@godcreator/identity/site'
import { site } from '@/lib/site.server'
import { source } from '@/lib/source'
import { featureRuntime } from '@/features/runtime.generated'
import { scanSite, siteSections } from '@/probe-platform/site-sections.server'
import { sectionFolder, sectionPageTitles } from '@/probe-platform/sections'

/**
 * 原型：模板布局 loader 多做一步，引用扫描一次、各功能的分区并进页面树（root 文件夹）、分区条目并进站内地址到标题
 */
export async function loader(args: Route.LoaderArgs) {
  const sections = siteSections(scanSite())
  const tree = source.getPageTree()
  const treeWithSections = { ...tree, children: [...tree.children, ...sections.map(sectionFolder)] }
  const platform = await siteLayoutData(site, featureRuntime.sidebarLinks)
  const siteData = {
    ...platform,
    pageTree: withContentDigestId(await source.serializePageTree(treeWithSections)),
    pageTitles: { ...platform.pageTitles, ...sectionPageTitles(sections) },
    identity: site.identity(),
    people: publicPeopleWithAvatars(site.dir, site.people()),
  }
  return withFeatureLayoutData(siteData, { loaders: featureRuntime.layoutData, args, base: site })
}

const featureLayoutTops = featureRuntime.layoutTops.map(({ feature, Component }) => <Component key={feature} />)

export default function Layout() {
  const data = useLoaderData<typeof loader>()
  return (
    <IdentityProvider identity={data.identity} people={data.people}>
      <SiteLayout data={data} sidebarLinks={featureRuntime.sidebarLinks} top={featureLayoutTops} sidebarFooterStart={<IdentityBadge identity={data.identity} />}>
        <Outlet />
      </SiteLayout>
    </IdentityProvider>
  )
}
