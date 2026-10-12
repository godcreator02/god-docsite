import type { TermEntry } from '@godcreator/docsite-writing/compile'

/** 站点自己的术语表正本：source.config.ts（Node-only）读它建索引，浏览器端不加载。改这里即时生效 */
export const terms: TermEntry[] = [
  { term: '功能包', def: '接在站点骨架上的扩展包：带路由、正文组件或 remark 插件。' },
  { term: '身份码', def: '一台机器一个的码，gwb 插件启动开发服务时放进环境变量，按它在 people.json 里认人。' },
]
