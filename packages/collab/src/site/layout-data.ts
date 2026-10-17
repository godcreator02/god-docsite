import { publicPeopleOf } from '@godcreator/identity'
import type { SubmitState } from '../core/notifications/submit-state.js'
import type { CollabRouteArgs, CollabSite } from './collab-site.js'
import type { CollabLayoutData } from './page-data.js'

/**
 * 布局数据只用到站点信息的这几项：都是函数，不读文件，所以这个模块浏览器侧也能 import。
 * submitState 是频道 collab-submit 现在的状态，站点接了一键提交才给
 */
export type CollabLayoutSite = Pick<CollabSite, 'people' | 'identity' | 'feed'> & { submitState?: () => SubmitState }

/** 整站布局的 loader 调用：只给公开人员、本机身份、推送来的通知和提示词与一键提交的状态，不读 collab/；任务全集只在任务页、日历页读 */
export function collabLayoutData(_args: CollabRouteArgs, site: CollabLayoutSite): CollabLayoutData {
  const feed = site.feed()
  return {
    people: publicPeopleOf(site.people()),
    person: site.identity().person?.id ?? null,
    notifications: feed?.notifications ?? null,
    aiPrompt: feed?.aiPrompt ?? null,
    ...(site.submitState !== undefined ? { submit: site.submitState() } : {}),
  }
}
