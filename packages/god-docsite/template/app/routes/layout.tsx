import { Outlet, useLoaderData } from 'react-router'
import { siteLayoutData } from '@godcreator/god-docsite/server'
import { SiteLayout } from '@godcreator/god-docsite/react'
import { publicPeopleOf } from '@godcreator/identity'
import { IdentityBadge, IdentityProvider } from '@godcreator/identity/site'
import { site } from '@/lib/site.server'

export async function loader() {
  return { ...(await siteLayoutData(site)), identity: site.identity(), people: publicPeopleOf(site.people()) }
}

export default function Layout() {
  const data = useLoaderData<typeof loader>()
  return (
    <IdentityProvider identity={data.identity} people={data.people}>
      <SiteLayout data={data} sidebarFooterStart={<IdentityBadge identity={data.identity} />}>
        <Outlet />
      </SiteLayout>
    </IdentityProvider>
  )
}
