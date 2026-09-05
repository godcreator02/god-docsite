/**
 * 这个项目怎么挂机制：用哪些格式包、文档在哪、比较器用哪个、组件名册是什么。命令行和站读的是同一份。
 *
 * 项目根是这个站目录，引用的代码在工作区的 packages/ 下，所以记号里写 `../packages/…`——
 * 读取器按项目根拼路径，git 那头 `HEAD:<路径>` 会自己翻成仓根相对。
 * 名册：默认表展开，再加站里自己定义的组件和它们的压平规则。React 那半在 src/components/mdx.tsx。
 * outputs：README 和单元根 AGENTS.md 是生成物，正本在 maintain 下那两篇 mdx，render 摆过去。
 * trajectory：卡目录在单元根（跟 source.config.ts 里卡集合的 dir 是同一处），check 顺带跑卡校验。
 * 本仓自己的卡由人写，目录现在还空着——「配了但没有卡」扫出来是空集合，不红。
 */
import * as fumadocs from "@godcreator02/live-doc-format-fumadocs";
import * as tabs from "./src/components/tabs/tabs.ai.mjs";

export default {
  formats: [fumadocs],
  docs: "content/docs",
  out: "out",
  comparator: "git",
  trajectory: "../../docs-god-flow/trajectory",
  outputs: {
    "content/docs/maintain/readme.mdx": ["../README.md"],
    "content/docs/maintain/agents.mdx": ["../../AGENTS.md"],
  },
  components: {
    ...fumadocs.defaultRoster,
    Tabs: tabs.Tabs,
    Tab: tabs.Tab,
    // 星轨盘是交互式画布，AI 那份 md 里画不出，压成一行指路
    Trajectory: (_node, h) => h.paragraph("[星轨盘见站]"),
  },
};
