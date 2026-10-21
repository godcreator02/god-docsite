# 分区并进页面树、外部页、跨功能的引用扫描

## 问什么

功能目录的 `site.server.ts` 导出 `sections`、布局 loader 把分区并进页面树，以及平台从内容页出发、顺着引用走进各功能外部页的引用扫描，这两件在真站上行不行、一个二十多页的站扫一次要多久。

## 怎么运行

```text
cd site; pnpm install; node ../make-bulk-pages.mjs; pnpm exec react-router dev --host 127.0.0.1 --port 4341 --strictPort
```

然后打开 `http://127.0.0.1:4341/__probe/scan?cold=1`（先清语法树缓存再扫）与 `http://127.0.0.1:4341/__probe/scan`（热缓存），看 `ms`、`references`、`missing`、`problems`、`sections`；再打开 `/notes/791a3e43-e070-4cea-a452-b7b68db9230b/p01` 看侧栏。

站点由 `docsite.site.init` 建出（基础站，平台包 `@godcreator/god-docsite` 0.1.12），再手工加这些：

- `site/app/probe-platform/`：模拟平台要加的部分。`references.server.ts` 是引用扫描 `siteReferences`，`sections.ts` 把分区换成页面树的 root 文件夹，`external-mdx.server.ts` 与 `external-page.tsx` 是外部页的编译与页框，`site-sections.server.ts` 是布局 loader 里做的那一步，`fake-library.server.ts` 模拟一个库的功能包服务端部分
- `site/app/features/probe-notes/`、`probe-papers/`：两个试验功能，组件 `Note`、`Ref`，各自的 `site.server.ts` 导出 `references` 与 `sections`；`server.generated.ts` 是手写的汇总文件，模拟建站器的输出
- `site/app/routes/layout.tsx`：模板布局 loader 改成扫描一次、并进分区
- `library/`：模拟两个库的数据目录（个人站从提供的目录读）。笔记 `791a…` 引用论文 `f380…` 与笔记 `3d77…`；内容页引用笔记 `791a…` 与论文 `7622…`；笔记 `c451…` 没被引用，它引用的论文 `ec46…` 也就不该进分区
- `site/content/problems.mdx`：`id` 写成表达式一处、引用不存在的条目一处

## 结论

行得通。分区并进页面树后成了目录切换里的两项，外部页嵌在布局里时侧栏停在对应的分区；扫描结果和预期一致：只在笔记里被引用的论文进了「论文」分区，没被走到的笔记与论文不进，代码块里的例子不算引用，表达式写的 `id` 记进 `problems`，不存在的条目记进 `missing`。26 个内容页（每页约 6 KB）加 5 个外部页共 31 个文件：清缓存后扫一次 80–132 ms，热缓存 6–11 ms（只剩 stat）。

两处要在正式实现里处理：

- 多页条目做成文件夹时，首页既是文件夹的 index 又是第一个子项，fumadocs 的上一页、下一页把它算两次（截图里「下一页」指向自己）。文件夹不带 index，或子项里去掉首页
- 改 `content/` 下的页，侧栏 255 ms 内自己更新（平台现有的 dev 刷新会重跑布局 loader）；改 `library/` 下的外部页，要刷新页面才更新：原型没有盯这个目录，正式实现由平台的 vite 插件按提供的目录盯

数字在 `runs/01-scan-timing-and-result.txt`，截图 `runs/02-note-page-sidebar.jpg`。

## 运行那次的环境

2026-10-21，Windows 11，pwsh 7，Node 24.14.1，pnpm 12.4.2；`@godcreator/god-docsite` 0.1.12、`fumadocs-core` 16.17.1、`@mdx-js/mdx` 3.1.1；docsite-kit 仓当时的 commit `e26dbc16`。
