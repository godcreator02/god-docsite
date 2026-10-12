# AGit 两人协作流程实验

## 问什么

在自建 Gitea（1.27.1）上，成员只有读权限、负责人独占 main 的前提下，用 AGit（推送到 `refs/for/main` 自动建合并请求）能不能走通两人协作：建合并请求、同一主题更新、冲突与解决、自动合并机器人需要的信息，以及成员能不能绕过管控或冒名。

## 怎么跑

```powershell
git clone https://git.tianshen02.online:28377/godcreator/agit-probe.git lead; git clone https://bob-test@git.tianshen02.online:28377/godcreator/agit-probe.git bob; git clone https://carol-test@git.tianshen02.online:28377/godcreator/agit-probe.git carol
```

三份克隆分别是负责人 godcreator 与两名只读成员；远端地址带上用户名，git 就会取 Windows 凭据管理器里对应账号的凭据。每份克隆再用 `git config user.name` / `user.email` 设成各自的身份。克隆放在临时目录，不进仓。

每一步的命令与输出按顺序在 `runs/00-*.txt` 到 `runs/06-*.txt`，API 部分在 `runs/07-api-observations.txt`。要从头重跑，先在 Gitea 上删掉 `godcreator/agit-probe`，再按 `runs/07` 的「准备」重建仓、协作者与分支保护，然后照 `runs/01` 起的命令逐步执行。

测试仓：https://git.tianshen02.online:28377/godcreator/agit-probe

## 结论

AGit 在这台 Gitea 上可以直接用，方案成立：

- **只读成员推 main 被拒**：`User permission denied for writing`（`runs/01`）。
- **只读成员推 `refs/for/main` 能建合并请求**，不需要复刻，也没有打开任何仓库开关（`runs/02`）。
- **同一主题再推，更新原合并请求**，不会新建（`runs/03`）。
- **冲突能被发现，也能由提交者自己解决**：合并 #1 后 #2 变成 `mergeable: false`；carol 变基后带 `-o force-push=true` 推同一主题，#2 变回 `true` 并合并成功（`runs/04`、`runs/07`）。
- **冒名能被识别**：bob 把提交作者写成 carol，合并请求的发起人仍记为 `bob-test`；机器人读改动文件列表和文件内容，比对记录里的 `author` 与发起人即可拒绝（`runs/05`、`runs/07`）。
- **机器人要的信息 API 都给**：发起人、改动文件及其状态（新增 / 修改）、按提交号读文件内容、能否合并；合并、评论、关闭也都能用 API 完成。

撞到的两点：Gitea 推送输出对新建的合并请求也写「Visit the existing pull request」，不能靠这句话判断是新建还是更新；通过 API 合并时 `merged_by` 为空。

没测：Gitea Actions 对 AGit 合并请求的触发；成员在网页上直接改文件建合并请求；两人同时向同一主题推送。

## 跑那次的环境

2026-09-25 16:18–16:22，Windows 11 Pro 10.0.26200，git（Git for Windows，凭据由 Git Credential Manager 管理），Gitea 1.27.1（git.tianshen02.online:28377）。负责人令牌为 godcreator（管理员），成员为已有测试账号 bob-test、carol-test。
