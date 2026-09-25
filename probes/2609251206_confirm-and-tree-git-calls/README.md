# confirm 与目录树起了多少次 git

## 问什么

docfirst-workflow 0.2.3 之后，`docfirst confirm` 一页要多久、时间花在哪；改成「每个文件最多问一次 git、
干净先比字节」「hunk 表按内容寻址落盘」「目录树一次 `git status --ignored=matching`」之后省了多少，
check 的输出有没有变。

## 怎么跑

```
node --import file:///<本目录>/readonly-git-count.mjs <被测的 cli.mjs> confirm <文档路径>
```

在站目录里跑。`readonly-git-count.mjs` 给每次 git 调用计次、计时，并把写记录簿、写文档换成空操作，
所以 confirm 也能真跑、仓里一个字不动。check 的比较在 16 个站里各跑三次（0.2.3、改动后冷缓存、改动后热缓存），
把两版的完整输出逐行比较，结果在 `runs/03-check-16-sites.txt`。

## 结论

按页 confirm 的 git 调用几乎全是重复的：auto 比较器每处行段引用问 5 次（`hasCommits` 与 `headCommit` 是同一句），
git 比较器问 3 次，同一页几十处引用钉的往往是同几个文件。改动后 devkit `devkit/index.mdx` 5.8s → 0.55s
（git 60 次 → 4 次），kernel `desktop/boot.mdx` 0.9s → 0.4s。16 个站的 check 输出与 0.2.3 逐行一致，
缓存热了之后多数站 1.2–2.1s。

## 跑那次的环境

2026-09-25 12:06，Windows 11 Pro 10.0.26200，node v24.14.1，git 2.53.0.windows.2。
被测对象：0.2.3 是已发布的包；改动后是 god-live-doc 在 a95de00 之上未提交的工作区（本次提交就是它）。
各站当时的工作区状态不固定，数字只在同一份 runs 文件里的两列之间可比。
