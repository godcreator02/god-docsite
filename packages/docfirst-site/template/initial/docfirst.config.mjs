/**
 * 这个项目的 docfirst 配置：生成物写到哪、组件名册是什么。命令行和站读的是同一份。
 *
 * 分区按约定：content/ 下 future/ 是未来区，其余目录都是现状区、都进 check。
 * outputs：项目根（站目录的上一级）的 README.md / AGENTS.md / CLAUDE.md 是生成物，正本是下面映射左边的 mdx——
 * 改 mdx 源要运行 `pnpm docfirst render`（`doc:confirm` 也会顺带做），两份一起提交，`pnpm doc` 检查生成物跟源是否一致。
 * CLAUDE.md 第一行固定是 `@AGENTS.md`，只给 Claude 的指令写在它后面。
 * 组件名册：fumadocs 自带的 Files / Folder / File 与手写术语标注 Term；站内自己加组件就给它在名册里加一条
 * 机读规则（怎么加见随工作台插件发的 skill「docs-writing」）。
 * trajectory：轨迹卡放在站点根下的 trajectory/（功能包的卡集合读这个目录）。
 * glossary：术语表在 src/glossary.mjs，构建页面时功能包的 remark 插件按它标注术语；skip 里的页不标。
 */
import { fumadocsRoster } from "@godcreator/docfirst-workflow/fumadocs/roster";

export default {
  outputs: {
    "content/docs/outputs/readme.mdx": ["../README.md"],
    "content/docs/outputs/agents.mdx": ["../AGENTS.md"],
    "content/docs/outputs/claude.mdx": ["../CLAUDE.md"],
  },
  components: {
    ...fumadocsRoster,
    Term: "children",
  },
  trajectory: "trajectory",
  glossary: { terms: "src/glossary.mjs", skip: [] },
};
