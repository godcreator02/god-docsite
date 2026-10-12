/**
 * 推送通道的开发服务一侧存储：协议件（频道、事件名、类型）在 @godcreator/docsite-ui 的 feed-protocol，
 * 浏览器 hook 也在那个包；服务端取数用 ./server 出口的 siteFeedOf
 */



/** 推来的数据存在进程里：开发服务插件（Node 直接加载）与路由的 loader（经 Vite 的模块运行器加载）是两份模块，只有 globalThis 是同一个 */
const storeKey = Symbol.for('@godcreator/docsite-kit/site-feeds')

export function feedStore(): Map<string, unknown> {
  const holder = globalThis as { [storeKey]?: Map<string, unknown> }
  holder[storeKey] ??= new Map()
  return holder[storeKey]
}
