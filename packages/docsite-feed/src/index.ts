/**
 * 推送通道（能力小包）：gwb 插件往跑着的开发服务按频道推数据，只留最新一份。
 * 三面都在这里——协议（feed-protocol）、进程内存储（feed-store）、开发服务的收发端点（feed-dev-server）、
 * 浏览器 hook（use-site-feed）。组合包的 vite 插件接 feedDevServer，站点 loader 直接调 feedStore
 */
export { feedEndpointPrefix, feedEvent, feedTokenEnvName, feedTokenHeader, isFeedChannel, type FeedMessage } from './feed-protocol.js'
export { feedStore } from './feed-store.js'
export { feedDevServer } from './feed-dev-server.js'
export { useSiteFeed } from './use-site-feed.js'
