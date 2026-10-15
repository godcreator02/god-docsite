/**
 * 这个项目的 docfirst 配置：命令行 docfirst（check / confirm / render / trajectory）读它，项目根是站点目录。
 *
 * content：内容根。下面的 future/ 是未来区、不进核对，其余目录都是现状区、都进 check。
 * outputs：仓根（站点目录的上一级）的 README.md / AGENTS.md / CLAUDE.md 是生成物，正本是映射左边的 mdx——
 * 改了正本运行 `pnpm doc:render`，两份放进同一个提交，`pnpm doc` 检查生成物跟正本是否一致。
 * CLAUDE.md 第一行固定是 `@AGENTS.md`，只给 Claude 的指令写在它后面。
 * fumadocsRoster 与 components：组件名册。fumadocsRoster 放进 fumadocs 自带的 Note、Files、Folder、File 的机读规则，
 * components 再加站里的组件；站里自己加组件，就在 components 里给它加一条机读规则（怎么写见 skill「docs-writing」）。
 * trajectory：轨迹卡放在站点根下的 trajectory/，站点的卡集合（app/features/trajectory/mdx.ts）读同一个目录。
 * 术语表不在这里：它是站点根的 glossary.json，由站点的 source.config.ts 交给术语标注插件。
 */
export default {
  content: "content",
  outputs: {
    "content/docs/outputs/readme.mdx": ["../README.md"],
    "content/docs/outputs/agents.mdx": ["../AGENTS.md"],
    "content/docs/outputs/claude.mdx": ["../CLAUDE.md"],
  },
  fumadocsRoster: true,
  components: {
    // 手写的术语标注：机读版里只留术语原词
    Term: "children",
  },
  trajectory: "trajectory",
};
