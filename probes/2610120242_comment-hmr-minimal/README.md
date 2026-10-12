pnpm install && pnpm test && pwsh -NoProfile -File scripts/start-dev-b.ps1 && pwsh -NoProfile -File scripts/wait-http.ps1 http://127.0.0.1:5521/docs 90 logs/dev-b.log

# 2610120242_comment-hmr-minimal：评论/正文 dev 热更新最小独立实验（S 线）

两轮实验，同一个隔离 workspace：

1. **新增正文基线（最新，第一优先）**：`site-b` 的 `/docs/*` 路由，验证「dev 运行中新增一篇
   docs 集合 MDX（带自己的相对导入 TSX 与图片）」在 Fumadocs 默认接线与
   `index: { target: 'default' }` 下的真实表现。结论与证据见 **`docs-add-result.md`**。
2. **评论链对照（已暂停）**：`site-b` 的 `/page` 路由（含 `site-a` 纯 RR 对照站），验证
   「稳定页面组件 + 原生 MDX 热更新 + 正文入口就绪后显示」。结论与证据见 **`result.md`**。

## 目录

| 位置 | 内容 |
| --- | --- |
| `site-a/` | 实验 A：纯 React Router 站点（无 fumadocs），SSR 模块失效链与 Fast Refresh 对照（评论轮） |
| `site-b/` | 两种路由：`/docs/*` 新增正文基线（无评论），`/page` 评论实验（保留） |
| `site-b/content/docs/` | 正文材料：index.mdx（自写 page-counter.tsx + dot.svg）与两轮新增的页面 |
| `tests/` | Vitest：`docs-add.test.ts`（起 dev → SSR → 运行中新增 MDX → 新 URL 可直达 → 清理） |
| `scripts/` | 启动与等待脚本（分离进程、日志落盘） |
| `logs/` | dev 日志（dev-a.log、dev-b.log）与 Vitest 日志 |
| `docs-add-result.md` | 第二轮：新增正文基线结论（两 target 对照、状态分类） |
| `result.md` | 第一轮：评论链 A/B/C/D 结论 |
| `handoff.json` | 机器可读交接摘要 |

## 常用命令（都在本目录）

```sh
pnpm install                                  # 安装隔离 workspace（自己的 pnpm-lock.yaml）
pnpm test                                     # Vitest（2 用例：新增正文 HTTP 层回归）
pwsh -NoProfile -File scripts/start-dev-a.ps1 # 站点A dev http://127.0.0.1:5520/page
pwsh -NoProfile -File scripts/start-dev-b.ps1 # 站点B dev http://127.0.0.1:5521/docs
# 停止：杀掉 5520/5521 端口的监听进程即可
```

浏览器实验（docs-add-result.md 的证据来源）：打开 `/docs`，真实点击计数器与输入草稿建基线，
向 `content/docs/` 新增 MDX（先写同目录 TSX 与图片，再写 MDX），观察导航自动出现后点 Link 进入。

## 版本基线

React Router 8.4.0、Vite 8.3.4、fumadocs-core 16.17.1、fumadocs-mdx 15.4.7（交付形态
`index: { target: 'default' }`，默认接线的对照结论见 docs-add-result.md）、React 19.3、
TypeScript 5.9、Vitest 5.0.3。
