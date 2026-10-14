import { defineCollections } from 'fumadocs-mdx/macro'

// 与协作站同形：journal/<日期>.mdx，macro 写法，正文按需加载
export const journal = defineCollections({ type: 'doc', dir: 'journal', async: true })
