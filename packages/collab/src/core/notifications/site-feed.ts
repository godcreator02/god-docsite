/**
 * gwb-collab 与站点之间的约定：推给站点的数据的名字与形状，以及站点收下时按形状逐项检查的 siteFeedOf。
 * 插件与功能包同仓发版，版本对齐由发版顺序保证
 */
import type { ProjectLeads } from '../leads.js'
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

/** 推送通道里这个频道现在的值（还没推过是 undefined）按 siteFeedOf 查过；还没推过为 null */
export function pushedSiteFeedOf(pushed: unknown): SiteFeed | null {
  return pushed === undefined ? null : siteFeedOf(pushed)
}
