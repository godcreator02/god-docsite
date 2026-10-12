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
- 站点用 Chrome 应用窗口（`chrome-app`）还是系统默认浏览器（`default-browser`）打开，是 gwb-docsite 的设置 `site-window`
- `qq-notifications`：新出现、连续 1 分钟还在的通知私聊主人（只存在几秒的中间状态不发），要同 home 装好 gwb-qq-bot
- QQ 命令：人想在 QQ 里给项目派任务时，问他起什么短名（如 `/mmc`），调 `collab.project.qq-command {repo, command}`，撤掉给 `null`；要同 home 装好 gwb-qq-bot。拒绝或回执 `taskGroup.error` 不为空，就把原话告诉人
- 实时推送的地址是 gwb-gitea 的设置 `push-url`，状态看 `collab.projects` 顶上的 `push`。Gitea 上的事几秒内就到，一般不用调 `collab.check`

## 组织 webhook

组织管理员才看得到「组织 … 的 webhook 没按插件要的配」，新建协作组织时也要配一次。把原因报给人，人同意后调 `collab.org.setup {repo}`：

- 拒绝说读不到 webhook（Gitea 回 403）：本机身份不是组织管理员，请组织管理员来配
- 拒绝说有好几个 webhook：报给人在 Gitea 网页上删到只剩一个，再调

## 项目负责人的事

项目负责人是协作仓在 Gitea 上的协作者，改协作仓也走提交审核，执行器查到作者是负责人就放行。

- **建站点**：新建项目时协作仓里还没有 `site/`，问人站名与开发端口，调 `collab.site.init {repo, port, title}`：gwb-docsite 照模板写出 `site/`、装依赖。它只写文件，和合并检查包的工作流文件 `.gitea/workflows/collab-auto-merge.yaml` 在同一个提交里推到 main（这时 main 还没配保护）
- **加人**：加进 `members` 团队，再在 `site/people.json` 里加一项（见「加入项目」第 1 步），提交审核
- **换负责人、加共同负责人**：`collab.repo.setup`，见 `references/other-repos.md` 的「配仓」
- **升功能包**：`site.error` 说站点协议号对不上、要把范围改成 `^<某一版>` 时，先看协作仓工作区里有没有别人还没提交审核的改动，再调 `collab.site.init {repo}`：它把功能包范围写成 gwb-collab 打包时带的那一版、装依赖、照新模板重写 `site/app/` 与配置文件；改动给人过目后提交审核。原话说要升级 gwb-collab，就让人在插件管理里升级它，再调 `collab.site.init {repo}`
- **骨架和装上的包对不上**（基础包或功能包升级以后、`site/app/` 里还是旧骨架）：同样调 `collab.site.init {repo}`，再提交审核
- **站点检查不过**：`site.error` 以「site/ 的站点检查不过」开头时，站点没交给 gwb-docsite 托管（在运行的已停掉）。照每条原话改 `site/` 里的文件（人员列表、评论文件、日志页的文件名），提交审核；合进 main、自动同步以后插件再查一遍，通过就启动
- **执行器没给结论**：NAS 上的执行器多半没在运行，告诉人去看执行器
