import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { applyMdxPreset, defineDocs } from 'fumadocs-mdx/config'
import { remarkGlossary } from '@probe/writing/compile'
import { terms } from './content/glossary.terms'

/**
 * 集合用 Config API 命名导出，各自 mdxOptions + applyMdxPreset（集合级 mdxOptions 会替换默认工序，
 * 所以每个集合都完整配一遍）：集合 A（docs）启用术语插件，集合 B（notes）不启用。
 * 这个文件只在构建期由 Node 加载；生成的浏览器入口（.source/browser）只 type-import 这里的类型，
 * 编译插件与词表进不了客户端包。
 *
 * 插件顺序的两条约束：remarkMath 排在术语标注之前——先让 $…$、$$…$$ 变成 math 节点，标注才碰不到公式；
 * rehypeKatex 用函数形式拿到预设的完整列表后排到代码高亮（rehypeCode）之前。
 */
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    async: true,
    postprocess: { includeProcessedMarkdown: { output: 'function', headingIds: false } },
    mdxOptions: applyMdxPreset({
      remarkPlugins: [remarkMath, remarkGlossary({ terms })],
      rehypePlugins: (list) => [rehypeKatex, ...list],
    }),
  },
})

export const notes = defineDocs({
  dir: 'content/notes',
  docs: {
    async: true,
    postprocess: { includeProcessedMarkdown: { output: 'function', headingIds: false } },
    mdxOptions: applyMdxPreset({
      remarkPlugins: [remarkMath],
      rehypePlugins: (list) => [rehypeKatex, ...list],
    }),
  },
})
