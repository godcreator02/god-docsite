import { defineCollections } from 'fumadocs-mdx/macro'

/** 日志页：journal/<日期>.mdx，一天一篇，正文按需加载。集合定义只能写在项目里，功能包里的路由模块经 @site/lib/journal 读它 */
export const journal = defineCollections({ type: 'doc', dir: 'journal', async: true })
