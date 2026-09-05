/**
 * 外部消费方怎么挂机制：一个格式包（fumadocs 口味的 mdx）、文档在 content/docs、比较器用 git。
 * 名册用格式包的默认表——这个站没有自定义组件，只多了画布组件 Trajectory 的压平规则。
 */
import * as fumadocs from "@godcreator02/live-doc-format-fumadocs";

export default {
  formats: [fumadocs],
  docs: "content/docs",
  out: "out",
  comparator: "git",
  components: {
    ...fumadocs.defaultRoster,
    // 星轨盘是交互式画布，AI 那份 md 里画不出，压成一行指路
    Trajectory: (_node, h) => h.paragraph("[星轨盘见站]"),
  },
};
