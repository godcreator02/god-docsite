# 组织与项目

## 加入项目

一台电脑做一遍：

1. 项目负责人把这个人加进组织的 `members` 团队，并在协作仓 `site/people.json` 里加一项 `{ "id": "<Gitea 用户名>", "name": "<显示名>", "gitea": "<Gitea 用户名>" }`，提交审核
2. 装 VS Code 与 Git LFS（装完运行一次 `git lfs install`）；在 gwb 的插件管理里装 `gwb-gitea`、`gwb-docsite`、`gwb-collab`、`@cordisjs/plugin-timer`。gwb-docsite 第一次加载时给这个 home 生成身份码
3. 人自己在 Gitea「设置 → 应用」生成令牌、勾全部权限，填进 gwb-gitea 的设置 `token`。令牌由人生成、由人填
4. 问人项目放在哪个目录下，调 `collab.project.clone {url, parent}`（`url` 是 `https://<主机>/<组织>`）。它把本 home 的身份码加进 `site/people.json` 里自己那一项，回执 `joined` 为 `true` 时这一行改动要 `collab.submit` 提交审核，别人的站点才认得这台电脑。回执 `listed` 为 `false` 是账号还不在 `people.json` 里，项目没加进列表：让人找项目负责人加上，在协作仓里 `git pull` 拿到以后调 `collab.project.join {repo}` 与 `collab.project.add {repo}`

换电脑、新开一个 home、换了身份码，也是 `collab.project.join {repo}` 再 `collab.submit`：一个人可以有几个身份码，各在自己那一项的 `codes` 里。

插件运行的 git 和 Gitea 接口用 gwb-gitea 的令牌；人和你在终端、VS Code 里运行的 git 用 Windows 凭据管理器的登录。两边要是同一个 Gitea 账号。

## 命令报这些错时

- 「没找到 gwb-gitea 的设置」「还没填 Gitea 令牌」：照「加入项目」第 2、3 步。Gitea 回 403、原话里有 `required=[…]`：令牌缺那一项，让人重新生成
- 「本 home 的身份码不在 site/people.json 里」：调 `collab.project.join {repo}`，再提交审核
- 令牌的账号和身份码认出的人不一样：把两边各是什么告诉人，问人用哪个账号的令牌、或者在 gwb-docsite 的设置 `identity-code` 里填哪个码
- 协作仓 `origin` 的主人不是组织，或协作仓不在以组织命名的项目文件夹里：让人用 `collab.project.clone` 重新克隆

## 设置与实时推送

- `ai-handling`：协作窗格里点「交给 AI 处理」交给谁，`off` / `zcode` / `claude-terminal`。选 `zcode` 前告诉人「ZCode 完全访问时改文件、运行命令都不问人」
- `qq-notifications`：新出现、连续 1 分钟还在的通知私聊主人（只存在几秒的中间状态不发），要同 home 装好 gwb-qq-bot
- QQ 命令：人想在 QQ 里给项目派任务时，问他起什么短名（如 `/mmc`），调 `collab.project.qq-command {repo, command}`，撤掉给 `null`；要同 home 装好 gwb-qq-bot。拒绝或回执 `taskGroup.error` 不为空，就把原话告诉人
- 实时推送的地址是 gwb-gitea 的设置 `push-url`，状态看 `collab.projects` 顶上的 `push`。Gitea 上的事几秒内就到，一般不用调 `collab.check`

## 组织 webhook

组织管理员才看得到「组织 … 的 webhook 没按插件要的配」，新建协作组织时也要配一次。把原因报给人，人同意后调 `collab.org.setup {repo}`：

- 拒绝说读不到 webhook（Gitea 回 403）：本机身份不是组织管理员，请组织管理员来配
- 拒绝说有好几个 webhook：报给人在 Gitea 网页上删到只剩一个，再调

## 项目负责人的事

项目负责人是协作仓在 Gitea 上的协作者，改协作仓也走提交审核，执行器查到作者是负责人就放行。

- **建站点**：新建项目时协作仓里还没有 `site/`，问人站名与开发端口，调 `collab.site.init {repo, port, title}`：gwb-docsite 照平台模板建出 `site/`、装依赖，再加协作功能包 `@godcreator/collab`（范围是 gwb-collab 打包时带的那一版）。`site/` 要不存在或是空目录，已有站点直接拒绝。它只写文件，和工作流文件 `.gitea/workflows/collab-auto-merge.yaml`（照 `@godcreator/collab` 包的 `templates/collab-auto-merge.yaml` 放，把 `MERGE_CHECK_RANGE` 的 `{{version}}` 换成要用的版本范围）在同一个提交里推到 main（这时 main 还没配保护）
- **加人**：加进 `members` 团队，再在 `site/people.json` 里加一项（见「加入项目」第 1 步），提交审核
- **换负责人、加共同负责人**：`collab.repo.setup`，见 `references/other-repos.md` 的「配仓」
- **升功能包**：先看协作仓工作区里有没有别人还没提交审核的改动，问人升到哪一版，再依次 `collab.site.stop {repo}` → `docsite.feature.add {"dir":"<协作仓>/site","package":"@godcreator/collab","version":"^<版本>"}` → `collab.site.start {repo}`。`docsite.feature.add` 只补站点还没有的接线文件、不覆盖已有的；改动给人过目后提交审核
- **骨架要照新模板重建**：没有原地重写骨架的命令。要重建就把 `content/`、`comments/`、`people.json`、`journal/` 拷走，删掉 `site/` 再 `collab.site.init`，拷回后提交审核
- **站点检查不过**：`collab.submit` 报「site/ 的站点检查不过，没有提交」时，照每条原话改 `site/` 里的文件（人员列表、评论文件、日志页的文件名），再提交审核
- **执行器没给结论**：NAS 上的执行器多半没在运行，告诉人去看执行器
