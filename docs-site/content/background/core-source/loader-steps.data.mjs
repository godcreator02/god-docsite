/**
 * LoaderSteps（「fumadocs-core 页面来源导读」页「loader() 内部五步」一节）的全部数据，画面（loader-steps.tsx）只读这一份。
 * 贯穿的例子是为讲解拼的：四个虚拟文件（meta.json 列 intro 与 guide，另有 intro.mdx、guide/index.mdx、x.page.tsx），
 * url 按 baseUrl: '/' 算出；slug、四张 Map 的键与内容、第 5 步的树都照 16.17.1 源码的规则从这组文件推出来。
 * 「Duplicated slugs」一行只示意报错的样子，不是这组文件会触发的（它们互不重复）。
 * 每步的 srcRef 是正文原来那几个 GitHub 固定 tag 链接，一条没丢。
 */

/** GitHub 源码链接（fumadocs 16.17.1 固定 tag），照同分区 compile-flow 的写法 */
export const SOURCE_BASE = 'https://github.com/fuma-nama/fumadocs/blob/fumadocs%4016.17.1/packages/core/src';

export const steps = [
  {
    title: '整理配置',
    cardTitle: 'loader 的配置',
    lines: [
      'url 函数：url(slugs, locale)',
      '插件列表：',
      '  1 iconPlugin（icon 选项生成）',
      '  2 站点的 plugins',
      '  3 slugsPlugin（固定最后）',
      '按 enforce 排：pre → 默认 → post',
      '依次调每个插件的 config()',
    ],
    note: 'url 函数把 slug 翻译成网址，第 4 步算 page.url 要用；插件可以借 config() 整份替换配置。',
    srcRef: { file: 'source/loader.ts:511-588', url: `${SOURCE_BASE}/source/loader.ts#L511-L588` },
    text: '第 1 步整理配置：图标插件在前、站点的 plugins 居中、slugs 插件固定最后，再按 enforce 排序，然后依次调用每个插件的 config()。',
  },
  {
    title: '写进内存文件系统',
    cardTitle: 'FileSystem（每种语言一个）',
    lines: [
      'files（路径 → 文件）',
      '  meta.json    → meta',
      '  intro.mdx    → page',
      '  guide/index.mdx → page',
      '  x.page.tsx   → page',
      'folders（目录 → 子项）',
      "  ''     → [meta.json, intro.mdx, guide,",
      '            x.page.tsx]',
      "  'guide' → [guide/index.mdx]",
    ],
    note: '每个虚拟文件加上 baseDir、规范化路径后写入；写完对存储调一遍所有插件的 transformStorage——下一步的 slugs 插件就在这时跑。',
    srcRef: { file: 'source/storage/content.ts:50-175', url: `${SOURCE_BASE}/source/storage/content.ts#L50-L175` },
    srcRef2: { file: 'storage/file-system.ts:6-89', url: `${SOURCE_BASE}/source/storage/file-system.ts#L6-L89` },
    text: '第 2 步把虚拟文件写进内存文件系统：就两个 Map——路径 → 文件、目录 → 子项；按语言分组，每种语言一个。',
  },
  {
    title: '算 slug',
    cardTitle: '每个页面算出的 slug',
    lines: [
      'intro.mdx       → intro',
      'guide/index.mdx → guide（index 省略）',
      'x.page.tsx      → x.page',
      '                  （只去掉最后一个扩展名）',
      'meta.json 不算 slug',
      '自动算出的重复 →',
      '  Error: Duplicated slugs: <slug>',
    ],
    note: '目录段做 URI 编码、(分组) 段跳过；来源自己给的 slug 不检查重复，只有自动算出的才查。',
    srcRef: { file: 'source/plugins/slugs.ts:43-125', url: `${SOURCE_BASE}/source/plugins/slugs.ts#L43-L125` },
    text: '第 3 步算 slug：guide 的 index 省略、直接叫 guide；x.page.tsx 只去掉最后一个扩展名，得到 x.page。',
  },
  {
    title: '建索引',
    cardTitle: '四张 Map（索引）',
    lines: [
      'slug  → 页：intro、guide、x.page',
      '页面路径 → 页：intro.mdx、',
      '  guide/index.mdx、x.page.tsx',
      'meta 路径 → meta：meta.json',
      'url   → 页：/intro、/guide、/x.page',
      'page.url 用第 1 步的 url 函数算出',
    ],
    note: 'getPage、getPageByHref、getNodePage 这些查询都只查这四张 Map，不再碰文件系统；索引键的格式是内部实现，别依赖。',
    srcRef: { file: 'source/loader.ts:195-261', url: `${SOURCE_BASE}/source/loader.ts#L195-L261` },
    text: '第 4 步建索引：四张 Map 各用自己的键指向同一批页面对象，page.url 在这一步算出。',
  },
  {
    title: '页面树延迟构建',
    cardTitle: 'pageTree（第一次读时才建）',
    lines: [
      'root',
      '├─ intro（page）',
      '└─ guide（folder，index 页是',
      '         guide/index.mdx 自己）',
      'root.fallback',
      '└─ x.page（page）',
      '依次跑：transformers →',
      '  各插件的 transformPageTree → fallback',
    ],
    note: 'pageTree 是 getter，第一次读时构建并缓存；没被 meta.json 列到的 x.page 落进 root.fallback，侧栏与上下页仍能查到。',
    srcRef: { file: 'source/loader.ts:333-372', url: `${SOURCE_BASE}/source/loader.ts#L333-L372` },
    text: '第 5 步延迟构建页面树：meta.json 列了 intro 与 guide，guide 成为带 index 页的文件夹；没被列到的 x.page 落进 root.fallback。',
  },
];
