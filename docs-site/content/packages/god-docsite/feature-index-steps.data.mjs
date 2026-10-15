/**
 * FeatureIndexSteps（「god-docsite：平台包」那一页）的全部数据，画面（feature-index-steps.tsx）只读这一份。
 * 例子是本站 docs-site 自己按 tests/scaffold-check.mjs 的顺序建出来的六步：createSite 建站、addBaseFeatures 补基础功能、
 * 依次 addFeature code-pin、trajectory、explainer，最后重复一次 addFeature trajectory。
 * 五份汇总文件里只放随功能变的行（文件里固定的部分不画），行号按这里列出的顺序从 1 数；
 * 第 5 步的行与 docs-site/app/features/*.generated.* 里的实际文件逐字相同。
 */

/** 建站器认的四种文件，顺序固定；颜色整页统一：routes 蓝、feature 紫、mdx 绿、styles 琥珀 */
export const featureFiles = ['routes.ts', 'feature.tsx', 'mdx.ts', 'styles.css'];
export const fileRoles = { 'routes.ts': 'blue', 'feature.tsx': 'violet', 'mdx.ts': 'emerald', 'styles.css': 'amber' };

/** 五份汇总文件：文件名与颜色（mdx 与集合都是构建期的绿色） */
export const indexFiles = [
  { key: 'routes', file: 'routes.generated.ts', role: 'blue' },
  { key: 'runtime', file: 'runtime.generated.ts', role: 'violet' },
  { key: 'mdx', file: 'mdx.generated.ts', role: 'emerald' },
  { key: 'collections', file: 'collections.generated.ts', role: 'emerald' },
  { key: 'styles', file: 'styles.generated.css', role: 'amber' },
];

