/**
 * 站的内容集合与 loader。集合用 fumadocs-mdx 的 macro 写在这里，每个区一个 defineDocs
 * （自带 docs 与 meta，侧栏顺序由各目录的 meta.json 定）：
 *   docs         现状区·总览：系统组成、术语表、回归测试；生成正本在 content/docs/outputs/ 下
 *   collab-model 现状区·数据模型包 @godcreator/collab-model
 *   collab-site  现状区·功能包 @godcreator/collab-site
 *   collab-merge-check 现状区·合并检查包 @godcreator/collab-merge-check
 *   gwb-collab   现状区·插件 @godcreator/gwb-collab
 *   gitea        现状区·Gitea 与 NAS：组织与权限、执行器、实时推送、建项目，在 Gitea 上配、不属于哪个包的部分
 *   cases       现状区·使用案例：跨包的流程
 *   trajectory   轨迹卡，只增不改；frontmatter 由 cardSchema 认，正文里的关系边由 remarkTrajectoryLinks 标出
 *   future       未来区：还没发生的事
 *
 * 集合级 mdxOptions 会去掉 fumadocs 的全部默认插件，所以写了 mdxOptions 的集合都经 applyMdxPreset 把默认插件加回来。
 * 只有现状区开 processed markdown：站上各页的机读版与 llms 路由从这儿出。
 * source 与 docsLlms 两个导出名是官方的搜索与 llms 路由在用的，别改名。
 * 现状区的分区表在 src/lib/shared.ts 的 currentZones，加分区照那里的说明。
 */
import { llms, loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { applyMdxPreset } from 'fumadocs-mdx/config';
import { defineDocs } from 'fumadocs-mdx/macro';
import { cardSchema, docfirstMarkdownOptions, docfirstMdxOptions, remarkTrajectoryLinks } from '@godcreator/docfirst-workflow/fumadocs';
import { zoneRoute, type CurrentZoneId } from './shared';

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    mdxOptions: applyMdxPreset(docfirstMdxOptions({ root: process.cwd() })),
    postprocess: {
      includeProcessedMarkdown: docfirstMarkdownOptions(),
    },
  },
  meta: {
    schema: metaSchema,
  },
});

const collabSite = defineDocs({
  dir: 'content/collab-site',
  docs: {
    schema: pageSchema,
    mdxOptions: applyMdxPreset(docfirstMdxOptions({ root: process.cwd() })),
    postprocess: {
      includeProcessedMarkdown: docfirstMarkdownOptions(),
    },
  },
  meta: {
    schema: metaSchema,
  },
});

const collabModel = defineDocs({
  dir: 'content/collab-model',
  docs: {
    schema: pageSchema,
    mdxOptions: applyMdxPreset(docfirstMdxOptions({ root: process.cwd() })),
    postprocess: {
      includeProcessedMarkdown: docfirstMarkdownOptions(),
    },
  },
  meta: {
    schema: metaSchema,
  },
});

const collabMergeCheck = defineDocs({
  dir: 'content/collab-merge-check',
  docs: {
    schema: pageSchema,
    mdxOptions: applyMdxPreset(docfirstMdxOptions({ root: process.cwd() })),
    postprocess: {
      includeProcessedMarkdown: docfirstMarkdownOptions(),
    },
  },
  meta: {
    schema: metaSchema,
  },
});

const gwbCollab = defineDocs({
  dir: 'content/gwb-collab',
  docs: {
    schema: pageSchema,
    mdxOptions: applyMdxPreset(docfirstMdxOptions({ root: process.cwd() })),
    postprocess: {
      includeProcessedMarkdown: docfirstMarkdownOptions(),
    },
  },
  meta: {
    schema: metaSchema,
  },
});

const gitea = defineDocs({
  dir: 'content/gitea',
  docs: {
    schema: pageSchema,
    mdxOptions: applyMdxPreset(docfirstMdxOptions({ root: process.cwd() })),
    postprocess: {
      includeProcessedMarkdown: docfirstMarkdownOptions(),
    },
  },
  meta: {
    schema: metaSchema,
  },
});

const cases = defineDocs({
  dir: 'content/cases',
  docs: {
    schema: pageSchema,
    mdxOptions: applyMdxPreset(docfirstMdxOptions({ root: process.cwd() })),
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
  baseUrl: zoneRoute('docs'),
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

const sourceCollabSite = loader({
  baseUrl: zoneRoute('collab-site'),
  source: collabSite.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

const sourceCollabModel = loader({
  baseUrl: zoneRoute('collab-model'),
  source: collabModel.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

const sourceCollabMergeCheck = loader({
  baseUrl: zoneRoute('collab-merge-check'),
  source: collabMergeCheck.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

const sourceGwbCollab = loader({
  baseUrl: zoneRoute('gwb-collab'),
  source: gwbCollab.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

const sourceGitea = loader({
  baseUrl: zoneRoute('gitea'),
  source: gitea.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

const sourceCases = loader({
  baseUrl: zoneRoute('cases'),
  source: cases.toFumadocsSource(),
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

function zoneLlms(zoneSource: typeof source) {
  return llms(zoneSource, {
    renderPage: async (page) => `# ${page.data.title} (${page.url})

${await page.data.getText('processed')}`,
  });
}

export const docsLlms = zoneLlms(source);

/** 现状区各分区的 loader 与机读版，顺序就是侧栏、llms.txt 与搜索里的顺序 */
export const currentSources: Record<CurrentZoneId, { source: typeof source; llms: typeof docsLlms }> = {
  docs: { source, llms: docsLlms },
  'collab-model': { source: sourceCollabModel, llms: zoneLlms(sourceCollabModel) },
  'collab-site': { source: sourceCollabSite, llms: zoneLlms(sourceCollabSite) },
  'collab-merge-check': { source: sourceCollabMergeCheck, llms: zoneLlms(sourceCollabMergeCheck) },
  'gwb-collab': { source: sourceGwbCollab, llms: zoneLlms(sourceGwbCollab) },
  gitea: { source: sourceGitea, llms: zoneLlms(sourceGitea) },
  cases: { source: sourceCases, llms: zoneLlms(sourceCases) },
};
