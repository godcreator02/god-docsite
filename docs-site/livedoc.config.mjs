/**
 * 这个项目怎么挂机制：用哪些格式包、哪几区进 check、卡目录在哪、生成物摆哪、组件名册是什么。
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
import * as fumadocs from "@godcreator02/livedoc/fumadocs";
import * as tabs from "./src/components/tabs/tabs.ai.mjs";

/**
 * 一份 skill 的落点：正本是 `content/outputs/skills/<名>.mdx`，摆进 livedoc 包里那份 SKILL.md。
 * 对象写法点名 name / description 两条 frontmatter 随行——宿主靠这两条决定什么时候读这份 skill，
 * 剥光了摆出去就是一份没人会触发的散文。
 */
const skill = (name) => ({ to: `../packages/livedoc/skills/${name}/SKILL.md`, frontmatter: ["name", "description"] });

export default {
  formats: [fumadocs],
  docs: ["content/docs", "content/outputs"],
  out: "out",
  comparator: "git",
  trajectory: "content/trajectory",
  outputs: {
    "content/outputs/readme.mdx": ["../README.md"],
    "content/docs/maintain/agents.mdx": ["../AGENTS.md"],
    "content/outputs/skills/livedoc-docs.mdx": [skill("livedoc-docs")],
    "content/outputs/skills/trajectory.mdx": [skill("trajectory")],
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