/** docs-site 的功能清单与建站顺序（createSite → addBaseFeatures → 逐个 addFeature）照 scaffold-check 的比对 */
/* ref file="../tests/scaffold-check.mjs" lines="46-54" hash="89989ec16f63" blob="8abce268e995" */
/* ref file="../tests/scaffold-check.mjs" lines="90-102" hash="4c711af8ed44" blob="8abce268e995" */
export const steps = [
  {
    id: 'create',
    title: '建站',
    text: '建站：createSite 复制模板之后调一次 regenerateFeatureIndex。app/features/ 是空的，五份汇总文件都写成空的：没有路由、没有运行时模块、没有 MDX 插件、不导出集合、样式只有开头一行说明。站点模板从此固定 import 这五份文件。',
    call: 'createSite({ dir, siteName, people, packageSource })',
    returns: '认出 0 个功能',
    dirs: [],
    generated: {
      routes: { status: 'empty', lines: ['const featureRoutesModules: FeatureRoutesModule[] = []'] },
      runtime: { status: 'empty', lines: ['export const featureRuntime = siteFeatureRuntime({})'] },
      mdx: { status: 'empty', lines: ['const featureMdxModules: FeatureMdxModule[] = []'] },
      collections: { status: 'empty', lines: ['export {}'] },
      styles: { status: 'empty', lines: ['/* 建站器生成，勿手改：… */'] },
    },
  },
  {
    id: 'base',
    title: '补基础功能',
    text: '补基础功能：模板 package.json 里写成 {{version}} 的包，除了平台包自己，就是 comments 与 identity。identity 没有 template/，不算功能、跳过；comments 的四个文件补进 comments/。其中 feature.tsx、routes.ts、styles.css 是建站器认的，各进一份汇总文件；comments.tsx 不是这四种，它由 comments/routes.ts 自己 import，汇总文件不管它。',
    call: 'addBaseFeatures({ siteDir })',
    returns: 'comments：addedFiles 4 个，keptFiles 0 个；features：comments',
    dirs: [
      {
        name: 'comments',
        isNew: true,
        files: ['comments.tsx', 'feature.tsx', 'routes.ts', 'styles.css'],
        recognized: ['feature.tsx', 'routes.ts', 'styles.css'],
        collections: [],
        unrecognizedNote: '另有 comments.tsx，不是这四种，汇总文件不管它',
        keptNote: null,
      },
    ],
    generated: {
      routes: {
        status: 'changed',
        lines: ["import * as commentsRoutes from './comments/routes.ts'", 'const featureRoutesModules: FeatureRoutesModule[] = [commentsRoutes]'],
        added: [1],
        changed: [2],
      },
      runtime: {
        status: 'changed',
        lines: ["import * as commentsFeature from './comments/feature.tsx'", "export const featureRuntime = siteFeatureRuntime({ 'comments': commentsFeature })"],
        added: [1],
        changed: [2],
      },
      mdx: { status: 'same' },
      collections: { status: 'same' },
      styles: { status: 'changed', lines: ["@import './comments/styles.css';"], added: [1] },
    },
  },
  {
    id: 'code-pin',
    title: '加 code-pin',
    text: '加 code-pin：它只有 mdx.ts 与 styles.css，所以只有 mdx.generated.ts 与 styles.generated.css 变。目录名 code-pin 转成驼峰变量名 codePinMdx。样式的 @import 排到了 comments 前面：汇总文件按目录名排序，和加的先后无关。code-pin 的 package.json 没写 godDocsite，没有集合，collections.generated.ts 不变。',
    call: "addFeature({ siteDir, packageName: '@godcreator/code-pin' })",
    returns: 'addedFiles 2 个，keptFiles 0 个；features：code-pin、comments',
    dirs: [
      {
        name: 'code-pin',
        isNew: true,
        files: ['mdx.ts', 'styles.css'],
        recognized: ['mdx.ts', 'styles.css'],
        collections: [],
        unrecognizedNote: null,
        keptNote: null,
      },
      {
        name: 'comments',
        isNew: false,
        files: ['comments.tsx', 'feature.tsx', 'routes.ts', 'styles.css'],
        recognized: ['feature.tsx', 'routes.ts', 'styles.css'],
        collections: [],
        unrecognizedNote: '另有 comments.tsx，不是这四种，汇总文件不管它',
        keptNote: null,
      },
    ],
    generated: {
      routes: { status: 'same' },
      runtime: { status: 'same' },
      mdx: {
        status: 'changed',
        lines: ["import * as codePinMdx from './code-pin/mdx.ts'", 'const featureMdxModules: FeatureMdxModule[] = [codePinMdx]'],
        added: [1],
        changed: [2],
      },
      collections: { status: 'same' },
      styles: {
        status: 'changed',
        lines: ["@import './code-pin/styles.css';", "@import './comments/styles.css';"],
        added: [1],
      },
    },
  },
  {
    id: 'trajectory',
    title: '加 trajectory',
    text: '加 trajectory：四种文件都有，五份汇总文件全变。它的 package.json 写了 godDocsite.collections: ["trajectory"]，collections.generated.ts 第一次有内容：调 mdx.ts 里同名的集合工厂，把全站插件 sitePlugins 传进去，source.config.ts 用 export * 把它再导出。card.tsx、disk.tsx、href.ts、site.server.ts 不是这四种，汇总文件不管。',
    call: "addFeature({ siteDir, packageName: '@godcreator/trajectory' })",
    returns: 'addedFiles 8 个，keptFiles 0 个；features：code-pin、comments、trajectory',
    dirs: [
      {
        name: 'code-pin',
        isNew: false,
        files: ['mdx.ts', 'styles.css'],
        recognized: ['mdx.ts', 'styles.css'],
        collections: [],
        unrecognizedNote: null,
        keptNote: null,
      },
      {
        name: 'comments',
        isNew: false,
        files: ['comments.tsx', 'feature.tsx', 'routes.ts', 'styles.css'],
        recognized: ['feature.tsx', 'routes.ts', 'styles.css'],
        collections: [],
        unrecognizedNote: '另有 comments.tsx，不是这四种，汇总文件不管它',
        keptNote: null,
      },
      {
        name: 'trajectory',
        isNew: true,
        files: ['card.tsx', 'disk.tsx', 'feature.tsx', 'href.ts', 'mdx.ts', 'routes.ts', 'site.server.ts', 'styles.css'],
        recognized: ['feature.tsx', 'mdx.ts', 'routes.ts', 'styles.css'],
        collections: ['trajectory'],
        unrecognizedNote: '另有 card.tsx、disk.tsx、href.ts、site.server.ts，不是这四种，汇总文件不管它们',
        keptNote: null,
      },
    ],
    generated: {
      routes: {
        status: 'changed',
        lines: [
          "import * as commentsRoutes from './comments/routes.ts'",
          "import * as trajectoryRoutes from './trajectory/routes.ts'",
          'const featureRoutesModules: FeatureRoutesModule[] = [commentsRoutes, trajectoryRoutes]',
        ],
        added: [2],
        changed: [3],
      },
      runtime: {
        status: 'changed',
        lines: [
          "import * as commentsFeature from './comments/feature.tsx'",
          "import * as trajectoryFeature from './trajectory/feature.tsx'",
          "export const featureRuntime = siteFeatureRuntime({ 'comments': commentsFeature, 'trajectory': trajectoryFeature })",
        ],
        added: [2],
        changed: [3],
      },
      mdx: {
        status: 'changed',
        lines: [
          "import * as codePinMdx from './code-pin/mdx.ts'",
          "import * as trajectoryMdx from './trajectory/mdx.ts'",
          'const featureMdxModules: FeatureMdxModule[] = [codePinMdx, trajectoryMdx]',
        ],
        added: [2],
        changed: [3],
      },
      collections: {
        status: 'changed',
        lines: [
          "import { sitePlugins } from '../lib/mdx-plugins.ts'",
          "import * as trajectoryMdx from './trajectory/mdx.ts'",
          'export const trajectory = trajectoryMdx.collections.trajectory(sitePlugins)',
        ],
        added: [1, 2, 3],
      },
      styles: {
        status: 'changed',
        lines: ["@import './code-pin/styles.css';", "@import './comments/styles.css';", "@import './trajectory/styles.css';"],
        added: [3],
      },
    },
  },
  {
    id: 'explainer',
    title: '加 explainer',
    text: '加 explainer：只有一份 styles.css，只进 styles.generated.css，按名字排在 comments 与 trajectory 之间。到这一步，五份汇总文件和本站 docs-site/app/features/ 里的一字不差。',
    call: "addFeature({ siteDir, packageName: '@godcreator/explainer' })",
    returns: 'addedFiles 1 个，keptFiles 0 个；features：code-pin、comments、explainer、trajectory',
    dirs: [
      {
        name: 'code-pin',
        isNew: false,
        files: ['mdx.ts', 'styles.css'],
        recognized: ['mdx.ts', 'styles.css'],
        collections: [],
        unrecognizedNote: null,
        keptNote: null,
      },
      {
        name: 'comments',
        isNew: false,
        files: ['comments.tsx', 'feature.tsx', 'routes.ts', 'styles.css'],
        recognized: ['feature.tsx', 'routes.ts', 'styles.css'],
        collections: [],
        unrecognizedNote: '另有 comments.tsx，不是这四种，汇总文件不管它',
        keptNote: null,
      },
      {
        name: 'explainer',
        isNew: true,
        files: ['styles.css'],
        recognized: ['styles.css'],
        collections: [],
        unrecognizedNote: null,
        keptNote: null,
      },
      {
        name: 'trajectory',
        isNew: false,
        files: ['card.tsx', 'disk.tsx', 'feature.tsx', 'href.ts', 'mdx.ts', 'routes.ts', 'site.server.ts', 'styles.css'],
        recognized: ['feature.tsx', 'mdx.ts', 'routes.ts', 'styles.css'],
        collections: ['trajectory'],
        unrecognizedNote: '另有 card.tsx、disk.tsx、href.ts、site.server.ts，不是这四种，汇总文件不管它们',
        keptNote: null,
      },
    ],
    generated: {
      routes: { status: 'same' },
      runtime: { status: 'same' },
      mdx: { status: 'same' },
      collections: { status: 'same' },
      styles: {
        status: 'changed',
        lines: [
          "@import './code-pin/styles.css';",
          "@import './comments/styles.css';",
          "@import './explainer/styles.css';",
          "@import './trajectory/styles.css';",
        ],
        added: [3],
      },
    },
  },
  // 第 6 步：重复运行只补缺的、已有的不覆盖（站点可能改过它们），对照 test/scaffold.test.ts 的重复运行一条
  /* ref file="../packages/god-docsite/test/scaffold.test.ts" lines="150-158" hash="4c1a92b11c15" blob="97b6d5535258" */
  {
    id: 'again',
    title: '再加一次 trajectory',
    text: '再加一次 trajectory：功能目录里 8 个文件都已经有了，一个都不覆盖（站点可能改过它们），addedFiles 是空的；汇总文件照旧按目录现算、整份重写，内容和上一步一样。删掉的功能文件再运行一次就补回来。',
    call: "addFeature({ siteDir, packageName: '@godcreator/trajectory' })",
    returns: 'addedFiles 0 个，keptFiles 8 个；features 同上一步',
    dirs: [
      {
        name: 'code-pin',
        isNew: false,
        files: ['mdx.ts', 'styles.css'],
        recognized: ['mdx.ts', 'styles.css'],
        collections: [],
        unrecognizedNote: null,
        keptNote: null,
      },
      {
        name: 'comments',
        isNew: false,
        files: ['comments.tsx', 'feature.tsx', 'routes.ts', 'styles.css'],
        recognized: ['feature.tsx', 'routes.ts', 'styles.css'],
        collections: [],
        unrecognizedNote: '另有 comments.tsx，不是这四种，汇总文件不管它',
        keptNote: null,
      },
      {
        name: 'explainer',
        isNew: false,
        files: ['styles.css'],
        recognized: ['styles.css'],
        collections: [],
        unrecognizedNote: null,
        keptNote: null,
      },
      {
        name: 'trajectory',
        isNew: false,
        files: ['card.tsx', 'disk.tsx', 'feature.tsx', 'href.ts', 'mdx.ts', 'routes.ts', 'site.server.ts', 'styles.css'],
        recognized: ['feature.tsx', 'mdx.ts', 'routes.ts', 'styles.css'],
        collections: ['trajectory'],
        unrecognizedNote: '另有 card.tsx、disk.tsx、href.ts、site.server.ts，不是这四种，汇总文件不管它们',
        keptNote: '补进 0 个，8 个已有、没动',
      },
    ],
    generated: {
      routes: { status: 'rewritten' },
      runtime: { status: 'rewritten' },
      mdx: { status: 'rewritten' },
      collections: { status: 'rewritten' },
      styles: { status: 'rewritten' },
    },
  },
];
