/**
 * 这个站的术语表——**正本就是这份数据**：页面上标出来的词、鼠标移上去看到的那句定义，
 * 全从这儿来。docfirst.config.mjs 的 glossary 指向这个文件，构建页面时功能包 docfirst-site 的 remark 插件按它标注；改词改这里。
 *
 * 收词的判据（正本是随工作台插件发的 skill「docs-writing」，这儿只记结论）：
 *   收 这个项目自己造的词、通用词在这里有特定含义的、外来框架里读者最容易卡住的词
 *   不收 通用编程词，不收单字词——单字词会命中一切，建索引那一步会直接报错
 *
 * **定义里不写会变的东西**：函数名、路径、行号、配置项一律不进。这份数据钉不住
 * （它既不是 mdx 页面，也不在讲解组件的目录下，引用管不到它），写进来就会悄悄过时。具体的名字留给 `href` 指的那一页，
 * 在那儿钉。`href` 一律指本站真实存在的页。
 */
/** @type {import("@godcreator/docfirst-workflow/fumadocs").TermEntry[]} */
export const terms = [
  {
    term: "引用",
    aliases: ["reference"],
    def: "文档里一句论断跟一段真实源码之间的绑定。代码变了，这句话旁边就变色——文档跟代码不符会当场看出来。",
    href: "/docs/pin/markers",
  },
  {
    term: "记号",
    def: "代表一条引用、单独占一行的注释，写在文档页面里，也可以写在讲解组件的源码里。人手写时只写目标属性，是未确认；确认时在同一行添上记录属性。",
    href: "/docs/pin/markers",
  },
  {
    term: "投影",
    aliases: ["投影块"],
    def: "引用在页面上显示出来的那块内容。它不是抄进文档的副本，是构建时现从源码读出来的。",
    href: "/docs/pin/judge",
  },
  {
    term: "状态点",
    def: "每条引用旁边那个小圆点：绿是新鲜，实心黄是代码变了待复核，空心是还没确认，红是指向的东西不在了。",
    href: "/docs/pin/judge",
  },
  {
    term: "比较器",
    aliases: ["comparator"],
    def: "判断被钉住的那段代码有没有变过的那套办法：先比这段内容的 hash，再取出确认时的整份文件、跟着改动找这段今天在哪；取不到旧内容就在整个文件里找 hash 相同的那段。",
    href: "/docs/pin/git",
  },
  {
    term: "钉码核心",
    def: "只收「钉的是什么」和「确认时记下了什么」、交回每处状态的那一块。它不接触文档文本，记号长什么样、在第几行都不归它管。",
    href: "/docs/pin",
  },
  {
    term: "钉码编排",
    def: "一个文件核对与确认的先后顺序：先按文件挑格式、认出引用，再交给钉码核心判定，最后把新记录写回记号那一行。命令行和站构建都经它。",
    href: "/docs/workflow",
  },
  {
    term: "现状区",
    def: "文档站内容目录下写「此刻是什么」的那些目录。除了轨迹与未来两个固定名字，其余目录都是现状区，全部由核对检查；站里讲解组件的源码也算。",
    href: "/docs",
  },
  {
    term: "生成正本",
    def: "README、AGENTS.md、SKILL.md 这类生成物的 mdx 源，放在现状区里。改正本再重新渲染；直接改生成物，下一次渲染就被覆盖。",
    href: "/docs/workflow/rendering",
  },
  {
    term: "名册",
    aliases: ["roster"],
    def: "站里用到的自定义组件，以及它们放进生成物时该转成什么文字的那张表。生成正本里用了表外的组件，核对与渲染会报错。",
    href: "/docs/workflow",
  },
  {
    term: "机读文字",
    def: "组件放进生成物（README、AGENTS、SKILL.md 这些给 AI 读的文件）时换成的文字，由名册里的规则给出；引用投影成带来源行的代码。",
    href: "/docs/workflow/rendering",
  },
  {
    term: "轨迹卡",
    def: "一次方向决定的记录：此路不通、转向、被取代、确定采纳。写下来就不再改，不钉还在变的代码。",
    href: "/docs/trajectory/flow",
  },
  {
    term: "星轨盘",
    def: "一个站的全部轨迹卡画成的一张图：唯一那张根卡在盘心，其余的卡按日期排在同心环上，点一个节点进那张卡。",
    href: "/docs/trajectory/flow",
  },
  {
    term: "病卡",
    aliases: ["报病"],
    def: "卡格式检查时查出问题的轨迹卡：字段写错、关系指向盘外或指向根卡、卡里钉了码这类。有病但画得出来的卡照样画上星轨盘；核对时每条病算一处红，星轨盘页顶栏的「报病」数是有病的卡有几张。",
    href: "/docs/trajectory/flow",
  },
  {
    term: "remark",
    def: "把 markdown 解析成语法树、允许插件改这棵树的那套工具链。这套机制接入站，就是往它的插件链上加插件。",
    href: "/docs/fumadocs",
  },
  {
    term: "fumadocs",
    def: "这个站用的文档框架，经文档站基础包用它的 React Router 版本。它管导航、搜索、页面排版，docfirst 只往它编译页面的过程里加 remark 插件。",
    href: "/docs/fumadocs",
  },
];
