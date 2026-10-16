/**
 * PageTypes（「god-docsite：平台包」那一页「三种页面进一棵页面树」一节）的全部数据，画面（page-types.tsx）只读这一份。
 * MDX、TSX、HTML 三种页面进同一棵页面树、同一个搜索索引；页面路由的 loader（sitePageData）按 type 给浏览器不同的东西。
 * 每种情况是从上到下的四张卡：内容目录里的文件 → app/lib/source.ts 的来源 → sitePageData 交给浏览器的 → 浏览器怎么显示；
 * 第二张卡三种情况是同一个 loader（只是键不同），都标 violet。例子都是本站自己的页。
 * 第二张卡的行把模板里 glob 的定义（8–9 行）与 loader 的调用（13 行）合写在一句里；
 * 第四张卡 mdx、tsx 的那句出自 site-page.tsx 的 createSitePage，html 的出自 page-sources.ts 的注释与 content-file-url.ts。
 */

/** 每种情况末尾那行灰字（page.server.ts：页面树只由布局路由给） */
export const footer = '页面树不在这里给，只由布局路由给。';

/* ref file="../packages/god-docsite/template/app/lib/source.ts" lines="8-9" hash="fd244dfdede5" blob="eea12044bb68" */

/* ref file="../packages/god-docsite/template/app/lib/source.ts" lines="11-16" hash="35db1285d9d4" blob="eea12044bb68" */

/* ref file="../packages/god-docsite/src/site/page.server.ts" lines="15-32" hash="6c0dabd9f88e" blob="8d10a15cc344" */

/* ref file="../packages/god-docsite/src/site/site-page.tsx" lines="32-35" hash="3688a0b010de" blob="e1ea4733f0d2" */

/* ref file="../packages/god-docsite/src/core/content-file-url.ts" lines="1-4" hash="7b8ee0992815" blob="5bd4c689f31d" */

export const cases = [
  {
    id: 'mdx',
    label: 'MDX 页',
    text: '站里大多数页面是 MDX：fumadocs-mdx 在构建期把 content/ 编译成集合，loader 交给浏览器的只有路径——编译好的正文由 client loader 在浏览器里加载，loader 数据里没有正文。例子是本页自己。',
    chain: [
      {
        title: '内容目录里的文件',
        icon: 'folder',
        role: 'cyan',
        lines: ['content/packages/god-docsite.mdx', '这一页（本页）'],
      },
      {
        title: 'app/lib/source.ts 的来源',
        icon: 'file',
        role: 'violet',
        lines: ["mdx: docs.toFumadocsSource()", 'docs 是 .source/server 里 fumadocs-mdx 编译出的集合'],
      },
      {
        title: 'sitePageData 交给浏览器的',
        icon: 'server',
        role: 'blue',
        lines: ['{ …common, type: \'mdx\',', "  path: 'packages/god-docsite.mdx' }"],
      },
      {
        title: '浏览器怎么显示',
        icon: 'user',
        role: 'emerald',
        lines: ['client loader 按路径在浏览器加载正文', "docsContent.useContent('packages/god-docsite.mdx')"],
      },
    ],
  },
  {
    id: 'tsx',
    label: 'TSX 页',
    text: '正文要真正运行的组件时写成 .page.tsx：来源把文件清单里的 meta 换成虚拟文件，标题、描述与搜索文字都在页面文件里明确给出；loader 交给浏览器一个文件名，页面模块在浏览器按需加载、渲染默认导出。例子是「TSX 页面示例」那一页。',
    chain: [
      {
        title: '内容目录里的文件',
        icon: 'folder',
        role: 'cyan',
        lines: ['content/docsite/example.page.tsx', '导出 meta（title「TSX 页面示例」）与默认组件'],
      },
      {
        title: 'app/lib/source.ts 的来源',
        icon: 'file',
        role: 'violet',
        lines: ["tsx: tsxPageSource(import.meta.glob('/content/**/*.page.tsx',", "  { eager: true, import: 'meta' }))"],
      },
      {
        title: 'sitePageData 交给浏览器的',
        icon: 'server',
        role: 'blue',
        lines: ['{ …common, type: \'tsx\',', "  file: '/content/docsite/example.page.tsx' }"],
      },
      {
        title: '浏览器怎么显示',
        icon: 'user',
        role: 'emerald',
        lines: ['按 file 按需加载页面模块，渲染默认导出', "tsxPages['/content/docsite/example.page.tsx']()"],
      },
    ],
  },
  {
    id: 'html',
    label: 'HTML 页',
    text: '现成的 HTML 文件原样进站：来源从文本里提取标题、描述、目录锚点与搜索分段，不做任何编译；loader 交给浏览器 /api/content/ 下的地址，iframe 原样展示，页面里的相对引用不用改写。例子是「fumadocs 图解总览」。',
    chain: [
      {
        title: '内容目录里的文件',
        icon: 'folder',
        role: 'cyan',
        lines: ['content/background/overview.html', '<title>fumadocs 图解总览</title>'],
      },
      {
        title: 'app/lib/source.ts 的来源',
        icon: 'file',
        role: 'violet',
        lines: ["html: htmlPageSource(import.meta.glob('/content/**/*.html',", "  { eager: true, query: '?raw', import: 'default' }))"],
      },
      {
        title: 'sitePageData 交给浏览器的',
        icon: 'server',
        role: 'blue',
        lines: ['{ …common, type: \'html\',', "  src: '/api/content/background/overview.html', headings: [...] }"],
      },
      {
        title: '浏览器怎么显示',
        icon: 'user',
        role: 'emerald',
        lines: ['iframe 的 src 用这个地址，原样展示', '文件按原路径送出，相对引用不用改写'],
      },
    ],
  },
];
