/**
 * 站侧的全部接线都在这一个文件：三区三个集合，外加全局的 mdxOptions（格式包给——remark 链
 * 末尾挂插件，meta 白名单放行 title / lineNumbers / data-dot，术语标注也挂在这儿）。
 *
 * 三区各一个 defineDocs（自带 docs + meta 两个集合，meta.json 的侧栏排序直接可用）：
 *   docs        现状：只有现状、散文、尽量多钉；进 check。生成正本（README、AGENTS、SKILL.md 的 mdx）也在这一区
 *   trajectory  轨迹：卡只增不改；卡的 frontmatter 由 cardSchema 认（label 派生 title），
 *               正文里 `supersedes::` / `pivots-from::` 关系由 remarkTrajectoryLinks 标出；不进 check
 *   future      未来：愿景、不做的事、roadmap、在途的 spec、别的仓投来的反馈
 * 只有 docs 开 processed markdown：站上每页的机读版从这儿出。
 */
import { applyMdxPreset, defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { docfirstMdxOptions, docfirstMarkdownOptions } from '@godcreator/docfirst-workflow/fumadocs';
import { cardSchema, remarkTrajectoryLinks } from '@godcreator/docfirst-trajectory/server';
import { terms } from './src/glossary';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    postprocess: { includeProcessedMarkdown: docfirstMarkdownOptions() },
  },
});

// 轨迹卡集合：目录是站自己的 content/trajectory/，跟文档集合平级、各走各的 schema，
// 页面在 /trajectory/<卡身份>。本仓自己的卡由人写，这里不生成。
// 集合级 mdxOptions 会把默认插件全去掉（fumadocs-mdx 的文档原话），所以用 applyMdxPreset
// 把默认 preset（标题 id、gfm……）加回来，再挂 remarkTrajectoryLinks——docfirst 自己的
// remarkDocfirstHost（挂在下面 defineConfig 的全局 mdxOptions 里）不会跑到这个集合上，
// 卡正文是冻结的历史，不钉代码。
export const trajectory = defineDocs({
  dir: 'content/trajectory',
  docs: {
    // cardSchema 是手写的最小实现：对象字面量，不 new 任何校验库的类，只从
    // @standard-schema/spec 借一份类型声明保持结构精确（devDependency，编译后不留）；
    // 结构对上了不用 cast，defineDocs 能顺着推出 CardFrontmatter
    schema: cardSchema,
    mdxOptions: applyMdxPreset({
      remarkPlugins: (v) => [...v, [remarkTrajectoryLinks, { hrefBase: '/trajectory' }]],
    }),
  },
});

export const future = defineDocs({
  dir: 'content/future',
});

export default defineConfig({
  // 类型要求完整 options（含 themes），运行时会合并默认值——cast 只在这一处
  // glossary：正文里命中术语表的词自动包成 <Term>。术语页规范那篇是人写的规范文本，
  // 里头的词按字面读，别在它上面标注——skipFile 把它排除
  mdxOptions: docfirstMdxOptions({
    root: process.cwd(),
    glossary: { terms, skipFile: (path) => path.endsWith('human-write-spec-dont-change.mdx') },
  }) as never,
});
