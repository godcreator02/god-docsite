# 评论按页面文字快照定位：服务端与浏览器算出的页面文字是否一致，改了页面以后位置推算得对不对

## 问什么

评论存「发起时整页文字的快照 + 位置」、打开时按逐字差异推算位置：服务端从 HTML 算出的页面文字（给 agent 发起评论用）
和浏览器里算出的一致吗？重复的文字、页面改过以后，评论还标得对吗？

## 怎么运行

```text
node probes/2610102215_comment-anchor-page-text/server-page-text.mjs packages/docsite-kit http://127.0.0.1:4431 <输出目录> / /skeleton /comments /dev-plugin /page-types /page-types/tsx-page /page-types/html-page /writing /writing/components /zz-anchor-test
```

先在仓根 `pnpm install`、`pnpm --filter @godcreator/docsite-kit build`，把 `input/anchor-test-page.before.mdx` 复制成
`site/content/(kit)/zz-anchor-test.mdx`，在 `site/` 里 `pnpm exec react-router dev --port 4431 --host 127.0.0.1` 启动开发服务。
服务端那一半用上面这条命令（它读基础包构建产物里的 `pageTextOfHtml`）；浏览器那一半在任意一页打开控制台，粘贴运行 `browser-page-text.js`。
两边逐行比长度与 sha1。位置推算那一半是手动步骤，照 `runs/02-anchor-mapping.txt` 的顺序在网页上发评论、改试验页、看标在哪里。

## 结论

10 页里 9 页两边的页面文字一字不差；TSX 页面差 7 个换行（代码块只在浏览器里着色），差异推算把它吸收掉，agent 批的那一行照样标准。
重复的表格行、重复的句子批哪处标哪处；开头插段、被批的行里改字都跟得上（后者标「原文改过」）；
三句一模一样删掉一句时，批在被认定删掉的那句上的评论找不到，不会挂到别处。数字见 `runs/`。

## 运行那次的环境

2026-10-10，Windows 11，Node v24.14.1，Chrome；被测对象是 docsite-kit 分支 comment-anchor-snapshot 在 06870de 之上未提交的改动
（随这个目录一起提交的那个提交）。
