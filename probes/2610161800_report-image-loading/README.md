# 报告页的图为什么加载慢

## 怎么运行

```
node time-loader.mjs file:///D:/unitfolders/oz47p-docsite-kit/god-docsite/packages/word-report/dist/site-server.mjs <站点目录> <报告 id>
```

第一个参数换成哪个版本的 `site-server.mjs`，就测哪个版本的 loader（不启动站点，直接调用 `reportPageLoader` 与 `reportAssetLoader`，零依赖）。
`time-images.mjs <站点地址> <报告 id>` 走 HTTP 测一个正在运行的站：先取报告页，再把页面里的图片地址一起请求。

## 问什么

一份 34 张图的报告，网页上图要一分多钟才全部出来，慢在哪。

## 结论

0.3.0 的图片 loader 每个请求都把整份报告读一遍、组装一遍，再查这张图对应哪个文件；组装是纯计算，几十个请求在一个线程上排队。
开发服务里 34 张图一起请求 99 秒（`runs/01-http-0.3.0.txt`），直接调 loader 33.4 秒；
改成「JSON 原文没变就沿用上次的组装结果、同时到的请求共用一次组装」后 0.2 秒，报告页第二次打开从 779 ms 到 24 ms（`runs/02-loader-before-after.txt`）。

另外用 `node --cpu-prof` 看过一次组装：2.2 秒的采样里 1.3 秒花在构造 `ReportContentError` 上——
`src/core/assemble.ts` 的手写校验遇到 `oneOf` 时逐个候选试，试不过就抛一次异常，每次都要生成调用栈。这一处没改。

## 运行那次的环境

2026-10-16，Windows 11，Node v24.14.1。被测对象：word-report 0.3.0（提交 4f3decbb）与它之上的修复提交（word-report 0.3.1）；
报告是 chb-dab-sst 协作仓 `site/reports/sst-preliminary-design/`（入口 content.json 1.45 MB，34 张图共约 11 MB）。
