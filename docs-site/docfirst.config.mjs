/**
 * 这个项目的 docfirst 配置：用哪个格式、生成物写到哪、组件名册是什么。命令行和站读的是同一份。
 *
 * 项目根是这个站目录，引用的代码在工作区的 packages/ 与 plugins/ 下，所以引用里写 `../packages/…` 或 `../plugins/…`。
 * 分区按约定：content/ 下 trajectory/ 与 future/ 两个名字固定，其余目录都是现状区、都进 check；
 * 本站的现状区只有 content/docs。
 * outputs：仓根 README.md / AGENTS.md / CLAUDE.md 和插件里的几份 SKILL.md 是生成物，正本是下面映射左边的 mdx
 * （AGENTS 的正本在 content/docs/maintain/agents.mdx，其余在 content/docs/outputs/）——
 * 改 mdx 源要跑 `pnpm docfirst render`（`confirm` 也会顺带做），两份一起提交，check 检查生成物跟源是否一致。
 * CLAUDE.md 第一行固定是 `@AGENTS.md`，只给 Claude 的指令写在它后面。
 * formats 是命令行认的文档格式（mdx，来自 docfirst-workflow）。
 * 组件名册：先展开 fumadocsRoster（fumadocs 自带的 Files / Folder / File 与 Note 的压平规则，纯数据，命令行也能加载），
 * 再加站里自己定义的组件和它们转成机读文本的规则。组件的 React 实现在 src/components/mdx.tsx。
 * 星轨盘不在名册里：它是一条独立的整页路由 /trajectory，不在 mdx 里用。
 */
import * as mdx from "@godcreator/docfirst-workflow/mdx";
import { fumadocsRoster } from "@godcreator/docfirst-fumadocs/roster";
import * as tabs from "./src/components/tabs/tabs.ai.mjs";
import * as pin from "./src/components/pin/pin.ai.mjs";
import * as pinGlance from "./src/components/pin-glance/glance.ai.mjs";
import * as seamMap from "./src/components/seam-map/seam-map.ai.mjs";
import * as renderFlow from "./src/components/render-flow/render-flow.ai.mjs";
import * as refKinds from "./src/components/ref-kinds/ref-kinds.ai.mjs";
import * as spanFollow from "./src/components/span-follow/span-follow.ai.mjs";
import * as commitGate from "./src/components/commit-gate/commit-gate.ai.mjs";
import * as trajectoryFlow from "./src/components/trajectory-flow/trajectory-flow.ai.mjs";
import * as boundaryRules from "./src/components/boundary-rules/boundary-rules.ai.mjs";

/**
 * 一份 skill 的生成位置：正本是 `content/docs/outputs/skills/<名>.mdx`，生成到**插件**里那份 SKILL.md。
 * 对象写法指定 name / description 两个 frontmatter 字段保留到生成物里——宿主靠这两个字段决定什么时候读
 * 这份 skill，去掉 frontmatter 生成出去，就是一份永远不会被触发的普通文档。
 *
 * 正本存放在这个站、生成物存放在插件里：讲**包与插件**行为的那几份（docfirst 站怎么写、轨迹卡怎么记、插件怎么用、
 * 两种建站命令建出来的站怎么写成讲清原理的网页）跟代码在同一个仓才改得动；讲**通用开发纪律**的那三份不描述任何代码，
 * 但要跟钉码与分区的写法保持一致，也要在同一个仓才检查得了，所以正本都在这儿。生成物却不能放进包：包装在 node_modules 里，没有任何说明指向它，
 * agent 不会去读；agent 能读到这些 skill，全靠插件 `register` 了自己包里的 `skills/` 目录。
 */
const skill = (name) => ({ to: `../plugins/docfirst/skills/${name}/SKILL.md`, frontmatter: ["name", "description"] });

export default {
  formats: [mdx],
  outputs: {
    "content/docs/outputs/readme.mdx": ["../README.md"],
    "content/docs/maintain/agents.mdx": ["../AGENTS.md"],
    "content/docs/outputs/claude.mdx": ["../CLAUDE.md"],
    "content/docs/outputs/skills/docfirst.mdx": [skill("docfirst")],
    "content/docs/outputs/skills/docfirst-docs.mdx": [skill("docfirst-docs")],
    "content/docs/outputs/skills/docs-site.mdx": [skill("docs-site")],
    "content/docs/outputs/skills/trajectory.mdx": [skill("trajectory")],
    "content/docs/outputs/skills/spec-grill.mdx": [skill("spec-grill")],
    "content/docs/outputs/skills/parallel-by-module.mdx": [skill("parallel-by-module")],
    "content/docs/outputs/skills/docs-governance.mdx": [skill("docs-governance")],
  },
  components: {
    ...fumadocsRoster,
    Tabs: tabs.Tabs,
    Tab: tabs.Tab,
    // 术语标注：自动标出的术语是构建时生成的，不写进源文件，命令行看不到。这条规则管作者
    // 手写的术语标注——机读版里只保留术语原词，不保留样式
    Term: "children",
    // 自包含的讲解组件：规则读组件自己的讲解数据，把每一步、每一条写成段落
    PinGlance: pinGlance.PinGlance,
    PinStory: pin.PinStory,
    PinJudge: pin.PinJudge,
    SeamMap: seamMap.SeamMap,
    RenderFlow: renderFlow.RenderFlow,
    RefKinds: refKinds.RefKinds,
    SpanFollow: spanFollow.SpanFollow,
    CommitGate: commitGate.CommitGate,
    TrajectoryFlow: trajectoryFlow.TrajectoryFlow,
    BoundaryRules: boundaryRules.BoundaryRules,
  },
};
