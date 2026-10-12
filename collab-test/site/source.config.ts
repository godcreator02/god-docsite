import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { applyMdxPreset, defineCollections, defineDocs } from 'fumadocs-mdx/config'
import { remarkGlossary } from '@godcreator/docsite-writing/compile'
import { terms } from './glossary.terms'

/**
 * 集合用 Config API 定义（只在构建期由 Node 加载，浏览器不解析这个文件）：
 * - docs：内容页集合，async 让正文按需加载（loader 只取路径，浏览器经 .source/browser 的
 *   createClientLoader 取正文）；术语插件与公式只加在这一集合——评论集合不加，编译更快
 * - comments：评论集合，一个评论串一个文件夹（index.mdx 串头 + 回复 mdx + 同目录 tsx/图片附件），
 *   与页面同一编译链；frontmatter 不写 schema，形状由评论包的模型校验（threadsForPage）
 *
 * 插件顺序：remarkMath 在术语标注之前（先让 $…$ 变 math 节点，标注碰不到公式）；
 * rehypeKatex 用函数形式拿到预设完整列表后排到代码高亮之前
 */
export const docs = defineDocs({
  dir: 'content',
  docs: {
    async: true,
    postprocess: { includeProcessedMarkdown: { output: 'function', headingIds: false } },
    mdxOptions: applyMdxPreset({
      remarkPlugins: [remarkMath, remarkGlossary({ terms })],
      rehypePlugins: (list) => [rehypeKatex, ...list],
    }),
  },
})

export const comments = defineCollections({
  type: 'doc',
  dir: 'comments',
  async: true,
})
