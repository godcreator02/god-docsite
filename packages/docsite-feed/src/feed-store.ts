/** 推来的数据存在进程里：开发服务插件（Node 直接加载）与路由的 loader（经 Vite 的模块运行器加载）是两份模块，只有 globalThis 是同一个 */
const storeKey = Symbol.for('@godcreator/docsite-kit/site-feeds')

export function feedStore(): Map<string, unknown> {
  const holder = globalThis as { [storeKey]?: Map<string, unknown> }
  holder[storeKey] ??= new Map()
  return holder[storeKey]
}
