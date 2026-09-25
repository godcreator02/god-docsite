/**
 * 站的内容集合，一个目录一个 defineDocs（自带 docs + meta 两个集合，侧栏顺序由各目录的 meta.json 定）：
 *   docs        现状区，进 check；生成正本在 content/docs/outputs/ 下
 *   trajectory  轨迹卡，只增不改；frontmatter 由 cardSchema 认，正文里的关系边由 remarkTrajectoryLinks 标出
 *   future      未来区：还没发生的事
 * 现状区开 processed markdown：命令行按集合名（目录最后一段）取各页的机读版。
 * 集合必须定义在这里：fumadocs 的 Node loader 只认 source.config 里的集合，命令行要按名字找到它们。
 * 在 content/ 下新建现状区目录时，在这里加一个同名集合，在 src/lib/source.ts、src/app/layout.tsx 与
 * src/app/<目录>/[[...slug]]/page.tsx 各加对应的一处。
 */
import { applyMdxPreset, defineConfig, defineDocs } from 'fumadocs-mdx/config'
import { docfirstMdxOptions, docfirstMarkdownOptions } from '@godcreator/docfirst-workflow/fumadocs'
import { cardSchema, remarkTrajectoryLinks } from '@godcreator/docfirst-trajectory/server'

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    postprocess: { includeProcessedMarkdown: docfirstMarkdownOptions() },
  },
})

// 集合级 mdxOptions 会去掉全部默认插件（fumadocs-mdx 的文档原话），所以用 applyMdxPreset 把默认
// preset（标题 id、gfm 等）加回来，再加 remarkTrajectoryLinks；全局的 docfirst 插件不作用于这个集合
export const trajectory = defineDocs({
  dir: 'content/trajectory',
  docs: {
    schema: cardSchema,
    mdxOptions: applyMdxPreset({
      remarkPlugins: (v) => [...v, [remarkTrajectoryLinks, { hrefBase: '/trajectory' }]],
    }),
  },
})

export const future = defineDocs({
  dir: 'content/future',
})

export default defineConfig({
  // 类型要求完整 options（含 themes），运行时会合并默认值，cast 只在这一处
  mdxOptions: docfirstMdxOptions({ root: process.cwd() }) as never,
})
