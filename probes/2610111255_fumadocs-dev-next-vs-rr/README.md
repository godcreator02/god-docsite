# fumadocs dev 模式：Next.js 对 Vite + React Router

```powershell
foreach ($s in 'site-next','site-next-async','site-next-tuned','site-rr') { pnpm --dir probes\2610111255_fumadocs-dev-next-vs-rr\$s install }; node probes\2610111255_fumadocs-dev-next-vs-rr\bench\run-all.mjs
```

## 问什么

同一批 mdx 页面，fumadocs 官方 Next.js 模板与 Vite + React Router 模板在 dev 模式下各占多少内存、首屏与热更新各要多久，页数涨到 100、500 页时差多少。

## 怎么运行

1. 第一行命令先给四个站装依赖，再跑主批次：页数 0 / 100 / 500 三档，每档每个站冷启动（先删编译缓存）3 次，站之间交替跑。
   每次运行由 `bench/bench.mjs` 完成：启动 dev → 打开 `/docs` → 打开 `/docs/test` → 依次打开全部生成页 → 改一页 mdx 量热更新 → 空闲 60 秒 → 停掉整棵进程树，
   全程按进程树采样工作集与提交内存。单次运行超过 10 分钟或内存超限就记为超限。
2. 生成页由 `bench/gen-pages.mjs` 确定性地写进各站 `content/docs/bench/`（每 50 页一个分组文件夹），跑之前写入、跑完删掉，所以站目录里没有它们。
3. `bench/run-extra.mjs` 是第二批：Next 省内存配置的冷启动，加四个站的热启动（保留上次的编译缓存）；`bench/run-list.mjs <页数> <cold|cold+warm> <站…>` 按清单每个站跑一次，
   Next 的各种优化变体（`next-lean`、`next-threads`、`next-webpack`、`next-par2-*`）都用 `site-next-tuned`，由环境变量 `BENCH_NEXT_TUNING` 选它 `next.config.mjs` 里打开哪几项。
4. 原始记录逐行追加到 `results/raw.jsonl`，内存曲线在 `results/series/`，dev 服务输出在 `results/logs/`；`node bench/summarize.mjs` 按「站 × 页数 × 缓存模式」取中位数写出
   `results/summary.md` 与 `summary.json`，`node bench/report.mjs` 画出 `results/report.html`，`node bench/serve-results.mjs` 在本机只读打开它。
   `results/smoke/` 是正式跑之前的冒烟记录，`results/aborted-no-series/` 是采样曲线还没写进记录时中断的一轮，都不计入汇总。

四个站：`site-next` 是 Next 模板原样（全部页面一次导入），`site-next-async` 改成按页懒加载，`site-next-tuned` 是带优化开关的 Next，`site-rr` 是 Vite + React Router 模板原样。

## 结论

100 页冷启动，Next 的内存峰值（工作集）是 3925–4484 MB，Vite + React Router 是 744 MB；第一次打开 `/docs` Next 要 17.9–23.4 秒，Vite + React Router 3.76 秒；
依次打开 100 页单页中位数 126–196 ms 对 38 ms，首页后 Next 是 31–37 个进程、Vite 是 3 个。500 页时 Next 两种写法 3 次都在依次打开全部页的阶段超限（峰值约 6.2 GB），
Vite + React Router 3 次都完成，峰值 1324 MB。热启动（保留缓存）只把 Next 的首屏降到 7–9 秒，内存峰值仍在 3.5 GB 以上。数字见 `results/summary.md`。

## 运行那次的环境

2026-10-11，Windows 11 Pro 10.0.26200，Node v24.14.1；next 16.4.0、fumadocs-core 16.17.1、fumadocs-mdx 15.4.7、`@fumadocs/base-ui` 16.17.1、react 19.3.0、react-router 8.4、vite 8.3。
四个站是当天 fumadocs 官方模板生成后的副本，不依赖本仓的包；实验原在单元 `aoi5p-fumadocs-dev-bench`，不在 git 里，2026-10-17 原样挪进本目录（去掉 `node_modules`、编译缓存与生成页）。
