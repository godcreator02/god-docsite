import { publicPeopleOf, type PublicPerson } from '@godcreator/identity'
import { sitePeople } from '@godcreator/identity/node'
import type { CollabSite } from '../collab-site.js'
import type { CollabViewer } from '../page-data.js'

/** 交给浏览器的人员列表：经 publicPeopleOf 投影，身份码不出服务端 */
export function publicSitePeopleOf(site: CollabSite): PublicPerson[] {
  return publicPeopleOf(sitePeople(site.siteDir))
}

/** 本机身份的人员 id；只读时为 null */
export function viewerIdOf(site: CollabSite): string | null {
  return site.identity().person?.id ?? null
}

export function viewerOf(site: CollabSite): CollabViewer {
  return { people: publicSitePeopleOf(site), person: viewerIdOf(site), projectLeads: site.feed()?.projectLeads ?? null }
}
