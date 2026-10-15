import { useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { CodeLines, Pane, Stepper } from '@godcreator/explainer/site'
import '@godcreator/explainer/styles.css'

/** 一道工序是谁的：给色点、右栏 Pane 配色 */
type Who = 'vite' | 'mdx' | 'core' | 'mdxjs' | 'ours'

/** 各角色的色点：写死色值，深浅主题下都看得清 */
const WHO_DOT: Record<Who, string> = {
  vite: '#8b5cf6',
  mdx: '#3b82f6',
  core: '#10b981',
  mdxjs: '#94a3b8',
  ours: '#f43f5e',
}
const WHO_NAME: Record<Who, string> = {
  vite: 'Vite',
  mdx: 'fumadocs-mdx',
  core: 'fumadocs-core',
  mdxjs: '@mdx-js/mdx',
  ours: '我们的包',
}

/** 中栏列出的 17 道工序 */
const STATIONS: ReadonlyArray<{ name: string; who: Who }> = [
  { name: '收到原文', who: 'vite' },
  { name: '找集合设置', who: 'mdx' },
  { name: '拆 frontmatter、校验', who: 'mdx' },
  { name: '解析成语法树', who: 'mdxjs' },
  { name: 'remarkInclude', who: 'mdx' },
  { name: 'remarkGfm', who: 'core' },
  { name: 'remarkHeading', who: 'core' },
  { name: 'remarkImage', who: 'core' },
  { name: 'remarkCodeTab、remarkNpm', who: 'core' },
  { name: '站点的 remark 插件（钉码）', who: 'ours' },
  { name: 'remarkStructure', who: 'core' },
  { name: 'remarkPostprocess', who: 'mdx' },
  { name: '转成 HTML 语法树', who: 'mdxjs' },
  { name: 'rehypeCode', who: 'core' },
  { name: '站点的 rehype 插件', who: 'core' },
  { name: 'rehypeToc', who: 'core' },
  { name: '生成 JS', who: 'mdxjs' },
]

/** 每一步正在执行的那段 fumadocs 源码：file 是显示名，url 是 GitHub 固定 tag 的链接 */
const B = 'https://github.com/fuma-nama/fumadocs/blob/fumadocs%4016.17.1/packages/'
const at = (path: string, from: number, to: number): { file: string; url: string } => ({
  file: `${path}:${from}-${to}`,
  url: `${B}${path}#L${from}-L${to}`,
})

const SOURCE = [
  '---',
  'title: 安装',
  '---',
  '## 用 pnpm 安装',
  '先装依赖，再写配置：',
  '```ts  export default {}  ```',
  '<include>./env.mdx</include>',
  '<Pin file="src/setup.ts" lines="3-9" … />',
  '<PinTree dir="src" depth="1" … />',
  '![架构](./arch.png)',
]

/** mdast 的 8 行（第 3 步建好，后面各工序在上面改） */
const MDAST = [
  'root',
  'heading（2 级）：用 pnpm 安装',
  'paragraph：先装依赖，再写配置：',
  'code（ts）：export default {}',
  '<include>：./env.mdx',
  '<Pin file="src/setup.ts" lines="3-9" />',
  '<PinTree dir="src" depth="1" />',
  'image：./arch.png',
]
const mdastWith = (row: number, text: string): string[] => MDAST.map((line, i) => (i === row - 1 ? text : line))

/** 第 9 步（钉码）的树：Pin 与 PinTree 换成块，底下挂登记表 */
const PINNED = [
  ...MDAST.slice(0, 5),
  'PinBlock（状态=绿）> code（setup.ts 3-9 行）',
  'PinTreeBlock > Files > Folder…',
  MDAST[7]!,
  'replaceSource 登记表：<Pin> → 一块代码',
]

/** hast 的 8 行（第 12 步整棵换掉） */
const HAST = [
  'root',
  'h2 id="用-pnpm-安装"',
  'p',
  'pre > code（ts）',
  'p（env.mdx 的内容）',
  'PinBlock（组件标签保留）> pre > code',
  'PinTreeBlock > Files > Folder…（都保留）',
  'img src={arch.png}',
]
const hastWith = (row: number, text: string): string[] => HAST.map((line, i) => (i === row - 1 ? text : line))

/** 第 13 步：两处代码块高亮后 */
const SHIKI = hastWith(4, 'pre（Shiki 已高亮，每个词带颜色）')
SHIKI[5] = 'PinBlock > pre（Shiki 已高亮）'

/** 第 16 步右栏换成的导出清单 */
const EXPORTS = [
  'import arch.png（交给 Vite 打包）',
  "export frontmatter = { title: '安装' }",
  'export structuredData = { 标题、正文… }',
  "export _markdown = '## 用 pnpm 安装…'",
  'export toc = [ 用 pnpm 安装 ]',
  'export default MDXContent（正文组件）',
  '渲染时每个标签先查 props.components',
]

interface Stage {
  title: string
  text: string
  who: Who
  /** 左栏源码高亮的行段（1 起）；null 不高亮。钉码那道工序用琥珀色 */
  srcHl: readonly [number, number] | null
  srcTone: 'info' | 'warn'
  /** 右栏标题与行 */
  treeTitle: string
  tree: readonly string[]
  /** 右栏这一步新出现的行（闪）与改动的行（波浪线） */
  treeAdded: readonly number[]
  treeChanged: readonly number[]
  /** 正在执行的那段源码；没有就 undefined（mdx-js 内部、示意代码） */
  srcRef?: { file: string; url: string }
}

const noTree: Pick<Stage, 'treeTitle' | 'tree' | 'treeAdded' | 'treeChanged'> = { treeTitle: '语法树：还没有', tree: [], treeAdded: [], treeChanged: [] }

/** 每一步给出右栏的完整状态，缺的用 noTree 补 */
function stage(part: Omit<Stage, 'treeTitle' | 'tree' | 'treeAdded' | 'treeChanged'> & Partial<Pick<Stage, 'treeTitle' | 'tree' | 'treeAdded' | 'treeChanged'>>): Stage {
  return { ...noTree, ...part }
}

const STAGES: readonly Stage[] = [
  stage({
    title: '收到原文',
    who: 'vite',
    srcHl: null,
    srcTone: 'info',
    srcRef: at('mdx/src/loaders/adapter.ts', 98, 119),
    text: 'Vite 加载 install.mdx?macro_id=…，transform 这一步轮到 fumadocs-mdx 的编译插件，它拿到这个文件的原文。注意这里顺手交出一个 addDependency 通道：之后谁调用它，就等于让 Vite 盯住那个文件——钉码的「改被钉代码页面跟着变」靠的就是它。',
  }),
  stage({
    title: '找集合设置',
    who: 'mdx',
    srcHl: null,
    srcTone: 'info',
    srcRef: at('mdx/src/loaders/mdx/index.ts', 71, 77),
    tree: ['app/lib/source.ts 执行一遍，取出 docs.mdxOptions：', '  applyMdxPreset({', '    remarkPlugins: [remarkDocfirst()]   ← 钉码从这来', '  })'],
    treeTitle: '设置从哪来',
    treeAdded: [1, 2, 3, 4],
    text: '先弄清按谁的设置编译：凭网址后面的 macro_id 找到 lib/source.ts 里的 docs 集合，把那个文件执行一遍，取出 mdxOptions 和 schema——我们的钉码插件就是这样被带进来的。lib/source.ts 也被登记成依赖：改了它，所有页面都重新编译。',
  }),
  stage({
    title: '拆 frontmatter、校验',
    who: 'mdx',
    srcHl: [1, 3],
    srcTone: 'info',
    srcRef: at('mdx/src/loaders/mdx/index.ts', 91, 100),
    tree: ["vfile.data.frontmatter = { title: '安装' }"],
    treeTitle: '编译过程的数据（vfile.data）',
    treeAdded: [1],
    text: '拆出开头的 frontmatter，按集合的 schema 校验，字段写错直接报错。它先存在编译过程的数据里（vfile.data），还不在语法树上。async 模式下「只要 frontmatter」的那个请求到这里就返回了，不再往下编译。',
  }),
  stage({
    title: '解析成语法树',
    who: 'mdxjs',
    srcHl: [4, 10],
    srcTone: 'info',
    srcRef: at('mdx/src/loaders/mdx/build-default.ts', 58, 68),
    tree: MDAST,
    treeTitle: 'Markdown 语法树（mdast）',
    treeAdded: [1, 2, 3, 4, 5, 6, 7, 8],
    text: '剩下的正文交给 MDX 编译器 @mdx-js/mdx（fumadocs-mdx 用的第三方库）解析成语法树：每个标题、段落、代码块、组件标签都成了一个节点，后面每道 remark 工序都是在改这棵树。右栏是 fumadocs-mdx 排工序的那段代码：include 永远第一个，postprocess 永远最后一个，中间是集合设置里的插件。',
  }),
  stage({
    title: 'remarkInclude',
    who: 'mdx',
    srcHl: [7, 7],
    srcTone: 'info',
    srcRef: at('mdx/src/loaders/mdx/remark-include.ts', 205, 217),
    tree: mdastWith(5, 'paragraph：（env.mdx 的内容）'),
    treeTitle: 'Markdown 语法树（mdast）',
    treeChanged: [5],
    text: 'remarkInclude 找到 <include>，读出 env.mdx，把它的内容换进这个位置，再调 addDependency 登记依赖。引的是代码文件时，它还能只取其中一段（按 #region 标记）——这就是钉码要的「读别的文件、嵌进来、文件改了重新编译」的现成样板。',
  }),
  stage({
    title: 'remarkGfm',
    who: 'core',
    srcHl: null,
    srcTone: 'info',
    srcRef: at('mdx/src/config/preset.ts', 68, 77),
    tree: MDAST,
    treeTitle: 'Markdown 语法树（mdast）',
    text: '从这里开始是 fumadocs-core 提供的默认工序，由 applyMdxPreset 排好顺序。gfm 把表格、任务列表这些 GitHub 写法变成节点——这一页没有，树不变。',
  }),
  stage({
    title: 'remarkHeading',
    who: 'core',
    srcHl: [4, 4],
    srcTone: 'info',
    srcRef: at('mdx/src/config/preset.ts', 68, 77),
    tree: mdastWith(2, 'heading（2 级）id="用-pnpm-安装"'),
    treeTitle: 'Markdown 语法树（mdast）',
    treeChanged: [2],
    text: '给每个标题生成 id，网址后面的 #用-pnpm-安装、本页目录的跳转都靠它。以后评论要定位到「某一段」，也是在这一层给节点加标记。',
  }),
  stage({
    title: 'remarkImage',
    who: 'core',
    srcHl: [10, 10],
    srcTone: 'info',
    srcRef: at('mdx/src/config/preset.ts', 78, 84),
    tree: [...mdastWith(8, 'image：src = 导入的 arch.png'), 'import arch.png'],
    treeTitle: 'Markdown 语法树（mdast）',
    treeAdded: [9],
    treeChanged: [8],
    text: '本地图片改成 import：树上多出一个导入节点。生成 JS 以后，这个 import 会交还 Vite，由 Vite 打包图片（文件名带哈希）。',
  }),
  stage({
    title: 'remarkCodeTab、remarkNpm',
    who: 'core',
    srcHl: [6, 6],
    srcTone: 'info',
    srcRef: at('mdx/src/config/preset.ts', 85, 89),
    tree: [...MDAST, 'import arch.png'],
    treeTitle: 'Markdown 语法树（mdast）',
    text: '标了 tab 的几个代码块合成一组标签页；```npm 写法展开成 npm / pnpm / yarn 三个标签——这一页没有，树不变。注意源码里紧跟着的 …v：站点的插件就插在这里。',
  }),
  stage({
    title: '站点的 remark 插件（钉码）',
    who: 'ours',
    srcHl: [8, 9],
    srcTone: 'warn',
    tree: PINNED,
    treeTitle: 'Markdown 语法树（mdast）',
    treeAdded: [9],
    treeChanged: [6, 7],
    text: '站点用 applyMdxPreset({ remarkPlugins: [remarkDocfirst()] }) 挂的插件，排在默认工序之后、structure 之前。它做三件事：① 找到 <Pin file lines hash blob />，读 src/setup.ts 第 3-9 行，和标签上的 hash、blob 比对算出绿黄红，把 <Pin> 换成 PinBlock（状态点、标题、黄灯时的增删行）包着一个普通的 code 节点——后面照常交给 Shiki 高亮；② <PinTree> 换成 PinTreeBlock 包 fumadocs 的文件树；③ 读过的文件都登记依赖，并用 replaceSource 登记它写成 Markdown 是什么样（给搜索与生成正本用）。源码窗口是站点自己写的 lib/source.ts。',
  }),
  stage({
    title: 'remarkStructure',
    who: 'core',
    srcHl: null,
    srcTone: 'info',
    srcRef: at('core/src/mdx-plugins/remark-structure.ts', 158, 171),
    tree: [...MDAST, 'import arch.png', 'export structuredData'],
    treeTitle: 'Markdown 语法树（mdast）',
    treeAdded: [10],
    text: '把标题和正文切成搜索记录，作为 export structuredData 挂到树上，后面的搜索接口用它。注意它只收标题、段落、引用、表格，以及没有子节点的组件标签——PinBlock 里包着一个 code 子节点，默认不算一条记录，钉进来的代码默认搜不到；口子是节点上的 data.structuredData：钉码插件在 PinBlock 节点上挂它（比如文件路径、函数名），这些内容就进搜索记录。',
  }),
  stage({
    title: 'remarkPostprocess',
    who: 'mdx',
    srcHl: [2, 2],
    srcTone: 'info',
    srcRef: at('mdx/src/loaders/mdx/remark-postprocess.ts', 52, 66),
    tree: [...MDAST, 'import arch.png', 'export structuredData', 'export _markdown（开了才有）', 'export frontmatter'],
    treeTitle: 'Markdown 语法树（mdast）',
    treeAdded: [11, 12],
    text: 'fumadocs-mdx 收尾：frontmatter 没 title 就拿一级标题补上；mdx-export 里的值在这里写成 export。集合开了 includeProcessedMarkdown 时，remarkLLMs 也在这步读登记表，从原文切出整页 Markdown（<Pin> 换成那块代码、import/export 去掉），导出成 _markdown——llms.txt、每页 .md、页面上的「复制 Markdown」按钮都靠它。没开就没有这一行；docfirst 的站目前不开。',
  }),
  stage({
    title: '转成 HTML 语法树',
    who: 'mdxjs',
    srcHl: null,
    srcTone: 'info',
    tree: HAST,
    treeTitle: 'HTML 语法树（hast）',
    treeAdded: [1, 2, 3, 4, 5, 6, 7, 8],
    text: 'MDX 编译器把 Markdown 语法树转成 HTML 语法树：heading 变 h2，paragraph 变 p，code 变 pre。<PinBlock>、<Files> 这类组件标签原样保留，等渲染时再换成真正的组件；PinBlock 里面那个 code 节点也变成了 pre。这一步在 @mdx-js/mdx 内部（remark-rehype），fumadocs 没有代码。',
  }),
  stage({
    title: 'rehypeCode',
    who: 'core',
    srcHl: [6, 6],
    srcTone: 'info',
    srcRef: at('mdx/src/config/preset.ts', 116, 123),
    tree: SHIKI,
    treeTitle: 'HTML 语法树（hast）',
    treeChanged: [4, 6],
    text: '代码块用 Shiki 高亮，结果直接写进树里，浏览器不用再跑高亮。钉码代码块里的代码也在这一步被高亮——这就是让钉码产出普通 code 节点、而不是自己渲染代码的好处：高亮、复制按钮都复用 fumadocs 现成的。',
  }),
  stage({
    title: '站点的 rehype 插件',
    who: 'core',
    srcHl: null,
    srcTone: 'info',
    srcRef: at('mdx/src/config/preset.ts', 116, 123),
    tree: HAST,
    treeTitle: 'HTML 语法树（hast）',
    text: '站点挂的 rehype 插件排在这里（applyMdxPreset({ rehypePlugins: [...] })）。remark 改的是「稿子」：标题、段落、代码块；rehype 改的是「排好版的网页」：h2、pre、带颜色的 span。只有要改的东西在 Markdown 里没有、只在最终 HTML 里才出现时才需要写 rehype 插件。钉码放在 remark，我们目前用不到这个位置。',
  }),
  stage({
    title: 'rehypeToc',
    who: 'core',
    srcHl: null,
    srcTone: 'info',
    srcRef: at('mdx/src/config/preset.ts', 116, 123),
    tree: [...HAST, 'export toc'],
    treeTitle: 'HTML 语法树（hast）',
    treeAdded: [9],
    text: '按 h2、h3 生成本页目录，作为 export toc——fumadocs 界面右侧的目录就是它。',
  }),
  stage({
    title: '生成 JS',
    who: 'mdxjs',
    srcHl: null,
    srcTone: 'info',
    tree: EXPORTS,
    treeTitle: '最后交给 Vite 的 JS 模块',
    treeAdded: [],
    treeChanged: [],
    text: '树变成 JS 交回 Vite。每个标签都写成 _components.xxx，渲染时先查站点传进来的组件映射表：fumadocs 的组件、我们的 PinBlock 就是这样接上的。映射表里少了哪个，渲染时直接报错；站点没装钉码插件、<Pin> 原样留到这里，也会报「Pin 没有定义」，不会静默显示空白。',
  }),
]

/** 工序列表的行高：高亮条按它滑动 */
const ROW = 28

/** 中栏：17 道工序，高亮条随当前步平滑滑动（结构稳定 + transform 过渡 = 帧间动画） */
function StationList({ current }: { current: number }): JSX.Element {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 rounded bg-zinc-500/15 transition-transform duration-300 ease-out dark:bg-zinc-400/20"
        style={{ height: ROW, transform: `translateY(${current * ROW}px)` }}
      />
      <ol className="relative m-0 list-none p-0">
        {STATIONS.map((station, index) => (
          <li
            key={station.name}
            className={`flex h-7 items-center gap-1.5 px-1.5 text-[11.5px] ${
              index === current ? 'font-semibold' : index < current ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400 dark:text-zinc-600'
            }`}
          >
            <span className="w-4 shrink-0 text-right tabular-nums opacity-60">{index + 1}</span>
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ background: WHO_DOT[station.who] }} title={WHO_NAME[station.who]} />
            <span className="min-w-0 flex-1 truncate">{station.name}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** 内容变了就整体淡入一次：key 用内容本身，没变的步不重放 */
function FadeOnSwap({ swapKey, children }: { swapKey: string; children: ReactNode }): JSX.Element {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    setShown(false)
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [swapKey])
  return (
    <div key={swapKey} className="transition-opacity duration-300" style={{ opacity: shown ? 1 : 0.25 }}>
      {children}
    </div>
  )
}

export function CompileFlow(): JSX.Element {
  return (
    <Stepper steps={STAGES} interval={6000} label="编译一个 .mdx 的十七道工序">
      {(stageAt, index) => (
        <div className="grid gap-2 md:grid-cols-[1fr_1.1fr_1.3fr]">
          <Pane
            title="install.mdx（原文）"
            icon="file"
            role="slate"
            extra={<span className="text-[10px] text-zinc-500 dark:text-zinc-400">作者写的</span>}
          >
            <CodeLines lines={SOURCE} highlight={stageAt.srcHl} tone={stageAt.srcTone} />
          </Pane>
          <Pane title="工序" icon="terminal" role="blue">
            <StationList current={index} />
          </Pane>
          <Pane
            title={stageAt.treeTitle}
            icon="git"
            role={stageAt.who === 'ours' ? 'rose' : stageAt.who === 'mdx' ? 'blue' : 'emerald'}
            extra={
              stageAt.srcRef ? (
                <a href={stageAt.srcRef.url} target="_blank" rel="noreferrer" className="text-[10px] text-zinc-500 hover:text-blue-500 dark:text-zinc-400">
                  {stageAt.srcRef.file} ↗
                </a>
              ) : (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-600">@mdx-js/mdx 内部 / 示意代码</span>
              )
            }
          >
            <FadeOnSwap swapKey={stageAt.tree.join('\n')}>
              {stageAt.tree.length > 0 ? (
                <CodeLines lines={stageAt.tree} added={stageAt.treeAdded} changed={stageAt.treeChanged} />
              ) : (
                <p className="m-0 text-xs text-zinc-400 dark:text-zinc-600">等下一步。</p>
              )}
            </FadeOnSwap>
          </Pane>
        </div>
      )}
    </Stepper>
  )
}
