# 只读成员能不能提交 LFS 文件

## 问什么

组织 `hybrid-mmc` 想让成员对所有仓只读、改动一律提合并请求。资料库 `datasheets` 的手册原件走 Git LFS。在自建 Gitea（1.27.1）上：只读成员用 AGit（推到 `refs/for/main`）能不能提交 LFS 文件；不能的话，复刻加合并请求行不行；另外，`collab.retract` 要关掉自己开的合并请求，只读成员做不做得到。

## 怎么跑

1. 负责人经 `gitea.http`（管理员令牌）建私有仓 `godcreator/lfs-probe`，加 `.gitattributes`（`*.pdf filter=lfs diff=lfs merge=lfs -text`），bob-test、carol-test 设为只读协作者，main 的推送与合并只允许 godcreator（`runs/00`）
2. 只读成员克隆原仓，提交一个随机内容的 PDF，`git push origin HEAD:refs/for/main -o topic=<主题>`（`runs/01`，`runs/03`、`runs/04` 带 `GIT_TRACE=1`）
3. 只读成员复刻（`POST /repos/godcreator/lfs-probe/forks?sudo=<成员>`），克隆复刻，提交 PDF 推到复刻的新分支，`POST /repos/godcreator/lfs-probe/pulls?sudo=<成员>` 向原仓提合并请求，负责人合并，再由负责人重新克隆原仓核对 PDF 的哈希（`runs/02`）
4. 只读成员在复刻上建分支、向原仓提合并请求，再以成员身份 `PATCH …/pulls/<编号> {"state":"closed"}`（`runs/05`）

**先读这条再跑第 2 步**：只读成员推 LFS 时，Gitea 回 401，git-lfs 会调用 `git credential reject`，把 Windows 凭据管理器里存的这个账号的凭据删掉。第一次跑就这样删掉了 bob-test 的凭据。后面几步都让 git 用一个只读不删的凭据助手（写法在 `runs/02` 开头）；只要带着它，同样的 401 会让 git-lfs 反复重试、不会自己退出，要加超时停掉（`runs/04` 用了 40 秒）。`sudo` 参数要求令牌的账号是站点管理员。

测试仓：https://git.tianshen02.online:28377/godcreator/lfs-probe ，复刻：https://git.tianshen02.online:28377/carol-test/lfs-probe

## 结论

- **只读成员用 AGit 提交不了 LFS 文件**。推送前 git-lfs 先调锁校验接口 `…/info/lfs/locks/verify`，只读用户拿到 401 `You must have push access to verify locks`（`runs/03`）；用 `lfs.locksverify=false` 跳过后，上传接口 `…/info/lfs/objects/batch` 仍回 401 `Unauthorized`（`runs/04`）。git-lfs 中止推送，合并请求建不出来。
- **Gitea 对只读用户回 401 而不是 403**，git-lfs 把它当成账号密码错了，删掉存着的凭据（`runs/01`）。成员碰上时的样子是：推送失败，之后一直弹窗要求登录。
- **复刻加合并请求走得通**：成员对自己的复刻有写权限，LFS 文件能传上去；负责人合并后重新克隆原仓，PDF 的 SHA256 与大小和成员上传的一致（`runs/02`）。
- **只读的发起人能关掉自己的合并请求**（`runs/05`），`collab.retract` 不需要写权限。

没测：从复刻提交时，复刻缺少原仓后来新加的 LFS 文件，git-lfs 会不会把它们重传一遍；成员在网页上上传 LFS 文件。

## 跑那次的环境

2026-09-28 13:21–13:44，Windows 11 Pro 10.0.26200，Git for Windows 与 git-lfs 3.7.1，凭据由 Git Credential Manager 管理；Gitea 1.27.1（git.tianshen02.online:28377）。负责人 godcreator（站点管理员），成员为测试账号 bob-test、carol-test。
