import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { defineConfig } from 'fumadocs-mdx/config'
import { featureContents } from './app/site/content.ts'

/**
 * fumadocs-mdx 的全局设置，只在构建页面时在 Node 里执行。功能包 ./content 给的 remark 插件接在默认的后面，content/ 与 comments/ 的 MDX 都经过它们。
 * 不能挪进 collections.ts：那个文件浏览器端也用（原因见自述站「功能包」页）。
 * 公式照 fumadocs 的做法：remark-math 认出 $…$、$$…$$，rehype-katex 排在代码高亮前面，写错的公式直接报错
 */
export default defineConfig({
  mdxOptions: {
    remarkPlugins: (defaults) => [...defaults, remarkMath, ...featureContents.flatMap((feature) => feature.remarkPlugins ?? [])],
    rehypePlugins: (defaults) => [[rehypeKatex, { throwOnError: true }], ...defaults],
  },
})
