import { publicPeopleWithAvatars } from '@godcreator/identity/node'
import type { CollabSite } from '../collab-site.js'
import type { CollabViewer } from '../page-data.js'

/** 交给浏览器的人员列表经 publicPeopleWithAvatars 投影，身份码不出服务端、有头像文件的带头像地址；person 是本机身份的人员 id，只读时为 null */
export function viewerOf(site: CollabSite): CollabViewer {
  return { people: publicPeopleWithAvatars(site.siteDir, site.people()), person: site.identity().person?.id ?? null, projectLeads: site.feed()?.projectLeads ?? null }
}