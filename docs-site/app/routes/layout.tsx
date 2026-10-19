import type { Route } from './+types/layout'
import { Outlet, useLoaderData } from 'react-router'
import { featurePageTreeNodes, siteLayoutData, withFeatureLayoutData } from '@godcreator/god-docsite/server'
import { SiteLayout } from '@godcreator/god-docsite/react'
import { publicPeopleWithAvatars } from '@godcreator/identity/node'
import { IdentityBadge, IdentityProvider } from '@godcreator/identity/site'
import { site } from '@/lib/site.server'
import { featureLayoutServer } from '@/features/layout.generated.server'
import { featureRuntime } from '@/features/runtime.generated'

/**
 * 布局数据：平台的页面树（末尾接上各功能 layout.server.ts 这次请求给的节点）、站名与站内地址到标题（含各功能的侧栏入口）、本机身份与公开的人员（有头像文件的带头像地址），
 * 再并上各功能 layoutData 的结果（键是功能名）。
 * 外部契约：这个路由的 id 固定为 routes/layout（app/routes.ts 里写明），功能的 LayoutTop 用 useRouteLoaderData('routes/layout') 取自己那份
 */
export async function loader(args: Route.LoaderArgs) {
  const featureNodes = await featurePageTreeNodes(featureLayoutServer, args, site)
  const siteData = { ...(await siteLayoutData(site, featureRuntime.sidebarLinks, featureNodes)), identity: site.identity(), people: publicPeopleWithAvatars(site.dir, site.people()) }
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
