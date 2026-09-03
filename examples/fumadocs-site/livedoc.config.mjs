/**
 * 外部消费方怎么挂机制：一个格式包（fumadocs 口味的 mdx）、文档在 content/docs、比较器用 git。
 * 名册是这个站自己的：默认表展开，再加站里定义的 Tabs / Tab 和它们的压平规则。
 * 规则只用 helpers、不碰节点字段——所以这份规则文件跟 god-live-doc 自己那个站里的是逐字节一样的。
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
