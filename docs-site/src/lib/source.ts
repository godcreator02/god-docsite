/**
 * 站的内容集合与 loader。集合用 fumadocs-mdx 的 macro 写在这里，三个区各一个 defineDocs
 * （自带 docs 与 meta，侧栏顺序由各目录的 meta.json 定）：
 *   docs        现状：只有现状、散文、尽量多钉；参与 check。生成正本（README、AGENTS、SKILL.md 的 mdx）也在这一区，
 *               术语标注只在这个集合上开启
 *   trajectory  轨迹：卡只增不改；卡的 frontmatter 由 cardSchema 校验（label 派生 title），
 *               正文里 `supersedes::` / `pivots-from::` 关系由 remarkTrajectoryLinks 标出；不参与 check，不加 docfirst 的 remark 插件
 *   future      未来：愿景、不做的事、roadmap、还在进行的 spec、别的仓投来的反馈
 *
 * 集合级 mdxOptions 会去掉 fumadocs 的全部默认插件，所以写了 mdxOptions 的集合都经 applyMdxPreset 把默认插件加回来。
 * 只有现状区开 processed markdown：站上各页的机读版与 llms 路由都由它生成。
 * source 与 docsLlms 两个导出名是官方的搜索与 llms 路由在用的，别改名。
 */
import { llms, loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { applyMdxPreset } from 'fumadocs-mdx/config';
import { defineDocs } from 'fumadocs-mdx/macro';
import { cardSchema, docfirstMarkdownOptions, docfirstMdxOptions, remarkTrajectoryLinks } from '@godcreator/docfirst-fumadocs';
import { terms } from '../glossary';
import { docsRoute } from './shared';

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    // glossary：正文里命中术语表的词自动包成 <Term>。术语页规范那篇是人写的规范文本，
    // 里头的词按字面读，别在它上面标注——skipFile 把它排除
    mdxOptions: applyMdxPreset(
      docfirstMdxOptions({
        root: process.cwd(),
        glossary: { terms, skipFile: (path) => path.endsWith('human-write-spec-dont-change.mdx') },
      }),
    ),
    postprocess: {
      includeProcessedMarkdown: docfirstMarkdownOptions(),
    },
  },
  meta: {
    schema: metaSchema,
  },
});

const trajectory = defineDocs({
  dir: 'content/trajectory',
  docs: {
    schema: cardSchema,
    mdxOptions: applyMdxPreset({
      remarkPlugins: (v) => [...v, [remarkTrajectoryLinks, { hrefBase: '/trajectory' }]],
    }),
  },
});

const future = defineDocs({
  dir: 'content/future',
});

export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

export const sourceTrajectory = loader({
  baseUrl: '/trajectory',
  source: trajectory.toFumadocsSource(),
});

export const sourceFuture = loader({
  baseUrl: '/future',
  source: future.toFumadocsSource(),
});

export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${page.url})

${await page.data.getText('processed')}`,
});
