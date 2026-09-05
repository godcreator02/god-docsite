/**
 * 站侧的全部接线都在这一个文件：
 *   mdxOptions       格式包给——remark 链尾巴挂插件，meta 白名单放行 title / lineNumbers / data-dot
 *   docs 集合        postprocess 打开 processed markdown，序列化回调也是格式包给的：
 *                    fumadocs 序列化时认我们在树上打的标（引用的来源行、组件的压平结果）
 * 集合定义在这里而不是 src/lib/source.ts 里，是为了让命令行也能按名字找到它：
 * fumadocs 的 Node loader 只认 source.config 里的集合（import 时带 ?collection=docs）。
 */
import { applyMdxPreset, defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { livedocMdxOptions, livedocMarkdownOptions } from '@godcreator02/live-doc-format-fumadocs';
import { cardSchema, remarkTrajectoryLinks } from '@godcreator02/live-doc-trajectory/server';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    postprocess: { includeProcessedMarkdown: livedocMarkdownOptions() },
  },
});

// 轨迹卡集合：目录在单元根 docs-god-flow/trajectory/（相对本站目录两级），单开一个集合与
// loader（src/lib/trajectory-source.ts），落 /trajectory/<卡身份>。卡目录现在不存在、盘空着
// 是正常态——本仓自己的卡由人写，这里不生成。
// 集合级 mdxOptions 会把默认插件全去掉（fumadocs-mdx 的文档原话），所以用 applyMdxPreset
// 把默认 preset（标题 id、gfm……）加回来，再挂 remarkTrajectoryLinks——livedoc 自己的
// remarkLivedocHost（挂在上面 defineConfig 的全局 mdxOptions 里）不会跑到这个集合上，
// 卡正文冻结历史、不钉活代码。
export const trajectory = defineDocs({
  dir: '../../docs-god-flow/trajectory',
  docs: {
    // cardSchema 是结构对得上 StandardSchemaV1 协议、手写的最小实现，不从 @standard-schema/spec
    // 引类型；结构对上了不用 cast，defineDocs 能顺着推出 CardFrontmatter
    schema: cardSchema,
    mdxOptions: applyMdxPreset({
      remarkPlugins: (v) => [...v, [remarkTrajectoryLinks, { hrefBase: '/trajectory' }]],
    }),
  },
});

export default defineConfig({
  // 类型要求完整 options（含 themes），运行时会 merge 默认值——cast 只在这一处
  mdxOptions: livedocMdxOptions({ root: process.cwd() }) as never,
});
