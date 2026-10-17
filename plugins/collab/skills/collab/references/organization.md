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

- 协作窗格与网站提示栏的「复制给 AI」把一个项目此刻的全部通知写成提示词复制下来，人粘贴给你；插件不启动任何 AI。要提示词原文时调 `collab.ai.prompt {repo}`
- `qq-notifications`：新出现、连续 1 分钟还在的通知私聊主人（只存在几秒的中间状态不发），要同 home 装好 gwb-qq-bot
- QQ 命令：人想在 QQ 里给项目派任务时，问他起什么短名（如 `/mmc`），调 `collab.project.qq-command {repo, command}`，撤掉给 `null`；要同 home 装好 gwb-qq-bot。拒绝或回执 `taskGroup.error` 不为空，就把原话告诉人
- 实时推送的地址是 gwb-gitea 的设置 `push-url`，状态看 `collab.projects` 顶上的 `push`。Gitea 上的事几秒内就到，一般不用调 `collab.check`

## 组织 webhook

组织管理员才看得到「组织 … 的 webhook 没按插件要的配」，新建协作组织时也要配一次。把原因报给人，人同意后调 `collab.org.setup {repo}`：

- 拒绝说读不到 webhook（Gitea 回 403）：本机身份不是组织管理员，请组织管理员来配
- 拒绝说有好几个 webhook：报给人在 Gitea 网页上删到只剩一个，再调

## 项目负责人的事

项目负责人是协作仓在 Gitea 上的协作者，改协作仓也走提交审核，执行器查到作者是负责人就放行。

- **建站点**：新建项目时协作仓里还没有 `site/`，问人站名，调 `collab.site.init {repo, title}`：gwb-docsite 照平台模板建出 `site/`、写身份文件 `site/docsite.json`（`"kind": "collab"`，插件靠它认出协作仓）、装依赖，再加协作功能包 `@godcreator/collab`（范围是 gwb-collab 打包时带的那一版），首页 `site/app/routes/home.tsx` 换成协作包的项目首页（没做完的任务、快到期的模块、最近的日志、成员）；仓里还没有 `.gitea/workflows/collab-auto-merge.yaml` 就照 `@godcreator/collab` 的模板写出来，`MERGE_CHECK_RANGE` 写成同一版的范围，已有的不动。`site/` 要不存在或是空目录，已有站点直接拒绝。它只写文件，站点与工作流在同一个提交里推到 main（这时 main 还没配保护）；项目已在列表里就把站点登记给 gwb-docsite 常驻，不在就等 `collab.project.add` 时登记
- **加人**：加进 `members` 团队，再在 `site/people.json` 里加一项（见「加入项目」第 1 步），提交审核
- **换负责人、加共同负责人**：`collab.repo.setup`，见 `references/other-repos.md` 的「配仓」
- **升级站点**：只有负责人升级，人让你「升级全部」「更新协作站」时也一样。动手前先确认本机身份是负责人：`gitea.http {"method":"GET","path":"/repos/<组织>/<协作仓>/collaborators/<本机身份>"}`，回 204 是负责人，404 不是。
  不是负责人就不升级，告诉人：升级要改 `site/package.json` 里 `@godcreator/` 下的版本，只有负责人能提交，成员升了会被 `collab.submit` 拦下，连同一批里的身份码、页面、评论都推不出去；请负责人升级、合进 main，自动同步快进时会在 `site/` 里装好新版本。
  已经升了、被拦下的，照 `references/collab-repo.md` 的「只有项目负责人能改的」把升级改回去。

  是负责人时：没有升级命令，`collab.site.init` 只建新站。先看协作仓工作区里有没有别人还没提交审核的改动，问人升到哪一版，`docsite.site.stop {"dir":"<协作仓>/site"}` 后：

  - 升协作功能包用 `docsite.feature.add {"dir":"<协作仓>/site","package":"@godcreator/collab","version":"^<版本>"}`，它升版本、补上站点还没有的接线文件，不覆盖已有的；它最后启动服务检查首页、常驻的站就此保持运行，接着还要 `pnpm add` 的话先再 `docsite.site.stop` 一次
  - 平台包与别的功能包在 `site/` 里 `pnpm add <包>@^<版本>`
  - 平台模板写出的文件与接线文件由你对照平台包与功能包的 `template/` 逐个判断要改哪些文件（见说明书 `docsite` 的「升级已有站点」），站点自己改过的地方保留
  - 站点还没有身份文件 `site/docsite.json` 时补一份 `{ "kind": "collab", "format": 1 }`：没有它插件认不出协作仓、gwb-docsite 也不托管这个站。它只有负责人能改，和别的升级改动一起提交审核

  再 `docsite.site.start {"dir":"<协作仓>/site"}`，改动给人过目后提交审核
- **站点检查不过**：`collab.submit` 报「site/ 的站点检查不过，没有提交」时，照每条原话改：`site/journal/` 下日志页的文件名，或把 `site/content/` 里放错的文件挪到原话写的位置（站点检查只查这两样），再提交审核
- **执行器没给结论**：NAS 上的执行器多半没在运行，告诉人去看执行器
