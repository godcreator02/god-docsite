/**
 * 站侧的全部接线都在这一个文件：六区六个集合，外加全局的 mdxOptions（格式包给——remark 链
 * 尾巴挂插件，meta 白名单放行 title / lineNumbers / data-dot，术语标注也挂在这儿）。
 *
 * 六区各一个 defineDocs（自带 docs + meta 双集合，meta.json 的侧栏排序天然支持）：
 *   docs        现状：只有现状、散文、尽量多钉；进 check
 *   trajectory  轨迹：卡只增不改；卡的 frontmatter 由 cardSchema 认（label 派生 title），
 *               正文里 `supersedes::` / `pivots-from::` 关系边由 remarkTrajectoryLinks 打标；不进 check
 *   spec        交接：在途 spec 与实施方案，做完拆解归梁删页
 *   future      未来：愿景 + not-doing + roadmap，常改
 *   outputs     生成正本：readme 等，render 摆到仓根；进 check
 *   feedback    反馈：hatch（本仓候选）+ inbound（别的仓投来的）
 * 只有 docs 与 outputs 开 processed markdown——命令行按名字找集合只对进 check 的两区有意义
 * （集合名 = 文档目录的最后一截，格式包的 collectionOf 靠这条约定给 `?collection=`）。
 * 集合定义在这里而不是 src/lib/source.ts 里，是为了让命令行也能按名字找到它：
 * fumadocs 的 Node loader 只认 source.config 里的集合。
 */
import { applyMdxPreset, defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { livedocMdxOptions, livedocMarkdownOptions } from '@godcreator02/livedoc/fumadocs';
import { cardSchema, remarkTrajectoryLinks } from '@godcreator02/livedoc-trajectory/server';
import { terms } from './src/glossary';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    postprocess: { includeProcessedMarkdown: livedocMarkdownOptions() },
  },
});

// 轨迹卡集合：目录是站自己的 content/trajectory/，跟文档集合平级、各走各的 schema，
// 落 /trajectory/<卡身份>。盘上星星寥寥是正常态——本仓自己的卡由人写，这里不生成。
// 集合级 mdxOptions 会把默认插件全去掉（fumadocs-mdx 的文档原话），所以用 applyMdxPreset
// 把默认 preset（标题 id、gfm……）加回来，再挂 remarkTrajectoryLinks——livedoc 自己的
// remarkLivedocHost（挂在下面 defineConfig 的全局 mdxOptions 里）不会跑到这个集合上，
// 卡正文冻结历史、不钉活代码。
export const trajectory = defineDocs({
  dir: 'content/trajectory',
  docs: {
    // cardSchema 是手写的最小实现：对象字面量，不 new 任何校验库的类，只从
    // @standard-schema/spec 借一份类型声明保结构精确（devDependency，编译期擦光）；
    // 结构对上了不用 cast，defineDocs 能顺着推出 CardFrontmatter
    schema: cardSchema,
    mdxOptions: applyMdxPreset({
      remarkPlugins: (v) => [...v, [remarkTrajectoryLinks, { hrefBase: '/trajectory' }]],
    }),
  },
});

export const spec = defineDocs({
  dir: 'content/spec',
});

export const future = defineDocs({
  dir: 'content/future',
});

export const outputs = defineDocs({
  dir: 'content/outputs',
  docs: {
    postprocess: { includeProcessedMarkdown: livedocMarkdownOptions() },
  },
});

export const feedback = defineDocs({
  dir: 'content/feedback',
});

export default defineConfig({
  // 类型要求完整 options（含 themes），运行时会 merge 默认值——cast 只在这一处
  // glossary：正文里命中术语表的词自动包成 <Term>。术语页规范那篇是人写的规范文本，
  // 里头的词按字面读，别在它上面标注——skipFile 把它挑出去
  mdxOptions: livedocMdxOptions({
    root: process.cwd(),
    glossary: { terms, skipFile: (path) => path.endsWith('human-write-spec-dont-change.mdx') },
  }) as never,
});
