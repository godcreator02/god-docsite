import type { Route } from './+types/home'
import { useLoaderData } from 'react-router'
import { siteHomeData } from '@godcreator/god-docsite/server'
import { SiteHomeLayout } from '@godcreator/god-docsite/react'
import { ProjectHome } from '@godcreator/collab/site'
import { projectHomeLoader } from '@godcreator/collab/site/server'
import { site } from '@/lib/site.server'
import { collabSite } from '@/features/collab/site.server'
import { featureRuntime } from '@/features/runtime.generated'

// 协作站的首页：collab.site.init 建站时照 @godcreator/collab 的 templates/home.tsx 写出，之后归站点自己改

export async function loader(args: Route.LoaderArgs) {
  return { home: siteHomeData(site), project: await projectHomeLoader(args, collabSite()) }
}

export default function Home() {
  const { home, project } = useLoaderData<typeof loader>()
  return (
    <SiteHomeLayout data={home} sidebarLinks={featureRuntime.sidebarLinks}>
      <title>{home.siteName}</title>
      <ProjectHome siteName={home.siteName} docsUrl={home.docsUrl} data={project} />
    </SiteHomeLayout>
  )
}
