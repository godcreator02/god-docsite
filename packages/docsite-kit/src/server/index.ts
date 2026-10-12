import { feedStore } from '../site-feed.js'

/** 推送通道里某个频道最新的一份（路由的 loader、action 用）；还没推过、不是经 gwb-docsite 启动的开发服务时是 undefined */
export function siteFeedOf<Data>(channel: string): Data | undefined {
  return feedStore().get(channel) as Data | undefined
}
