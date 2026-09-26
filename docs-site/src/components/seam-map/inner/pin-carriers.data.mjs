/**
 * 在途方案「钉码的第二种载体：讲解组件」里做完之后的接缝图：<SeamMap module="pin-carriers" /> 画的就是它。
 * 框是做完之后的模块（包或 workflow 里的目录），方块是它对外给的函数；灰色实线框是调用方与实现方。
 * 坐标在 pin-carriers.layout.ts。方案落地后这张图删掉，现状改画在钉码核心与 workflow 的模块页上。
 */
import { defineSeamGraph } from '../graph.mjs';

export const pinCarriersGraph = defineSeamGraph({
  id: 'pin-carriers',
  title: '钉码有两种载体之后的模块与接缝',
  intro:
    '钉码有两种载体之后的接缝图：虚线框是做完之后的模块，框里的方块是它对外给的函数，灰色实线框是调用方与实现方。mdx 页面与讲解组件的源码各是一种格式，共用同一套记号写法，钉码核心不变。',
  frameLabel: '模块',
  modules: [
    {
      id: 'callers',
      name: '调用方',
      pkg: 'workflow 命令行 · fumadocs 适配',
      role: null,
      outside: true,
      blurb: '命令行的 check、confirm 逐个处理现状区的文件，mdx 页面和组件源码都在里面；站构建时 remark 插件只处理 mdx 页面。',
      caps: [
        { id: 'cli', name: '命令行', ident: 'check · confirm · render' },
        { id: 'remark', name: '站构建', ident: 'remarkDocfirst' },
      ],
    },
    {
      id: 'pinning',
      name: '钉码编排',
      pkg: 'docfirst-workflow · src/pinning/',
      role: 'blue',
      outside: false,
      blurb:
        '一个文件的核对与确认在这里串起来：按文件类型挑格式，交给格式认出引用，把每处的目标和记录交给钉码核心，确认时把新记录交回格式写回。它不知道记号长什么样。',
      caps: [
        { id: 'check-doc', name: '核对一个文件', ident: 'checkDoc' },
        { id: 'confirm-doc', name: '确认一个文件', ident: 'confirmDoc' },
        { id: 'format-of', name: '挑格式', ident: 'formatOf' },
        { id: 'check-refs', name: '核对认好的引用', ident: 'checkReferences' },
      ],
    },
    {
      id: 'mdx',
      name: 'mdx 格式',
      pkg: 'docfirst-workflow · src/mdx/',
      role: 'violet',
      outside: false,
      blurb:
        '认领 .mdx 页面。在语法树上认出单独一行的花括号注释 {/* … */}，写回时整行换成带着新记录的记号。名册检查、按原文渲染生成物也只对 mdx。',
      caps: [
        { id: 'recognize', name: '认引用', ident: 'parse · recognize' },
        { id: 'write', name: '写回', ident: 'write' },
      ],
    },
    {
      id: 'code',
      name: '组件格式',
      pkg: 'docfirst-workflow · src/code/',
      role: 'cyan',
      outside: false,
      blurb:
        '认领站的 src/components/ 下的 .ts、.tsx、.mjs。认出单独一行的块注释 /* … */，写回时整行换掉。不解析 TypeScript：记号就是一行注释，按行认、按行写。',
      caps: [
        { id: 'code-parse', name: '认引用', ident: 'parse' },
        { id: 'code-write', name: '写回', ident: 'write' },
      ],
    },
    {
      id: 'marker',
      name: '记号写法',
      pkg: 'docfirst-workflow · src/marker/',
      role: 'amber',
      outside: false,
      blurb:
        '注释里那一截文字怎么写、怎么解析回目标与记录，两种格式共用：动作词加 key="value" 属性，没有记录属性就是未确认。只剩这一种写法，没有草稿。',
      caps: [{ id: 'formal', name: '记号', ident: 'formalOf · parseFormal' }],
    },
    {
      id: 'core',
      name: '钉码核心',
      pkg: '@godcreator/docfirst-pin',
      role: 'emerald',
      outside: false,
      blurb: '不变：只收「目标 + 记录」，核对交回状态，确认交回新记录；不认识文件、记号和格式。',
      caps: [
        { id: 'check', name: '核对', ident: 'check' },
        { id: 'confirm', name: '确认', ident: 'confirm' },
      ],
    },
    {
      id: 'impl',
      name: '项目装配',
      pkg: 'docfirst-workflow · src/project/',
      role: null,
      outside: true,
      blurb: '列出现状区的文件，造出读取器与 git 历史交给钉码核心。',
      caps: [
        { id: 'docs', name: '现状区文件', ident: 'docs()' },
        { id: 'reader', name: '读取器', ident: 'createReader' },
        { id: 'history', name: 'git 历史', ident: 'createGitHistory' },
      ],
    },
  ],
  entries: [],
  seams: [
    {
      n: 1,
      name: '核对与确认一个文件',
      a: ['cli', 'remark'],
      b: ['check-doc', 'confirm-doc', 'check-refs'],
      iface: 'checkDoc(file, text) → Listing；confirmDoc(file, text, { accept }) → ConfirmResult；checkReferences(file, references) → Listing',
      convention: false,
      via: 'code',
      text: '命令行对现状区的每个文件调 checkDoc / confirmDoc，mdx 页面和组件源码走同一个入口；站构建已经在语法树上认好了引用，调 checkReferences。',
    },
    {
      n: 2,
      name: 'mdx 格式',
      a: ['format-of'],
      b: ['recognize', 'write'],
      iface: 'Format：claims(file) / parse(text) → Reference[] / write(text, written) → text',
      convention: false,
      via: 'code',
      text: '.mdx 交给 mdx 格式：认出花括号注释里的记号与它在第几行，确认后只重写那几行。',
    },
    {
      n: 3,
      name: '组件格式',
      a: ['format-of'],
      b: ['code-parse', 'code-write'],
      iface: 'Format：claims(file) / parse(text) → Reference[] / write(text, written) → text',
      convention: false,
      via: 'code',
      text: 'src/components/ 下的代码文件交给组件格式：认出单独一行的块注释里的记号。两个格式实现同一个接口，一个文件只能有一个格式认领，没有格式认领的文件不进现状区。',
    },
    {
      n: 4,
      name: 'mdx 里的记号',
      a: ['recognize', 'write'],
      b: ['formal'],
      iface: '{/* ${formalOf(target, record)} */}；parseFormal(payload, where)',
      convention: false,
      via: 'code',
      text: 'mdx 格式剥掉 {/* */}，把里面那一截交给记号写法解析；写回时拿记号写法生成的那一截，再包上 {/* */}。',
    },
    {
      n: 5,
      name: '组件里的记号',
      a: ['code-parse', 'code-write'],
      b: ['formal'],
      iface: '/* ${formalOf(target, record)} */；parseFormal(payload, where)',
      convention: false,
      via: 'code',
      text: '组件格式剥掉 /* */，里面那一截跟 mdx 里的一字不差；同一条引用在两种载体里只有外壳不同。',
    },
    {
      n: 6,
      name: '钉码',
      a: ['check-doc', 'confirm-doc', 'check-refs'],
      b: ['check', 'confirm'],
      iface: 'check(pins) → Verdict[]；confirm(verdicts, { accept }) → Step[]',
      convention: false,
      via: 'code',
      text: '不变：编排把每处剥成目标与记录交给钉码核心，结果按顺序配回文件与行号。',
    },
    {
      n: 7,
      name: '读取与旧内容',
      a: ['check', 'confirm'],
      b: ['reader', 'history'],
      iface: 'Reader：read / list；History：oldText / hunks',
      convention: false,
      via: 'code',
      text: '不变：钉码核心要看的文件内容、确认时的旧内容都从项目装配造的这两样来。',
    },
    {
      n: 8,
      name: '现状区文件',
      a: ['cli'],
      b: ['docs'],
      iface: 'project.docs() → 内容根下 trajectory/、future/ 之外的 .mdx ＋ src/components/ 下的 .ts / .tsx / .mjs',
      convention: true,
      via: 'disk',
      text: '现状区按约定多出一块：站的 src/components/ 下的代码文件也进 check。组件里挂的引用变黄，跟页面里的一样算数，本仓未提交改动引起的黄照样拦提交。',
    },
  ],
});
