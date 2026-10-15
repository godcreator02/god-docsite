import { publicPeopleOf } from '@godcreator/identity'
import type { CollabRouteArgs, CollabSite } from './collab-site.js'
import type { CollabLayoutData } from './page-data.js'

/** 布局数据只用到站点信息的这三项：都是函数，不读文件，所以这个模块浏览器侧也能 import */
export type CollabLayoutSite = Pick<CollabSite, 'people' | 'identity' | 'feed'>

/** 整站布局的 loader 调用：只给公开人员、本机身份与推送来的通知，不读 collab/；任务全集只在任务页、日历页读 */
export function collabLayoutData(_args: CollabRouteArgs, site: CollabLayoutSite): CollabLayoutData {
  return { people: publicPeopleOf(site.people()), person: site.identity().person?.id ?? null, notifications: site.feed()?.notifications ?? null }
}
