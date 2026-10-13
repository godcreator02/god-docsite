import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { applyMdxPreset, defineCollections, defineConfig, defineDocs } from 'fumadocs-mdx/config'
import { remarkGlossary } from '@godcreator/docsite-writing/compile'
import { terms } from './glossary.terms'

/**
 * 全局 mdxOptions 管集合外文件的编译（页面 mdx import 进来的正文，如系统设计报告的 _report.mdx）：
 * 公式插件与 docs 集合保持一致，否则 $…$ 里的 { 被当 MDX 表达式，acorn 报错。
 * 全局选项的类型不接受带参函数，插件直接给数组
 */
export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
})

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
    // 只收文件名不以下划线开头的 .mdx：下划线开头的是被页面 import 的正文（不是独立页面），
    // 资料性 .md 也不是页面，都不进集合、不校验 frontmatter。
    // 模式要同时过两套匹配器：fumadocs-mdx 构建期用 picomatch，vite 的 import.meta.glob 用
    // tinyglobby 且 extglob 关着——实测 [^_] 字符类两边语义一致，extglob !(…) 与数组否定都不可用
    files: ['**/[^_]*.mdx'],
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
