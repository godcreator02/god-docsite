/**
 * gwb-collab 与站点之间的约定：推给站点的数据的名字与形状，以及站点收下时按形状逐项检查的 siteFeedOf。
 * 名字与形状任何一项变了，siteProtocol 加一
 */
import type { ProjectLeads } from '../project-model/project-leads.js'
import type { Notification } from './notifications.js'
import { checkedNotificationsOf } from './notification-validation.js'
import { fieldsOf, textsOf } from './shape-checks.js'

export { InvalidSiteFeed } from './shape-checks.js'

/*
 * 站点由 gwb-docsite 托管：gwb-collab 经它的服务 gwbDocsite.push 把整份 SiteFeed 推到站点推送通道的这个频道，
 * 每当通知或项目负责人变了就再推一次。站点只收不发：不向插件发任何请求，网站自己不跑 git
 */
export const siteFeedChannel = 'collab'

/**
 * 插件与站点之间的协议号：推给站点的数据的名字与形状一变就加一；记录格式有破坏性改动时也加一，
 * 免得没升插件的人打开升过级的站点，只看到「记录读不对」。
 * 功能包 package.json 的 collabSiteProtocol 写同一个数；gwb-collab 拿它比 site/ 里装的那一版，对不上就不托管这个站点
 */
export const siteProtocol = 8

/** 带这个协议号的第一版功能包：协议号对不上时，报错里让人把 site/ 的功能包升到这条线 */
export const siteProtocolSince = '0.30.0'

/**
 * gwb-collab 交给站点的全部数据，一起交、一起推给页面。
 * notifications 已按 sortedNotifications 排好；projectLeads 是上次检查从 Gitea 读的，这次加载后还没读到为 null
 */
export type SiteFeed = { notifications: Notification[]; projectLeads: ProjectLeads | null }

/** 推来的数据是外部输入：按 SiteFeed 的形状逐项查，不对、多了、少了字段就抛 InvalidSiteFeed，写明哪一项 */
export function siteFeedOf(body: unknown): SiteFeed {
  const feed = fieldsOf(body, '推来的数据', ['notifications', 'projectLeads'])
  return {
    notifications: checkedNotificationsOf(feed['notifications']),
    projectLeads: feed['projectLeads'] === null ? null : textsOf(feed['projectLeads'], 'projectLeads'),
  }
}
