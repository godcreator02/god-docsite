# docfirst check 的时间花在哪

## 问什么

`docfirst check` 一次要十几到几十秒（会话记录统计：各仓 `pnpm doc` 共 206 次、124 分钟，平均 36 秒），
时间是不是花在起 git 子进程上；进程内记住 blob 与 hunk 表之后能省多少。

## 怎么跑

```
pwsh -NoProfile -File run.ps1 <被测的 cli.mjs> runs\<输出文件名>.txt
```

`run.ps1` 在六个站里各跑一次 `node --import trace-git.mjs <cli.mjs> check`，只留计次表。
`trace-git.mjs` 替换 `child_process.execFileSync`，给每次 git 调用计次、计时，不改被测代码。
基线用任一消费方站里装的 0.2.2（`<站>\node_modules\@godcreator\docfirst-workflow\dist\cli.mjs`），
改动后用工作区构建出来的 `packages\docfirst-workflow\dist\cli.mjs`。六个站同一时刻、同一个工作区状态下两份各跑一次。

## 结论

git 子进程占 0.2.2 总耗时的 50%–90%，单次 git 约 0.1 秒。进程内记住 blob 与 hunk 表、内容没变时不问对象库之后：

| 站 | 0.2.2 | 改动后 |
| --- | --- | --- |
| gwb-devkit | 15.7s，115 次 | 3.7s，13 次 |
| god-live-doc | 24.6s，229 次 | 7.1s，40 次 |
| gwb-base-plugins | 6.7s，54 次 | 2.3s，8 次 |
| gwb-ui-plugins | 6.2s，43 次 | 2.3s，4 次 |
| gwb-kernel | 5.6s，35 次 | 2.6s，10 次 |
| gwb-block-note | 5.9s，34 次 | 2.4s，6 次 |

0.2.2 里同一个 blob 被反复读：当天早些时候 devkit 一次 check 调了 148 次 `cat-file -p`，只涉及 12 个不同的 blob。
改动后剩下的 git 调用是「内容变过的文件各一次取旧内容、一次 diff」，加 god-live-doc 目录树引用每层一次 `check-ignore`；
剩下约 2 秒是 node 启动、加载 fumadocs、编 mdx。devkit、base-plugins、kernel、block-note 四个站上，
两版 check 的完整输出逐行比过，一致。

## 跑那次的环境

2026-09-25 11:08，Windows 11 Pro 10.0.26200，node v24.14.1，git 2.53.0.windows.2。
被测对象：0.2.2 是已发布的包；改动后是 god-live-doc 在 afa316a 之上未提交的工作区（本次提交就是它）。
各站当时各自的工作区状态不固定（别的会话在改），所以数字只在 `runs/` 下这两份之间可比。
