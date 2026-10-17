# 评论界面原型

```powershell
Start-Process probes\2610151845_comment-ui-prototype\comment-ui-prototype.html
```

## 问什么

页面评论的入口与列表放在哪：正文下方浮窗、右下角收件箱，还是别的几种摆法，先用纯 HTML 原型并排看过再挑。

## 怎么运行

第一行命令用默认浏览器打开原型，不需要装依赖、不需要启动服务。左下角的工具条切换五套方案。

## 结论

选定正文下方的评论浮窗加右下角的本页评论收件箱，取舍与否掉的几套写在轨迹卡 `docs-site/trajectory/2026-10-15-comments-floating-and-inbox.mdx`；
现在的实现在 `packages/comments/`。

## 运行那次的环境

2026-10-15，Windows 11，Microsoft Edge；原型是一个自带样式与脚本的 HTML 文件，不依赖本仓的包。原在单元根 `D:\unitfolders\oz47p-docsite-kit\`，2026-10-17 挪进本目录。
