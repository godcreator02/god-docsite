import { publicPeopleOf } from '@godcreator/identity'
import type { CollabSite } from '../collab-site.js'
import type { CollabViewer } from '../page-data.js'

/** 交给浏览器的人员列表经 publicPeopleOf 投影，身份码不出服务端；person 是本机身份的人员 id，只读时为 null */
export function viewerOf(site: CollabSite): CollabViewer {
  return { people: publicPeopleOf(site.people()), person: site.identity().person?.id ?? null, projectLeads: site.feed()?.projectLeads ?? null }
}
