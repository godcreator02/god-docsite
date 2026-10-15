/**
 * 这个项目的 docfirst 配置：命令行 docfirst（check / confirm / render / trajectory）读它，项目根是这个站目录。
 *
 * 引用的代码在工作区的 packages/ 与 plugins/ 下，所以引用里写 `../packages/…` 或 `../plugins/…`。
 * content：内容根。下面除 future/ 外的目录都是现状区、都进 check，外加 src/components/ 下讲解组件的源码。
 * outputs：仓根 README.md / CLAUDE.md 与插件里的几份 SKILL.md 是生成物，正本是下面映射左边的 mdx
 * （都在 content/docs/outputs/）；AGENTS.md 是手写的正本，不在 outputs 里——
 * 改 mdx 正本要运行 `pnpm doc:render`（`doc:confirm` 也会顺带做），两份放进同一个提交，`pnpm doc` 检查生成物跟正本是否一致。
 * CLAUDE.md 第一行固定是 `@AGENTS.md`，只给 Claude 的指令写在它后面。
 * fumadocsRoster 与 components：组件名册，只管生成正本里用到的组件。fumadocsRoster 放进 fumadocs 自带的 Note、Files、Folder、File 的机读规则，
 * components 再加站里的；生成正本里要用站内组件，就在这里给它加一条机读规则。
 * trajectory：轨迹卡放在站点根下的 trajectory/，站点的卡集合（app/features/trajectory/mdx.ts）读同一个目录。
 * 术语表不在这里：它是站点根的 glossary.json，不标术语的页写在站点的 app/lib/mdx-plugins.ts。
 */

/**
 * 一份 skill 的生成位置：正本是 `content/docs/outputs/skills/<名>.mdx`，生成到**插件**里那份 SKILL.md。
 * 对象写法指定 name / description 两个 frontmatter 字段保留到生成物里——宿主靠这两个字段决定什么时候读
 * 这份 skill，去掉 frontmatter 生成出去，就是一份永远不会被触发的普通文档。
 */
const skill = (name) => ({ to: `../plugins/docfirst/skills/${name}/SKILL.md`, frontmatter: ["name", "description"] });

export default {
  content: "content",
  outputs: {
    "content/docs/outputs/readme.mdx": ["../README.md"],
    "content/docs/outputs/claude.mdx": ["../CLAUDE.md"],
    "content/docs/outputs/skills/docs-site.mdx": [skill("docs-site")],
    "content/docs/outputs/skills/docs-writing.mdx": [skill("docs-writing")],
    "content/docs/outputs/skills/trajectory.mdx": [skill("trajectory")],
    // gwb-collab 随包发布的说明书：主文件与三份附件
    "content/docs/outputs/skills/collab/index.mdx": [
      { to: "../plugins/collab/skills/collab/SKILL.md", frontmatter: ["name", "description"] },
    ],
    "content/docs/outputs/skills/collab/collab-repo.mdx": ["../plugins/collab/skills/collab/references/collab-repo.md"],
    "content/docs/outputs/skills/collab/other-repos.mdx": ["../plugins/collab/skills/collab/references/other-repos.md"],
    "content/docs/outputs/skills/collab/organization.mdx": ["../plugins/collab/skills/collab/references/organization.md"],
  },
  fumadocsRoster: true,
  components: {
    // 手写的术语标注：机读版里只保留术语原词，不保留样式
    Term: "children",
    // 只有装饰作用的分隔线，md 里整个去掉
    Divider: "drop",
  },
  trajectory: "trajectory",
};
