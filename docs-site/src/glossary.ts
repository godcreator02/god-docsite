/**
 * 这个站的术语表——**正本就是这份数据**：页面上标出来的词、鼠标移上去看到的那句定义，
 * 全从这儿来。改词改这里，站构建时自动重标。
 *
 * 收词的判据（正本是随 cli 发的 skill「docfirst-docs」，这儿只记结论）：
 *   收 这个项目自己造的词、通用词在这里有特定含义的、外来框架里读者最容易卡住的词
 *   不收 通用编程词，不收单字词——单字词会命中一切，建索引那一步会当场拒
 *
 * **定义里不写会变的东西**：函数名、路径、行号、配置项一律不进。这份数据钉不住
 * （它不是 mdx，引用管不到它），写进来就会悄悄腐化。具体的名字留给 `href` 指的那一页，
 * 在那儿钉。`href` 一律指本站真实存在的页。
 */
import type { TermEntry } from "@godcreator02/docfirst-workflow/fumadocs";

export const terms: TermEntry[] = [
  {
    term: "引用",
    aliases: ["reference"],
    def: "文档里一句论断跟一段真实源码之间的绑定。代码变了，这句话旁边就变色——文档撒谎会当场现形。",
    href: "/docs/modules/core",
  },
  {
    term: "记号",
    def: "写在 mdx 里、代表一条引用的那一行。两态：人手写的草稿态，和确认之后机器写回的正式态。",
    href: "/docs/modules/core",
  },
  {
    term: "投影",
    aliases: ["投影块"],
    def: "引用在页面上显示出来的那块内容。它不是抄进文档的副本，是构建时从源码现拿的。",
    href: "/docs/start/lifecycle",
  },
  {
    term: "状态点",
    def: "每条引用旁边那个小圆点：绿是新鲜，实心黄是代码变了待复核，空心黄是还没确认，红是指向空气。",
    href: "/docs/modules/core",
  },
  {
    term: "比较器",
    aliases: ["comparator"],
    def: "判断被钉住的那段代码有没有变过的那套办法。有 git 的仓靠提交历史比，没有的退回按内容摘要比。",
    href: "/docs/modules/project",
  },
  {
    term: "格式包",
    def: "把一种文档格式接进这套机制的那个包。认记号、写回记号都归它，换一种格式就是换一个包。",
    href: "/docs/modules/format-md",
  },
  {
    term: "名册",
    aliases: ["roster"],
    def: "站里用到的自定义组件，以及它们在机读版里该压平成什么样的那张表。表外的组件会硬失败。",
    href: "/docs/modules/format-fumadocs",
  },
  {
    term: "机读版",
    def: "同一篇文档给 AI 读的那个出口：代码现拿、带来源行，喂进上下文就能用。跟站上那份是同一份内容的两种投影。",
    href: "/docs/modules/cli",
  },
  {
    term: "轨迹卡",
    def: "一次方向了断的记录：走死了、转向了、被取代、拍板采纳。写下来就冻结，不钉活代码。",
    href: "/docs/modules/trajectory",
  },
  {
    term: "星轨盘",
    def: "把全部轨迹卡摆成一张图的那一页，点一个节点进那张卡。",
    href: "/docs/modules/trajectory",
  },
  {
    term: "remark",
    def: "把 markdown 解析成语法树、允许插件改这棵树的那套工具链。这套机制接站，就是往它的链上挂插件。",
    href: "/docs/start/wiring",
  },
  {
    term: "fumadocs",
    def: "这个站用的文档框架，跑在 Next 上。它管导航、搜索、页面排版，这套机制只往它的管线上挂东西。",
    href: "/docs/modules/format-fumadocs",
  },
];
