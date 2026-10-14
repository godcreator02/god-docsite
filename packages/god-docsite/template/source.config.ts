import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { applyMdxPreset, defineCollections, defineConfig, defineDocs } from 'fumadocs-mdx/config'
import { remarkGlossary } from '@godcreator/god-docsite/mdx'

// 全局的 mdxOptions 只管集合外被 import 的 mdx；集合写了自己的 mdxOptions，全局的对它就不生效，全站插件要在集合里再列一次
export default defineConfig({
  mdxOptions: { remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] },
})

// remark-math 排在术语标注前面：先让 $…$ 变成公式节点，标注才碰不到公式。功能包的 remark 插件加在这一列里
const pageRemarkPlugins = [remarkMath, remarkGlossary({ file: 'glossary.json' })]

export const docs = defineDocs({
  dir: 'content',
  docs: {
    async: true,
    // 下划线开头的 .mdx 是被页面 import 的正文，不是独立页面
    files: ['**/[^_]*.mdx'],
    postprocess: { includeProcessedMarkdown: true },
    mdxOptions: applyMdxPreset({
      remarkPlugins: pageRemarkPlugins,
      rehypePlugins: (list) => [rehypeKatex, ...list],
    }),
  },
})

// 评论：一串一个文件夹（index.mdx 是串头，回复各一个 mdx），frontmatter 由评论包校验
export const comments = defineCollections({
  type: 'doc',
  dir: 'comments',
  async: true,
})
