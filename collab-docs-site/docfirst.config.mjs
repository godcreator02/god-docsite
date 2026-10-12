/**
 * docfirst 配置：命令行和站读的是同一份。项目根是这个站目录，被引用的代码在仓根，引用写 `../packages/…` 或 `../plugins/…`。
 *
 * content 是各区的上一级目录。它下面只有两个名字是固定的：`trajectory/` 是轨迹卡目录，
 * `future/` 是未来区（路线、在途方案 `future/spec/`、别的仓投来的反馈 `future/inbox/`）。
 * 其余目录都是现状区，全部进 check；本站的现状区按包分成 `content/docs/`（总览）、`content/collab-model/`（数据模型包）、`content/collab-site/`（功能包）、`content/collab-merge-check/`（合并检查包）、
`content/gwb-collab/`（插件）、`content/gitea/`（在 Gitea 与 NAS 上配的部分）与 `content/cases/`（跨包的使用案例），外加 `src/components/` 下讲解组件的源码。
 *
 * outputs 把正本映射到生成物：gwb-collab 随包发布的说明书 collab（主文件 plugins/collab/skills/collab/SKILL.md
 * 与附件 references/{collab-repo,other-repos,organization}.md）由 `content/docs/outputs/` 下的 mdx 生成。
 * 改正本后运行 `pnpm doc:render`，正本与生成物放进同一个提交，check 检查两者一致。SKILL.md 要保留 name / description 两个 frontmatter 字段：
 * 宿主靠它们决定什么时候读这份说明书；附件不带 frontmatter，经 skill.read 的 file 参数读。
 * 仓根 README.md / AGENTS.md / CLAUDE.md 三件套的生成暂缓：本站自 collab-site 仓搬入后，仓根三件套归 docsite-kit 仓
 * （AGENTS 是仓规正本，README 是 docfirst 的说明），三仓仓规合一与正本归属等两个 docfirst 站合并的后续任务定，
 * 定了再恢复映射；这三份正本 mdx 仍留在 content/docs/outputs/ 下。
 *
 * components 是组件名册：fumadocsRoster 给 fumadocs 自带文件树 Files / Folder / File 与 Note 的机读规则，
 * 站里自己的讲解组件在它后面追加。讲解组件的规则读组件自己的讲解数据，把每一步、每一种情况写成段落。
 */
import { fumadocsRoster } from '@godcreator/docfirst-workflow/fumadocs/roster'
import * as seamMap from './src/components/seam-map/seam-map.ai.mjs'
import * as submitScenarios from './src/components/submit-scenarios/submit-scenarios.ai.mjs'
import * as recordMerge from './src/components/record-merge/record-merge.ai.mjs'
import * as writeRule from './src/components/write-rule/write-rule.ai.mjs'
import * as autoMerge from './src/components/auto-merge/auto-merge.ai.mjs'
import * as pushFlow from './src/components/push-flow/push-flow.ai.mjs'
import * as repoModes from './src/components/repo-modes/repo-modes.ai.mjs'

export default {
  content: 'content',
  outputs: {
    // 三件套映射暂缓（原因见文件头注释），站合并定归属后恢复：
    // 'content/docs/outputs/readme.mdx': ['../README.md'],
    // 'content/docs/outputs/agents.mdx': ['../AGENTS.md'],
    // 'content/docs/outputs/claude.mdx': ['../CLAUDE.md'],
    'content/docs/outputs/skills/collab/index.mdx': [
      { to: '../plugins/collab/skills/collab/SKILL.md', frontmatter: ['name', 'description'] },
    ],
    'content/docs/outputs/skills/collab/collab-repo.mdx': ['../plugins/collab/skills/collab/references/collab-repo.md'],
    'content/docs/outputs/skills/collab/other-repos.mdx': ['../plugins/collab/skills/collab/references/other-repos.md'],
    'content/docs/outputs/skills/collab/organization.mdx': ['../plugins/collab/skills/collab/references/organization.md'],
  },
  components: {
    ...fumadocsRoster,
    SeamMap: seamMap.SeamMap,
    SubmitScenarios: submitScenarios.SubmitScenarios,
    RecordMerge: recordMerge.RecordMerge,
    WriteRule: writeRule.WriteRule,
    AutoMergeRun: autoMerge.AutoMergeRun,
    AutoMergeCases: autoMerge.AutoMergeCases,
    PushFlow: pushFlow.PushFlow,
    RepoModes: repoModes.RepoModes,
  },
}
