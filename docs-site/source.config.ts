import { applyMdxPreset, defineCollections, defineDocs } from 'fumadocs-mdx/config'
import { featureContents } from './app/site/content.ts'

/**
 * 集合用 Config API 定义（只在构建期由 Node 加载，浏览器不解析这个文件）：
 * - docs：内容页集合，async 让正文按需加载；功能包 ./content 给的 remark 插件（docfirst 的钉码投影、
 *   术语标注、轨迹卡链接改写）接在默认的后面——content/ 下的页面按这个集合过它们
 * - comments：评论集合，一个评论串一个文件夹，与页面同一编译链；frontmatter 不写 schema，形状由评论包的模型校验
 * - trajectory：轨迹卡集合（docfirst-site 模板复制件里的定义在 app/lib/trajectory.ts：fumadocs-mdx 跳过
 *   node_modules，集合定义必须写在项目里），它自己挂功能包的 remark（卡里的链接要改写）
 *
 * 自述站（骨架的正本）的这份配置挂的是术语与公式；docfirst 站的术语走功能包自己的 remark 链，不挂那两样
 */
export const docs = defineDocs({
  dir: 'content',
  docs: {
    async: true,
    postprocess: { includeProcessedMarkdown: { output: 'function', headingIds: false } },
    mdxOptions: applyMdxPreset({
      remarkPlugins: (defaults) => [...defaults, ...featureContents.flatMap((feature) => feature.remarkPlugins ?? [])],
    }),
  },
})

export const comments = defineCollections({
  type: 'doc',
  dir: 'comments',
  async: true,
})
