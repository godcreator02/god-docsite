/**
 * 没有构建管线的项目怎么挂机制：两个格式包并存（各认各的后缀），比较器换成 hash。
 *
 * 换成 hash 是为了说明一件事：**记忆怎么记是可换的**。hash 版只记段哈希，不问 git、不跟行段——
 * 代码往下挪了它只会说「有变动」，说不出挪到哪儿了，也拿不回旧内容。
 * 好处是没有「先 commit 再 confirm」这道门，随便一个目录都能用。
 */
import * as md from "@godcreator02/live-doc-format-md";
import * as html from "@godcreator02/live-doc-format-html";

export default {
  formats: [md, html],
  docs: "content/docs",
  out: "out",
  comparator: "hash",
};
