/**
 * 这个项目怎么挂机制：用哪些格式包、文档在哪、比较器用哪个、组件名册是什么。命令行和站读的是同一份。
 *
 * 项目根是这个站目录，引用的代码在工作区的 packages/ 下，所以记号里写 `../packages/…`——
 * 读取器按项目根拼路径，git 那头 `HEAD:<路径>` 会自己翻成仓根相对。
 * 名册：默认表展开，再加站里自己定义的组件和它们的压平规则。React 那半在 src/components/mdx.tsx。
 */
import * as fumadocs from "@god-live-doc/format-fumadocs";
import * as tabs from "./src/components/tabs/tabs.ai.mjs";

export default {
  formats: [fumadocs],
  docs: "content/docs",
  out: "out",
  comparator: "git",
  components: {
    ...fumadocs.defaultRoster,
    Tabs: tabs.Tabs,
    Tab: tabs.Tab,
  },
};
