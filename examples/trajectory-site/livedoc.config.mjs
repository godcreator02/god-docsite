/**
 * 外部消费方怎么挂机制：一个格式包（fumadocs 口味的 mdx）、文档在 content/docs、比较器用 git。
 * 名册用格式包的默认表——这个站没有自定义组件，盘也不是组件（它是整页路由 /trajectory）。
 * trajectory 指向本站的 cards/（跟 source.config.ts 里卡集合的 dir、盘页读的目录是同一处），
 * `livedoc check` 顺带把这批卡过一遍四层校验。
 */
import * as fumadocs from "@godcreator02/live-doc-format-fumadocs";

export default {
  formats: [fumadocs],
  docs: "content/docs",
  out: "out",
  comparator: "git",
  trajectory: "cards",
  components: {
    ...fumadocs.defaultRoster,
  },
};
