/**
 * 这个项目怎么挂机制：用哪个格式、哪几区进 check、卡目录在哪、生成物摆哪、组件名册是什么。
 * 命令行和站读的是同一份。
 *
 * 项目根是这个站目录，引用的代码在工作区的 packages/ 下，所以记号里写 `../packages/…`——
 * 读取器按项目根拼路径，git 那头 `HEAD:<路径>` 会自己翻成仓根相对。
 * 六区里只有 docs（现状）与 outputs（生成正本）进 check——只有这两区对代码说话；
 * 轨迹、交接、未来、反馈四区的草稿记号与卡天然不进门禁。
 * 名册：默认表展开，再加站里自己定义的组件和它们的压平规则。React 那半在 src/components/mdx.tsx。
 * 星轨盘不在名册里：盘是一条独立的整页路由 /trajectory，不进 mdx。
 * trajectory：卡目录是站自己的 content/trajectory/（跟 source.config.ts 里卡集合的 dir 是同一处），
 * check 顺带跑卡校验。本仓自己的卡由人写。
 */
import * as fumadocs from "@godcreator/docfirst-workflow/fumadocs";
import * as tabs from "./src/components/tabs/tabs.ai.mjs";

/**
 * 一份 skill 的落点：正本是 `content/outputs/skills/<名>.mdx`，摆进**件**里那份 SKILL.md。
 * 对象写法点名 name / description 两条 frontmatter 随行——宿主靠这两条决定什么时候读这份 skill，
 * 剥光了摆出去就是一份没人会触发的散文。
 *
 * 正本住这个站、生成物住件：讲**包**行为的那几份（文档怎么写、卡怎么记）同仓才改得动，
 * 讲**通用开发纪律**的那三份不描述任何代码、但要跟钉码与六区的写法对得上号，也同仓才守得住，
 * 所以正本都在这儿；但**包没有独立的到达路径**——它躺在 node_modules 里没人指引、没人会读，
 * 能被 agent 读到全靠件 `register` 了自己包里那个 `skills/` 目录。
 */
const skill = (name) => ({ to: `../packages/gwb-docfirst-workflow/skills/${name}/SKILL.md`, frontmatter: ["name", "description"] });

export default {
  formats: [fumadocs],
  docs: ["content/docs", "content/outputs"],
  out: "out",
  comparator: "git",
  trajectory: "content/trajectory",
  outputs: {
    "content/outputs/readme.mdx": ["../README.md"],
    "content/docs/maintain/agents.mdx": ["../AGENTS.md"],
    "content/outputs/skills/docfirst-docs.mdx": [skill("docfirst-docs")],
    "content/outputs/skills/trajectory.mdx": [skill("trajectory")],
    "content/outputs/skills/spec-grill.mdx": [skill("spec-grill")],
    "content/outputs/skills/parallel-by-module.mdx": [skill("parallel-by-module")],
    "content/outputs/skills/docs-governance.mdx": [skill("docs-governance")],
  },
  components: {
    ...fumadocs.defaultRoster,
    Tabs: tabs.Tabs,
    Tab: tabs.Tab,
    // 术语标注：自动标出来的那些是构建期长的，不进源文件、命令行看不到。这条规则给作者
    // 手写的那种——机读版里只留术语原词，装饰不带过去
    Term: "children",
  },
};
