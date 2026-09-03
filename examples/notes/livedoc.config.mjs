/**
 * 记事本项目怎么挂机制：一个格式包（fumadocs 口味的 mdx，不起站也能 check / confirm），文档在 docs/，
 * 比较器不写就是 auto——src/ 和 config.json 在仓里、已提交，走 git 记忆。
 */
import * as fumadocs from "@god-live-doc/format-fumadocs";

export default {
  formats: [fumadocs],
  docs: "docs",
  out: "out",
};
