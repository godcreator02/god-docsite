# 协作仓

## 约定

- **只用 main**：直接在 `main` 的工作区改，改完 `collab.submit`
- **页面**：照说明书 `docsite` 的「写页面」写在 `site/content/` 里，地址就是 `content/` 下的路径。`/tasks`、`/calendar`、`/comments`、`/api` 是协作站自己的，不拿来当页面路径。一段讲一件事，并列的要点写成列表：评论按段落、列表项、表格、图来批。有评论的页面移动或改名时，`site/comments/` 里评论串 `index.mdx` 的 `page`、`collab/records/` 里任务的 `page` 等于旧地址的，一起改成新地址
- **任务与模块**：用 `collab.task.*`、`collab.module.*` 写，模块只有截止日、没有开始日；任务的 `page` 写相关页面的地址，如 `/plan/control-plan`。协作仓里有分组列表 `collab/groups.json` 时，模块的 `group` 写其中一组的 `id`，任务页一组画一张甘特图。删任务、模块前把标题给人先过目
- **评论**：`docsite.comments {"dir":"<协作仓>/site"}` 找，属于某一页的看 `page` 与 `quote`，在页面源文件里搜 `quote`；没有 `quote` 的说的是整页，没有 `page` 的不属于任何页面。要回答的写好答复给人先过目，同意了再 `docsite.comment.reply`（要站点在运行）。事情办完了，问人要不要 `docsite.comment.resolve` 把这串标为已解决
- **项目负责人改文件不受限**：身份是项目负责人（Gitea 上协作仓的协作者）时，`collab/`、`site/` 下的任何文件都可以直接改，别人的记录也一样，改完照常 `collab.submit`；改之前把改哪些记录、怎么改给人先过目
- **只有项目负责人能改的**：`.gitea/` 与 `.github/` 下的工作流、`site/people.json`（每个人只改自己那一项的 `codes` 不算）、分组列表 `collab/groups.json`、`site/` 根下的 `*.config.*`、`.postcssrc*`、`.npmrc` 与 `pnpm-workspace.yaml`、`site/package.json` 里 `@godcreator/` 下的包（加、删、改版本都算）、`scripts` 这类不是依赖的字段和写成网址或路径的依赖。不是负责人的提交被拦下时，把这几处报给人，交给项目负责人。
  `collab.submit` 一次提交 `collab/` 与 `site/` 的全部改动，这几处不撤掉，同一批里自己的身份码、页面、评论也推不出去：人同意后把这几处改回 main 上的样子，别的改动照留，再提交审核。
  改回的是站点依赖的版本（比如成员自己升级了站点）时，`git checkout -- site/package.json site/pnpm-lock.yaml`，再在 `site/` 里 `pnpm install`；`site/package.json` 里同一批还有自己加的库时，只把 `@godcreator/` 下的版本改回去、再 `pnpm install`。
  要升级站点请负责人做（`references/organization.md` 的「升级站点」），合进 main 后自动同步会装好
- **站点**：由 gwb-docsite 托管（项目加进列表时登记，移出时撤掉），停了用 `docsite.site.start {"dir":"<协作仓>/site"}` 启动。本 home 的身份码在 `site/people.json` 里才有身份、能写评论；没能启动时看 `collab.projects` 那一项的 `site.error`。`site/app/` 与 `site/` 根下的配置文件是 `collab.site.init` 建站时照平台与功能包的模板写出的，平时不改，升级站点时才对照模板改（见 `references/organization.md` 的「升级站点」），`app/` 里不放自己的文件；首页 `site/app/routes/home.tsx` 是协作包的项目首页，也是建站时写出的

## 写日志

项目日志是 `site/journal/<YYYY-MM-DD>.mdx`，全项目一天一篇，网站「日历」里点那一天就是这一页。

- 替人做完一件实际的工作（画完一版图、测完一段链路、定下一个参数），或人说「记进日志」时，在干活那一天的日志页后面续写一段：先读那一页现有的内容，没有就新建
- 提到任务、模块写 `<RecordLink id="记录 id" />`，id 在 `collab/records/` 里找；提到某一页写普通链接 `[标题](/页面地址)`。不用 `import`，不写 frontmatter，标题就是日期
- 写做了什么、结果（数据、过没过）、卡在哪、下一步；不抄提交说明，不列文件清单
- 不写是谁写的，不按人分节；别人写的段落不改
- 写好给人先过目，同意了再 `collab.submit`。同一天这一页合 main 冲突时两边的段落都留下

## 通知

交给 AI 的提示词里每条通知有短句与原文，照下表做：

| 通知 | 怎么做 | 什么时候消失 |
| --- | --- | --- |
| 本机有 N 个文件还没提交审核 | 读改动，按记录、站点文件归类给人先过目，确认后 `collab.submit` | 提交审核以后 |
| 提交审核合 main 出了冲突 | 按两边的意思改好、去掉冲突标记，拿不准的问人；怎么合的给人先过目，再 `collab.submit` | 再次提交审核以后 |
| 上次提交审核没成功 | 被打回照留言改；改到只有负责人能改的被拦下，报给人，照上面「只有项目负责人能改的」改回那几处、先提交别的；等不到结论，告诉人执行器可能没在运行。改好先过目再 `collab.submit` | 下一次提交审核成功；改动撤掉了、没有东西可提交时，`collab.check` 以后 |
| 没能自动同步 main 上的新改动 | 工作区的改动和新改动碰到同一个文件：先提交审核；本地 main 有没进 main 的提交：确认不在等执行器，再 `collab.submit`。处理完 `collab.check` | 快进以后 |
| 协作仓在分支 … 上，不在 main | 把分支上没进 main 的内容移到 main 上提交审核，再问人删不删那条分支 | 回到 main |
| collab/… 读不对 | 照原话改；拿不准的（比如两条记录 id 重复）问人；先过目再提交审核 | 改好以后 |
| gwb 检查项目出错 | 本机改不了的（连不上 Gitea、令牌失效）告诉人怎么做；能改的照原话处理；再 `collab.check` | 那一步做成以后 |
| 组织的 webhook 没按插件要的配 | 读 `references/organization.md` 的「组织 webhook」 | 配好以后 |
| 指派给我的任务 | `collab.inbox` 找到，照任务内容改 `site/` 或写出答复；改动先过目再提交审核 | 任务标为完成 |
| … 在评论里 @了我、在回复里 @了我 | `collab.inbox` 里这一条的 `comment` 前半是评论串，`docsite.comments` 读这一串；照着改 `site/` 的先过目再提交审核，要回答的写好答复先过目再 `docsite.comment.reply` | 这串评论标为已解决（网页上点开这串、在发起的那条上点「标为已解决」或 `docsite.comment.resolve`）；重新打开又列出来 |
| … 回复了我 | 把回复内容与页面报给人 | 同上 |

## 常见问题

- `site/pnpm-lock.yaml` 冲突：`site/package.json` 留下两边加的库，`git checkout --theirs -- site/pnpm-lock.yaml`，在 `site/` 里 `pnpm install`，再提交审核
- 跟上 main 只靠自动同步：处理完同步问题调 `collab.check`，它取回后能快进就快进
