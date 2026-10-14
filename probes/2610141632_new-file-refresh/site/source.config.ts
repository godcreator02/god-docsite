import { defineCollections, defineConfig, defineDocs } from 'fumadocs-mdx/config'

// 与 docsite-kit 骨架同形：正文与评论走 Config API（.source/server 与 .source/browser），日志走 macro（app/lib/journal.ts）
export default defineConfig({})

export const docs = defineDocs({
  dir: 'content/docs',
  docs: { async: true },
})

export const comments = defineCollections({
  type: 'doc',
  dir: 'comments',
  async: true,
})
